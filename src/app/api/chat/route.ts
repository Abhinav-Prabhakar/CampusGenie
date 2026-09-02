import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRetry } from "@/lib/llm";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { streamGenieConversation } from "@/lib/genie";
import { checkRateLimit } from "@/lib/rateLimiter";

export const runtime = "nodejs";

async function canAnswerWithGenie(prompt: string, signal: AbortSignal): Promise<boolean> {
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return false;

  const response = await fetchWithAutoRetry(endpoint, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Classify whether the user request can be answered entirely by a read-only Databricks Genie Agent. Genie can only query existing data. Return JSON only: {\"canUseGenie\":true|false}. Return false for any request to create, update, delete, set, submit, order, RSVP, register, apply, approve, send, or otherwise take an action, including mixed read-and-write requests.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") return false;
  try {
    const parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
    return parsed.canUseGenie === true;
  } catch {
    return false;
  }
}

function createGenieResponse(req: NextRequest, prompt: string) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: unknown) => {
        if (!req.signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await streamGenieConversation(prompt, req.signal, send);
        send({ type: "tool_status", toolName: "genie_agent", label: "Campus Genie Agent complete", active: false });
        if (!req.signal.aborted) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error: any) {
        if (!req.signal.aborted) send({ error: error?.message || "Genie Agent request failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

async function getCampusEventsPromptSnippet(): Promise<string> {
  try {
    const res = await executeLakehouseSql(
      "SELECT * FROM workspace.campus_explorer.campus_events ORDER BY event_date ASC, start_time ASC",
      undefined,
      30
    );
    if (res.state === "SUCCEEDED" && Array.isArray(res.records) && res.records.length > 0) {
      return res.records
        .map((r: any) => {
          const id = r.event_id || r.id || "";
          const cleanId = String(id).toUpperCase().replace(/^EV(\d+)$/, "EV-$1");
          const tags = Array.isArray(r.tags) ? r.tags.join(", ") : r.tags || "";
          return `- [${cleanId}] "${r.title}" | Category: ${r.category} | Date: ${r.event_date || ""} ${r.start_time || ""} | Location: ${r.location} | Host: ${r.host_organization || r.host} | Food: ${r.food_provided ? "Yes" : "No"} | Tags: ${tags} | Desc: ${r.description || ""}`;
        })
        .join("\n");
    }
  } catch (e) {
    console.error("Failed to query Lakehouse events for prompt snippet:", e);
  }
  return "No live Lakehouse event records are available. Do not invent events or event IDs.";
}

function buildSystemPrompt(eventsSnippet: string): string {
  return `You are "Campus Genie", the official AI lakehouse intelligence assistant for Databricks University powered natively by Databricks Lakehouse with Unity Catalog (workspace.campus_explorer schema).
You help university students explore campus events, courses, attendance tracking, academic recovery plans, research labs, student clubs, hackathons, surveys, alumni career pathways, and student administrative workflows.

CRITICAL SCOPE & RELEVANCE ENFORCEMENT:
- You must ONLY answer questions and assist with topics strictly relevant to Databricks University campus life, academics, courses, attendance, recovery plans, student clubs, hackathons, campus navigation, Lakehouse data queries, and student administrative tasks.
- You must NOT answer questions that are completely irrelevant to the campus, academics, or university operations (such as general pop-culture trivia, non-campus political discussions, unrelated coding questions, celebrity gossip, or general creative writing).
- If a user prompt is outside the scope of campus life and university operations, politely decline to answer and guide them back to campus events, coursework, attendance, or academic resources.

LIVE CAMPUS EVENTS DIRECTORY (Delta Table: workspace.campus_explorer.campus_events):
${eventsSnippet}

RESPONSE FORMAT & CARD SELECTION (STRICT RULES):
1. First, provide your helpful, friendly, natural markdown response directly answering the student's question or recommendation request. Mention event details (e.g. title, date, time, location, perks).
2. At the very end of your response, ALWAYS output a structured JSON block specifying the exact event IDs you recommended or referenced so the interface can render the interactive cards:
\`\`\`json
{
  "eventIds": ["EV-10", "EV-01"]
}
\`\`\`
If no campus events are relevant or referenced in your answer, provide an empty list:
\`\`\`json
{
  "eventIds": []
}
\`\`\`
3. If the student asks for a multi-step survey or preference questionnaire, you can include a "survey" key in that JSON block:
\`\`\`json
{
  "eventIds": ["EV-10"],
  "survey": [
    { "id": "q1", "q": "What track are you interested in?", "type": "radio", "options": ["AI / Lakehouse", "Web3 / Systems", "Design / UI"] }
  ]
}
\`\`\`
`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Quota & Rate Limiter Check (RPM & RPD)
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "client_user";

    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit quota exceeded (${rateLimitCheck.limitType === "RPM" ? "Requests per minute limit reached" : "Daily prompt quota reached"}). Please wait before sending more prompts.`,
          rateLimit: {
            isBlocked: true,
            limitType: rateLimitCheck.limitType,
            retryAfterSeconds: rateLimitCheck.retryAfterSeconds || 60,
            resetAt: rateLimitCheck.resetAt || Date.now() + 60000,
          },
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      messages = [],
      model: inputModel,
      provider: inputProvider = "openai",
      routingMode = "auto", // "auto" | "genie" | "gemini" | "qwen"
      customApiKey,
      customBaseUrl,
    } = body;

    const latestPrompt = [...messages].reverse().find((message: { role?: string }) => message.role === "user")?.content;

    // 2. Routing Mode Resolution
    // Mode "genie": Force Databricks Genie Space directly
    if (routingMode === "genie" && latestPrompt) {
      return createGenieResponse(req, latestPrompt);
    }

    // Mode "auto": Auto-classify read-only queries to Genie, updates to Gemini/App LLM
    const requestsGenie = routingMode === "auto" && (inputModel === "env-default" || inputModel === "databricks-genie-agent" || inputProvider === "databricks");
    const routeToGenie = requestsGenie && latestPrompt ? await canAnswerWithGenie(latestPrompt, req.signal) : false;
    if (routeToGenie && latestPrompt) return createGenieResponse(req, latestPrompt);

    // Mode "gemini" or App LLM execution
    const model = (requestsGenie || !inputModel || inputModel === "env-default" || inputModel === "gemini" || inputModel === "qwen")
      ? (process.env.LLM_MODEL || process.env.NEXT_PUBLIC_DEFAULT_MODEL || "gemini-3.6-flash")
      : inputModel;

    let provider = requestsGenie && !routeToGenie ? "custom" : inputProvider;
    if (provider === "custom" && !customBaseUrl && !process.env.LLM_BASE_URL) {
      const lower = model.toLowerCase();
      if (lower.includes("gemini")) provider = "gemini";
      else if (lower.includes("claude")) provider = "anthropic";
      else if (lower.includes("databricks") || lower.includes("dbrx")) provider = "databricks";
      else if (lower.includes("llama") && !process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) provider = "ollama";
      else provider = "openai";
    }

    const apiKey =
      customApiKey ||
      process.env.LLM_API_KEY ||
      (provider === "databricks" ? process.env.DATABRICKS_TOKEN : undefined) ||
      (provider === "openai" ? process.env.OPENAI_API_KEY : undefined) ||
      (provider === "gemini" ? process.env.GEMINI_API_KEY : undefined) ||
      (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined);

    let baseUrl = customBaseUrl || process.env.LLM_BASE_URL;
    let endpoint = "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!baseUrl) {
      if (provider === "databricks") {
        const host = process.env.DATABRICKS_HOST || "https://adb-default.cloud.databricks.com";
        baseUrl = host.replace(/\/+$/, "");
        endpoint = `${baseUrl}/serving-endpoints/${model}/invocations`;
      } else if (provider === "gemini") {
        baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
        endpoint = `${baseUrl}/chat/completions`;
      } else if (provider === "ollama") {
        baseUrl = "http://localhost:11434/v1";
        endpoint = `${baseUrl}/chat/completions`;
      } else if (provider === "anthropic") {
        baseUrl = "https://api.anthropic.com/v1";
        endpoint = `${baseUrl}/messages`;
      } else {
        baseUrl = "https://api.openai.com/v1";
        endpoint = `${baseUrl}/chat/completions`;
      }
    } else {
      const cleanBase = baseUrl.replace(/\/+$/, "");
      if (cleanBase.endsWith("/chat/completions") || cleanBase.endsWith("/messages") || cleanBase.endsWith("/invocations")) {
        endpoint = cleanBase;
      } else {
        endpoint = `${cleanBase}/chat/completions`;
      }
    }

    if (apiKey) {
      if (provider === "anthropic" && endpoint.includes("api.anthropic.com")) {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    // Dynamic prompt with live events catalog embedded directly (no tool calls required!)
    const eventsSnippet = await getCampusEventsPromptSnippet();
    const systemPrompt = buildSystemPrompt(eventsSnippet);

    const conversationMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Direct LLM stream (no function tool calls to prevent Qwen stalls)
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const sendEvent = (data: any) => {
          if (req.signal.aborted) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const payload = {
            model,
            messages: conversationMessages,
            stream: true,
            temperature: 0.3,
          };

          const upstreamRes = await fetchWithAutoRetry(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: req.signal,
          });

          if (!upstreamRes.ok || !upstreamRes.body) {
            const errText = await upstreamRes.text().catch(() => "");
            sendEvent({
              error: `Upstream error (${upstreamRes.status}): ${errText}`,
            });
            controller.close();
            return;
          }

          const reader = upstreamRes.body.getReader();
          let lineBuffer = "";
          let fullAssistantContent = "";

          while (true) {
            if (req.signal.aborted) {
              await reader.cancel();
              return;
            }
            const { done, value } = await reader.read();
            if (done) break;

            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              const dataStr = trimmed.replace(/^data: /, "").trim();
              if (dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta;

                if (delta?.reasoning_content || delta?.reasoning || delta?.thinking || delta?.thought) {
                  const r = delta.reasoning_content || delta.reasoning || delta.thinking || delta.thought;
                  sendEvent({
                    choices: [{ delta: { reasoning_content: r } }],
                  });
                }

                if (delta?.content) {
                  fullAssistantContent += delta.content;
                  sendEvent({
                    choices: [{ delta: { content: delta.content } }],
                  });
                }
              } catch {
                // ignore partial stream JSON parse errors
              }
            }
          }

          // Check if assistant provided event IDs or survey JSON block and emit show_events_grid / ask_questions
          const jsonMatch = fullAssistantContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              if (Array.isArray(parsed.eventIds) && parsed.eventIds.length > 0) {
                sendEvent({
                  choices: [{
                    delta: {
                      tool_calls: [{
                        index: 0,
                        id: `events_grid_${Date.now()}`,
                        function: {
                          name: "show_events_grid",
                          arguments: JSON.stringify({ eventIds: parsed.eventIds }),
                        },
                      }],
                    },
                  }],
                });
              }
              if (parsed.survey || parsed.questions) {
                sendEvent({
                  choices: [{
                    delta: {
                      tool_calls: [{
                        index: 1,
                        id: `survey_${Date.now()}`,
                        function: {
                          name: "ask_questions",
                          arguments: JSON.stringify(parsed.survey || parsed.questions),
                        },
                      }],
                    },
                  }],
                });
              }
            } catch {}
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (streamErr: any) {
          sendEvent({ error: streamErr?.message || "Stream processing error" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[Chat API Error]", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
