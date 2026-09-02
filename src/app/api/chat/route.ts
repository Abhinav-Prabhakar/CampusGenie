import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRetry } from "@/lib/llm";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { streamGenieConversation } from "@/lib/genie";
import { checkRateLimit } from "@/lib/rateLimiter";

export const runtime = "nodejs";

// ─── Campus Tool Definitions ────────────────────────────────────────────────

const CAMPUS_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_campus_data",
      description:
        "Execute a SELECT SQL query on the Databricks Lakehouse campus_explorer schema. Use this to look up events by date/category/keyword, fetch source content, check surveys, etc. Always use this before showing events.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description:
              "A valid SELECT SQL statement. Available tables in workspace.campus_explorer schema:\n" +
              "- campus_events: event_id (e.g. 'EV-01'), title, category ('hackathon'|'workshop'|'social'|'career'|'meeting'|'sports'), event_date (DATE, format YYYY-MM-DD), start_time (STRING), end_time, location, host_organization, description, food_provided (BOOLEAN), registered_count (INT), capacity (INT), tags (ARRAY<STRING>), is_virtual (BOOLEAN)\n" +
              "- knowledge_sources: source_id (e.g. 'DOC-01'), name, type, category, description, content_sample, uploaded_by, updated_at\n" +
              "- campus_surveys: survey_id, title, description, target_event_id, is_published, is_featured, questions_json\n" +
              "Example: SELECT event_id, title, event_date FROM campus_events WHERE event_date = '2026-09-10' ORDER BY start_time",
          },
        },
        required: ["sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_event_cards",
      description:
        "Render interactive event cards in the chat UI. Call this AFTER querying campus_events to display matching events visually with RSVP/save buttons. Pass the exact event_id values from your query results.",
      parameters: {
        type: "object",
        properties: {
          event_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of event_id values from campus_events table, e.g. ['EV-01', 'EV-10']. Must be exact IDs from query results.",
          },
        },
        required: ["event_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user_questions",
      description:
        "Present the user with MCQ questions to gather preferences before making a tailored recommendation. Use when you need to clarify the student's interests, availability, or tech stack.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            description: "List of questions to ask the user",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique question ID e.g. 'q1'" },
                q: { type: "string", description: "The question text" },
                type: {
                  type: "string",
                  enum: ["radio", "check"],
                  description: "radio = single choice, check = multiple choice",
                },
                options: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of answer choices",
                },
              },
              required: ["id", "q", "type", "options"],
            },
          },
        },
        required: ["questions"],
      },
    },
  },
];

// ─── Table Schema Summary for System Prompt ──────────────────────────────────

function buildSystemPrompt(sourcesSnippet: string): string {
  return `You are "Campus Genie", the official AI lakehouse intelligence assistant for Databricks University powered by Databricks Lakehouse with Unity Catalog (workspace.campus_explorer schema).
You help university students explore campus events, courses, attendance tracking, academic recovery plans, research labs, student clubs, hackathons, surveys, alumni career pathways, and student administrative workflows.

CRITICAL SCOPE ENFORCEMENT:
- ONLY answer questions relevant to campus life, academics, courses, attendance, clubs, hackathons, campus navigation, Lakehouse data queries, and student administrative tasks.
- Politely decline off-topic requests (pop-culture trivia, non-campus politics, celebrity gossip, unrelated coding).

CAMPUS DATA ACCESS:
You have access to the campus_explorer Lakehouse schema via the query_campus_data tool. ALWAYS call this tool to look up data before answering data-specific questions — never guess or invent event/source IDs.

For ANY question about specific events (dates, categories, keywords), you MUST:
1. Call query_campus_data with a precise SQL WHERE clause
2. Inspect the results (event_ids returned)
3. Call show_event_cards with the exact event_ids from step 2
4. Then provide your natural language response referencing those events

KNOWLEDGE SOURCES IN LAKEHOUSE:
${sourcesSnippet}
You can query more details from any source using: SELECT content_sample FROM workspace.campus_explorer.knowledge_sources WHERE source_id = 'DOC-XX'

SURVEY / MCQ:
If the student asks you to help them choose between options, recommend events, or guide them through preferences, call ask_user_questions first to gather their context.

RESPONSE STYLE:
- Friendly, knowledgeable campus AI persona
- Use markdown for formatting (headers, bold, bullets)
- Be concise and actionable
- Always confirm data with a Lakehouse query before stating facts
`;
}

// ─── Source Snippet ──────────────────────────────────────────────────────────

async function getSourcesSnippet(): Promise<string> {
  try {
    const res = await executeLakehouseSql(
      "SELECT source_id, name, category, description FROM workspace.campus_explorer.knowledge_sources ORDER BY updated_at DESC",
      undefined,
      20
    );
    if (res.state === "SUCCEEDED" && Array.isArray(res.records) && res.records.length > 0) {
      return res.records
        .map((r: any) => `- [${r.source_id}] "${r.name}" (${r.category}): ${(r.description || "").slice(0, 120)}`)
        .join("\n");
    }
  } catch (e) {
    console.warn("Failed to fetch sources for system prompt:", e);
  }
  return "No sources currently indexed. Students can upload PDFs and documents via the Sources tab.";
}

