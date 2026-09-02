import { CONFIG } from "./config.js";

/**
 * Helper to fetch with retry for transient 502/503/network errors
 */
async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      throw lastErr;
    }
  }
}

/**
 * Use Gemini (VoidAI) to inspect a WhatsApp message and extract structured event information.
 */
export async function extractEventFromMessage({ messageText, senderName, groupName, messageTimestamp }) {
  if (!messageText || messageText.trim().length < 15) {
    return null;
  }

  // Quick heuristic filter to avoid wasting LLM calls on greetings or tiny texts
  const hasEventSignals = /\b(event|hackathon|workshop|seminar|webinar|meetup|meeting|talk|session|contest|competition|party|audition|recruitment|match|tournament|celebration|fest|ceremony|symposium|conference|demo day|rsvp|register|venue|timing|today|tomorrow|pm|am)\b/i.test(
    messageText
  );

  if (!hasEventSignals) {
    return null;
  }

  const endpoint = CONFIG.llmBaseUrl.endsWith("/chat/completions")
    ? CONFIG.llmBaseUrl
    : `${CONFIG.llmBaseUrl}/chat/completions`;

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  const systemPrompt = `You are Campus Genie's event extraction engine.
Analyze the message and identify if it is announcing an upcoming campus event, hackathon, workshop, club meeting, talk session, webinar, or social gathering.

Current Date: ${todayStr} (Year: ${currentYear}).

Rules:
1. If NOT an event announcement (e.g. casual conversation, question, meme, homework doubt, spam), return:
{"isEvent": false}

2. If it IS an event, return ONLY a compact JSON object. Keep title and description under 25 words each:
{
  "isEvent": true,
  "title": "Concise event title",
  "category": "hackathon" | "workshop" | "social" | "career" | "meeting" | "sports",
  "hostOrganization": "Club or Department name",
  "location": "Physical room or online platform",
  "isVirtual": boolean,
  "eventDate": "YYYY-MM-DD",
  "startTime": "e.g. 10:00 AM or 05:30 PM",
  "duration": "e.g. 2h",
  "capacity": integer (or 100),
  "foodProvided": boolean,
  "tags": ["Tag1", "Tag2"],
  "description": "Short 1-2 sentence overview"
}

Output strictly valid JSON with no conversational text or extra commentary.`;

  const userPrompt = `WhatsApp Group: "${groupName}"
Sender: "${senderName || "Unknown"}"
Message:
"""
${messageText}
"""`;

  try {
    const res = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.llmApiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.llmModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[EventExtractor] LLM API responded with ${res.status}:`, errText.slice(0, 120));
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim();
    if (!rawContent) return null;

    // Clean JSON content if wrapped in markdown
    const jsonStr = rawContent.replace(/^```(json)?/i, "").replace(/```$/, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // If truncated at the end, attempt simple bracket closure
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return null;
        }
      } else {
        return null;
      }
    }

    if (!parsed || !parsed.isEvent || !parsed.title) {
      return null;
    }

    // Attach group metadata
    parsed.whatsappUrl = groupName ? `WhatsApp: ${groupName}` : "WhatsApp Group";
    return parsed;
  } catch (err) {
    console.warn("[EventExtractor] Error extracting event:", err.message);
    return null;
  }
}
