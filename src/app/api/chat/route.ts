import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRetry, LLM_TOOLS } from "@/lib/llm";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { streamGenieConversation } from "@/lib/genie";

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

const SYSTEM_PROMPT = `You are "Campus Genie", an AI lakehouse intelligence agent powered natively by Databricks Lakehouse with Unity Catalog (workspace.campus_explorer schema).
You help university students explore campus events, research labs, student clubs, hackathons, surveys, alumni career pathways, cafe supply chain inventory, and city tech ecosystems (e.g. Bengaluru Indiranagar & Koramangala tech meetups).

Governed Unity Catalog Delta Tables in schema 'workspace.campus_explorer':
1. workspace.campus_explorer.campus_events (event_id, title, category, host_organization, host_code, location, is_virtual, event_date, start_time, duration, capacity, registered_count, food_provided, is_featured, status, visibility, tags, description)
2. workspace.campus_explorer.campus_surveys (survey_id, title, description, target_event_id, is_published, is_featured, audience, response_count, questions_json)
3. workspace.campus_explorer.knowledge_sources (source_id, name, type, category, description, chunk_count, file_size, status, content_sample, uploaded_by)
4. workspace.campus_explorer.clubs_and_labs (entity_id, name, type, faculty_lead, student_lead, primary_focus, recruitment_open, weekly_commitment_hrs, required_skills, meeting_schedule, location, contact_email, open_projects)
5. workspace.campus_explorer.city_tech_events (meetup_id, title, organizer, neighborhood, venue_address, event_date, start_time, entry_fee_inr, attendee_count, domain, commute_mins_from_campus)
6. workspace.campus_explorer.alumni_career_pathways (alumni_id, graduation_year, major, campus_clubs_joined, research_labs_joined, first_job_title, first_company, current_role, current_organization, primary_domain, advice_summary)
7. workspace.campus_explorer.procurement_inventory (item_id, item_name, category, current_stock, min_reorder_threshold, preferred_supplier, unit_price_inr, lead_time_days, last_restock_date)

Available Governed Tools:
- ask_questions: Trigger an interactive multi-step MCQ survey in the chat to collect student preferences, interests, experience level, dietary restrictions, event tracks, or schedule availability. Use this tool autonomously whenever the student asks for recommendations, asks to be guided, or when you need structured inputs.
- search_events: Search and display campus events by keyword, category ('hackathon' | 'workshop' | 'meeting' | 'social' | 'career' | 'sports'), food availability, or tags.
- query_lakehouse_sql: Execute SQL on Unity Catalog tables (e.g. SELECT * FROM workspace.campus_explorer.campus_events ORDER BY event_date ASC).
- search_knowledge_sources: Search documents and policies.
- show_events_grid: Render interactive campus event cards in the chat UI. Parameter: { eventIds: string[] } e.g. ["EV-10", "EV-08", "EV-01"].
- show_approval_card, show_fine_tune_card, show_recommendation_card.

Instructions:
- Autonomous Multi-Step MCQ Survey ('ask_questions'):
  1. Whenever the student wants recommendations (e.g. "Recommend a hackathon or club for me", "Help me find events for my major", "Help me choose a track"), or when multiple clarifying questions are needed, CALL 'ask_questions' with 2 to 4 structured MCQ questions.
  2. Each question must include 'q' (the question text), 'type' ('radio' for single-choice or 'check' for multi-select), and 'options' (array of choice strings).
  3. When the student completes the survey, their answers will be automatically forwarded back to you in the chat so you can provide personalized Lakehouse recommendations.
- Event Card Rules:
  1. ONLY call "show_events_grid" when the student specifically asks to view, discover, or recommend campus events, hackathons, workshops, or activities.
  2. Only provide the exact, well-matched event IDs (e.g. ['EV-10', 'EV-08']).
  3. Never call "show_events_grid" for general questions, database schemas, inventory, attendance, surveys, or unrelated topics.
- When an event query is received, call "search_events" or "query_lakehouse_sql" first, then call "show_events_grid" with the filtered IDs.
- Format responses in clean GitHub-flavored markdown.
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages = [],
      model: inputModel,
      provider: inputProvider = "openai",
      customApiKey,
      customBaseUrl,
    } = body;

    const latestPrompt = [...messages].reverse().find((message: { role?: string }) => message.role === "user")?.content;
    const requestsGenie = inputModel === "env-default" || inputModel === "databricks-genie-agent" || inputProvider === "databricks";
    const routeToGenie = requestsGenie && latestPrompt ? await canAnswerWithGenie(latestPrompt, req.signal) : false;
    if (routeToGenie && latestPrompt) return createGenieResponse(req, latestPrompt);

    const model = (requestsGenie || !inputModel || inputModel === "env-default")
      ? (process.env.LLM_MODEL || process.env.NEXT_PUBLIC_DEFAULT_MODEL || "gpt-4o")
      : inputModel;

    // If Genie classification says this needs an action, use the app's own
    // configured LLM instead of sending a write request to the read-only
    // Genie Agent.
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

    const conversationMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Stream response with tool execution loop
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const sendEvent = (data: any) => {
          if (req.signal.aborted) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          let loopCount = 0;
          const maxLoops = 3;

          while (loopCount < maxLoops) {
            loopCount++;

            // Some reasoning models emit a natural-language preamble ("I'll
            // run a query") and then stop when tool choice is left entirely
            // to them. Data-backed prompts need an actual governed lookup on
            // the first pass; after that, let the model choose how to finish.
            const payload = {
              model,
              messages: conversationMessages,
              tools: LLM_TOOLS,
              tool_choice: "auto",
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
              break;
            }

            const reader = upstreamRes.body.getReader();
            let lineBuffer = "";
            let assistantContent = "";
            let assistantThinking = "";
            const toolCallsMap = new Map<number, { id?: string; name: string; args: string }>();

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
                    assistantThinking += r;
                    sendEvent({
                      choices: [{ delta: { reasoning_content: r } }],
                    });
                  }

                  if (delta?.content) {
                    assistantContent += delta.content;
                    sendEvent({
                      choices: [{ delta: { content: delta.content } }],
                    });
                  }

                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      const cur = toolCallsMap.get(idx) || { name: "", args: "" };
                      if (tc.id) cur.id = tc.id;
                      if (tc.function?.name) cur.name = tc.function.name;
                      if (tc.function?.arguments) cur.args += tc.function.arguments;
                      toolCallsMap.set(idx, cur);
                    }
                  }
                } catch {
                  // ignore partial JSON parse during stream
                }
              }
            }

            const toolCalls = Array.from(toolCallsMap.values());
            
            // Check if any server-executable tools were called (query_lakehouse_sql, search_events, search_knowledge_sources)
            const serverToolCalls = toolCalls.filter(
              (tc) => tc.name === "query_lakehouse_sql" || tc.name === "search_events" || tc.name === "search_knowledge_sources"
            );

            // Forward UI tool calls to client if present
            const uiToolCalls = toolCalls.filter(
              (tc) => tc.name !== "query_lakehouse_sql" && tc.name !== "search_events" && tc.name !== "search_knowledge_sources"
            );
            if (uiToolCalls.length > 0) {
              sendEvent({
                choices: [{
                  delta: {
                    tool_calls: uiToolCalls.map((tc, idx) => ({
                      index: idx,
                      id: tc.id || `call_${idx}`,
                      function: { name: tc.name, arguments: tc.args },
                    })),
                  },
                }],
              });
            }

            if (serverToolCalls.length === 0) {
              // No server tools to execute; turn is complete!
              break;
            }

            // We have server tools to execute!
            conversationMessages.push({
              role: "assistant",
              content: assistantContent || null,
              tool_calls: toolCalls.map((tc, idx) => ({
                id: tc.id || `call_${idx}`,
                type: "function",
                function: { name: tc.name, arguments: tc.args },
              })),
            });

            for (const stc of serverToolCalls) {
              if (req.signal.aborted) return;
              let toolResultContent = "";
              try {
                const parsedArgs = JSON.parse(stc.args || "{}");

                if (stc.name === "search_events") {
                  sendEvent({
                    type: "tool_status",
                    toolName: "search_events",
                    label: `Searching campus events for "${parsedArgs.query || "events"}"…`,
                    active: true,
                  });

                  const queryTerm = (parsedArgs.query || "").replace(/'/g, "''").toLowerCase();
                  let whereClause = `LOWER(title) LIKE '%${queryTerm}%' OR LOWER(category) LIKE '%${queryTerm}%' OR LOWER(tags) LIKE '%${queryTerm}%' OR LOWER(description) LIKE '%${queryTerm}%'`;
                  if (parsedArgs.category && parsedArgs.category !== "all") {
                    whereClause += ` AND LOWER(category) = '${parsedArgs.category.toLowerCase()}'`;
                  }
                  if (parsedArgs.foodOnly) {
                    whereClause += ` AND food_provided = true`;
                  }

                  const sql = `SELECT * FROM workspace.campus_explorer.campus_events WHERE ${whereClause} ORDER BY event_date ASC LIMIT 10`;
                  const queryRes = await executeLakehouseSql(sql);
                  const records = queryRes.records || [];
                  toolResultContent = JSON.stringify(records.length > 0 ? records : queryRes);

                  // Extract event IDs and immediately emit show_events_grid for the UI
                  const eventIds = records
                    .map((r: any) => r.event_id || r.id)
                    .filter((id: any) => typeof id === "string" && /^EV-?\d+$/i.test(id))
                    .map((id: string) => id.toUpperCase().replace(/^EV(\d+)$/, "EV-$1"));

                  if (eventIds.length > 0) {
                    sendEvent({
                      choices: [{
                        delta: {
                          tool_calls: [{
                            index: 0,
                            id: `events_grid_${Date.now()}`,
                            function: {
                              name: "show_events_grid",
                              arguments: JSON.stringify({ eventIds, summary: `Matched ${eventIds.length} campus events` }),
                            },
                          }],
                        },
                      }],
                    });
                  }

                  sendEvent({
                    type: "tool_status",
                    toolName: "search_events",
                    label: `Found ${records.length} campus events`,
                    active: false,
                    rowsCount: records.length,
                  });
                } else if (stc.name === "query_lakehouse_sql") {
                  sendEvent({
                    type: "tool_status",
                    toolName: "query_lakehouse_sql",
                    label: `Executing Lakehouse SQL: ${parsedArgs.query?.slice(0, 60)}…`,
                    active: true,
                  });

                  const queryRes = await executeLakehouseSql(parsedArgs.query);
                  const records = queryRes.records ?? queryRes.rows ?? [];
                  toolResultContent = JSON.stringify(
                    queryRes.state === "SUCCEEDED"
                      ? records
                      : { error: queryRes.error || `SQL execution ended with state: ${queryRes.state}` }
                  );

                  sendEvent({
                    type: "tool_status",
                    toolName: "query_lakehouse_sql",
                    label: queryRes.state === "SUCCEEDED"
                      ? `Lakehouse SQL succeeded (${queryRes.rowCount ?? (Array.isArray(records) ? records.length : 0)} rows)`
                      : `Lakehouse SQL failed: ${queryRes.error || queryRes.state}`,
                    active: false,
                    rowsCount: queryRes.rowCount,
                  });
                } else if (stc.name === "search_knowledge_sources") {
                  sendEvent({
                    type: "tool_status",
                    toolName: "search_knowledge_sources",
                    label: `Searching Knowledge Base for "${parsedArgs.query}"…`,
                    active: true,
                  });

                  const searchRes = await executeLakehouseSql(
                    `SELECT * FROM workspace.campus_explorer.knowledge_sources LIMIT 5`
                  );
                  toolResultContent = JSON.stringify(searchRes.records || []);

                  sendEvent({
                    type: "tool_status",
                    toolName: "search_knowledge_sources",
                    label: `Knowledge Base search complete`,
                    active: false,
                  });
                }
              } catch (toolErr: any) {
                toolResultContent = JSON.stringify({ error: toolErr.message });
              }

              conversationMessages.push({
                role: "tool",
                tool_call_id: stc.id || "call_0",
                content: toolResultContent,
              });
            }

            // Continue loop: Next iteration calls LLM with tool responses to stream the final answer
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
