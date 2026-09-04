import { CONFIG } from "./config.js";

const VALID_CATEGORIES = new Set(["hackathon", "workshop", "social", "career", "meeting", "sports"]);

function toBool(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "yes";
}

/**
 * Format a Date's calendar components in LOCAL time as YYYY-MM-DD.
 * toISOString() would shift the day for date-only strings parsed in
 * non-UTC timezones (e.g. "March 14, 2026" at UTC+5:30 becoming March 13).
 */
function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Coerce an LLM-provided date to a strict YYYY-MM-DD string.
 * ISO strings pass through untouched; anything else is parsed and read back
 * in local calendar time; unparseable input falls back to today.
 */
function toIsoDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return localDateKey(parsed);
  }
  return localDateKey(new Date());
}

/**
 * Normalize an LLM-extracted event payload into values the Lakehouse INSERT
 * can accept: strict YYYY-MM-DD dates, a known category, and scalar types.
 * Returns null when the payload is not a usable event.
 */
export function normalizeEventPayload(payload) {
  if (!payload || payload.isEvent !== true || !payload.title) return null;

  // Accept flexible date strings ("March 14, 2026", "14/03/2026", ISO) and
  // coerce to YYYY-MM-DD so DATE literals never fail; fall back to today.
  const eventDate = toIsoDate(payload.eventDate);

  const category = String(payload.category || "social").toLowerCase();

  return {
    ...payload,
    eventDate,
    category: VALID_CATEGORIES.has(category) ? category : "social",
    capacity: Number.isFinite(Number(payload.capacity)) ? Math.max(1, Math.floor(Number(payload.capacity))) : 100,
    isVirtual: toBool(payload.isVirtual),
    foodProvided: toBool(payload.foodProvided),
  };
}

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

    // Attach group metadata and normalize fields for ingestion
    parsed.whatsappUrl = groupName ? `WhatsApp: ${groupName}` : "WhatsApp Group";
    return normalizeEventPayload(parsed);
  } catch (err) {
    console.warn("[EventExtractor] Error extracting event:", err.message);
    return null;
  }
}