// ─── Genie Mode ──────────────────────────────────────────────────────────────

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

async function canAnswerWithGenie(prompt: string, signal: AbortSignal): Promise<boolean> {
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return false;

  try {
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
            content:
              'Classify whether the user request can be answered entirely by a read-only Databricks Genie Agent. Return JSON only: {"canUseGenie":true|false}. Return false for action requests (RSVP, register, submit, create, update, delete).',
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return false;
    const parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
    return parsed.canUseGenie === true;
  } catch {
    return false;
  }
}

// ─── Tool Execution ───────────────────────────────────────────────────────────

async function executeToolCall(
  toolName: string,
  toolArgs: any
): Promise<{ content: string; sseEvents: any[] }> {
  const sseEvents: any[] = [];

  if (toolName === "query_campus_data") {
    const sql = toolArgs.sql as string;
    if (!sql || !sql.trim().toUpperCase().startsWith("SELECT")) {
      return { content: "Error: Only SELECT queries are allowed.", sseEvents };
    }
    try {
      const result = await executeLakehouseSql(sql, undefined, 15);
      if (result.state === "SUCCEEDED" && result.records) {
        const rows = result.records.slice(0, 30);
        const content = rows.length === 0
          ? "Query returned 0 rows. No matching records found."
          : `Query returned ${rows.length} row(s):\n${JSON.stringify(rows, null, 2)}`;
        return { content, sseEvents };
      } else {
        return {
          content: `Query failed with state: ${result.state}. Error: ${result.error || "Unknown error"}`,
          sseEvents,
        };
      }
    } catch (e: any) {
      return { content: `SQL execution error: ${e.message}`, sseEvents };
    }
  }

  if (toolName === "show_event_cards") {
    const eventIds = Array.isArray(toolArgs.event_ids) ? toolArgs.event_ids : [];
    // Normalize IDs (handle EV01 → EV-01)
    const normalized = eventIds.map((id: string) =>
      String(id).trim().toUpperCase().replace(/^EV(\d+)$/, "EV-$1")
    );
    sseEvents.push({ type: "events_grid", eventIds: normalized });
    return {
      content: `Event cards displayed for: ${normalized.join(", ")}`,
      sseEvents,
    };
  }

  if (toolName === "ask_user_questions") {
    const questions = toolArgs.questions;
    if (Array.isArray(questions) && questions.length > 0) {
      sseEvents.push({ type: "survey", questions });
    }
    return {
      content: `Survey questions presented to the user (${Array.isArray(questions) ? questions.length : 0} questions).`,
      sseEvents,
    };
  }

  return { content: `Unknown tool: ${toolName}`, sseEvents };
}

// ─── Main POST Handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "client_user";
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit quota exceeded (${
            rateLimitCheck.limitType === "RPM"
              ? "Requests per minute limit reached"
              : "Daily prompt quota reached"
          }). Please wait before sending more prompts.`,
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
      routingMode = "auto",
      customApiKey,
      customBaseUrl,
    } = body;

    const latestPrompt = [...messages]
      .reverse()
      .find((m: { role?: string }) => m.role === "user")?.content;

    // Genie routing
    if (routingMode === "genie" && latestPrompt) {
      return createGenieResponse(req, latestPrompt);
    }
    const requestsGenie =
      routingMode === "auto" &&
      (inputModel === "env-default" ||
        inputModel === "databricks-genie-agent" ||
        inputProvider === "databricks");
    const routeToGenie =
      requestsGenie && latestPrompt
        ? await canAnswerWithGenie(latestPrompt, req.signal)
        : false;
    if (routeToGenie && latestPrompt) return createGenieResponse(req, latestPrompt);

    // Resolve model + provider
    const model =
      requestsGenie || !inputModel || inputModel === "env-default" || inputModel === "gemini" || inputModel === "qwen"
        ? process.env.LLM_MODEL || process.env.NEXT_PUBLIC_DEFAULT_MODEL || "gemini-2.5-flash"
        : inputModel;

    let provider =
      requestsGenie && !routeToGenie ? "custom" : inputProvider;
    if (provider === "custom" && !customBaseUrl && !process.env.LLM_BASE_URL) {
      const lower = model.toLowerCase();
      if (lower.includes("gemini")) provider = "gemini";
      else if (lower.includes("claude")) provider = "anthropic";
      else if (lower.includes("databricks") || lower.includes("dbrx")) provider = "databricks";
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
    const headers: Record<string, string> = { "Content-Type": "application/json" };

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
      endpoint =
        cleanBase.endsWith("/chat/completions") || cleanBase.endsWith("/messages") || cleanBase.endsWith("/invocations")
          ? cleanBase
          : `${cleanBase}/chat/completions`;
    }

    if (apiKey) {
      if (provider === "anthropic" && endpoint.includes("api.anthropic.com")) {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    // Build system prompt with sources
    const sourcesSnippet = await getSourcesSnippet();
    const systemPrompt = buildSystemPrompt(sourcesSnippet);

    // Determine if this provider supports tool calling
    // Gemini via OpenAI-compat does support tools; Anthropic has its own format
    const supportsTools = provider !== "anthropic" && provider !== "ollama";

    // SSE stream with multi-turn tool execution loop
    const responseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const sendEvent = (data: any) => {
          if (req.signal.aborted) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Multi-turn conversation with tool execution
          let conversationMessages: any[] = [
            { role: "system", content: systemPrompt },
            ...messages,
          ];

          let iterationCount = 0;
          const MAX_TOOL_ITERATIONS = 5;

          while (iterationCount < MAX_TOOL_ITERATIONS) {
            iterationCount++;

            const payload: any = {
              model,
              messages: conversationMessages,
              stream: true,
              temperature: 0.3,
            };

            // Add tools if supported
            if (supportsTools) {
              payload.tools = CAMPUS_TOOLS;
              payload.tool_choice = "auto";
            }

            if (req.signal.aborted) break;

            const upstreamRes = await fetchWithAutoRetry(endpoint, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
              signal: req.signal,
            });

            if (!upstreamRes.ok || !upstreamRes.body) {
              const errText = await upstreamRes.text().catch(() => "");
              sendEvent({ error: `Upstream error (${upstreamRes.status}): ${errText}` });
              break;
            }

            // Read the streaming response
            const reader = upstreamRes.body.getReader();
            let lineBuffer = "";
            let assistantContent = "";
            let assistantThinking = "";
            let finishReason = "";
            const toolCallMap = new Map<number, { id: string; name: string; args: string }>();

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
                const dataStr = trimmed.slice(6).trim();
                if (dataStr === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(dataStr);
                  const choice = parsed.choices?.[0];
                  const delta = choice?.delta;
                  finishReason = choice?.finish_reason || finishReason;

                  // Reasoning content
                  if (delta?.reasoning_content || delta?.reasoning || delta?.thinking) {
                    const r = delta.reasoning_content || delta.reasoning || delta.thinking;
                    assistantThinking += r;
                    sendEvent({ choices: [{ delta: { reasoning_content: r } }] });
                  }

                  // Text content
                  if (delta?.content) {
                    assistantContent += delta.content;
                    sendEvent({ choices: [{ delta: { content: delta.content } }] });
                  }

                  // Tool calls (streamed in chunks)
                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      const existing = toolCallMap.get(idx) || { id: "", name: "", args: "" };
                      if (tc.id) existing.id = tc.id;
                      if (tc.function?.name) existing.name = tc.function.name;
                      if (tc.function?.arguments) existing.args += tc.function.arguments;
                      toolCallMap.set(idx, existing);
                    }
                  }
                } catch {
                  // Partial JSON — skip
                }
              }
            }

            const toolCalls = Array.from(toolCallMap.values());
            const hasToolCalls = toolCalls.length > 0 && toolCalls.some((tc) => tc.name);

            if (!hasToolCalls) {
              // Terminal — no more tool calls, we're done
              break;
            }

            // Execute all tool calls
            const assistantMsg: any = {
              role: "assistant",
              content: assistantContent || null,
              tool_calls: toolCalls
                .filter((tc) => tc.name)
                .map((tc) => ({
                  id: tc.id || `call_${tc.name}_${Date.now()}`,
                  type: "function",
                  function: { name: tc.name, arguments: tc.args },
                })),
            };
            conversationMessages.push(assistantMsg);

            for (const tc of toolCalls) {
              if (!tc.name) continue;

              let toolArgs: any = {};
              try {
                toolArgs = JSON.parse(tc.args || "{}");
              } catch {
                toolArgs = {};
              }

              // Announce tool usage
              sendEvent({
                type: "tool_status",
                toolName: tc.name,
                label: tc.name === "query_campus_data"
                  ? `Querying Lakehouse: ${(toolArgs.sql || "").slice(0, 60)}...`
                  : tc.name === "show_event_cards"
                  ? `Rendering ${(toolArgs.event_ids || []).length} event cards`
                  : `Asking ${(toolArgs.questions || []).length} questions`,
                active: true,
              });

              const { content: toolResult, sseEvents } = await executeToolCall(tc.name, toolArgs);

              // Emit any UI events from the tool (events_grid, survey)
              for (const evt of sseEvents) {
                sendEvent(evt);
              }

              sendEvent({ type: "tool_status", toolName: tc.name, label: "", active: false });

              conversationMessages.push({
                role: "tool",
                tool_call_id: tc.id || `call_${tc.name}_${Date.now()}`,
                content: toolResult,
              });
            }

            // Continue loop to get the next LLM response
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err: any) {
          if (!req.signal.aborted) {
            sendEvent({ error: err?.message || "Stream processing error" });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[Chat API Error]", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
