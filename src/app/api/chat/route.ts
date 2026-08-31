import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRetry, LLM_TOOLS } from "@/lib/llm";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are "Campus Genie", an AI reasoning agent powered by a Databricks Lakehouse with Unity Catalog (workspace.campus_explorer schema).
You help university students explore campus life, research labs, student clubs, hackathons, alumni career pathways, and city tech meetups (e.g. Bengaluru Indiranagar & Koramangala tech ecosystems).

Governed Unity Catalog Delta Tables:
1. workspace.campus_explorer.campus_events (event_id, title, category, host_organization, location, is_virtual, event_date, start_time, duration, capacity, registered_count, food_provided, tags, description)
2. workspace.campus_explorer.clubs_and_labs (entity_id, name, type, faculty_lead, student_lead, primary_focus, recruitment_open, weekly_commitment_hrs, required_skills, meeting_schedule, location, contact_email, open_projects)
3. workspace.campus_explorer.city_tech_events (meetup_id, title, organizer, neighborhood, venue_address, event_date, start_time, entry_fee_inr, attendee_count, domain, commute_mins_from_campus)
4. workspace.campus_explorer.alumni_career_pathways (alumni_id, graduation_year, major, campus_clubs_joined, research_labs_joined, first_job_title, first_company, current_role, current_organization, primary_domain, advice_summary)
5. workspace.campus_explorer.procurement_inventory (item_id, item_name, category, current_stock, min_reorder_threshold, preferred_supplier, unit_price_inr, lead_time_days, last_restock_date)

Available Governed Tools:
- "query_lakehouse_sql" — Run SQL against Unity Catalog Delta tables.
- "show_approval_card" — Present action approval cards to the student (e.g. "Want me to place this restock order?", "Confirm RSVP & Add to Google Calendar", "Join Research Lab").
- "show_fine_tune_card" — Present parameter adjustment sliders (e.g. "How many flavors should we launch?", "Weekly Free Hours / Bandwidth", "Extrovert vs Quiet Vibe").
- "show_recommendation_card" — Present curated event/club recommendation cards.

Instructions:
- When students ask about events, research labs, alumni outcomes, or cafe inventory, reason step-by-step and cite accurate data from the lakehouse.
- Format responses in clean GitHub-flavored markdown with bullet points, tables, bold key points, or code snippets when helpful.
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

    // Resolve actual model name (defaults to .env LLM_MODEL)
    const model = (!inputModel || inputModel === "env-default")
      ? (process.env.LLM_MODEL || process.env.NEXT_PUBLIC_DEFAULT_MODEL || "gpt-4o")
      : inputModel;

    let provider = inputProvider;
    if (provider === "custom" && !customBaseUrl && !process.env.LLM_BASE_URL) {
      const lower = model.toLowerCase();
      if (lower.includes("gemini")) provider = "gemini";
      else if (lower.includes("claude")) provider = "anthropic";
      else if (lower.includes("databricks") || lower.includes("dbrx")) provider = "databricks";
      else if (lower.includes("llama") && !process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) provider = "ollama";
      else provider = "openai";
    }

    // Resolve API Key from custom input or environment variables
    const apiKey =
      customApiKey ||
      process.env.LLM_API_KEY ||
      (provider === "databricks" ? process.env.DATABRICKS_TOKEN : undefined) ||
      (provider === "openai" ? process.env.OPENAI_API_KEY : undefined) ||
      (provider === "gemini" ? process.env.GEMINI_API_KEY : undefined) ||
      (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined);

    // Resolve Base URL
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

    // Set authorization headers
    if (apiKey) {
      if (provider === "anthropic" && endpoint.includes("api.anthropic.com")) {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    // Format messages with system prompt
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    let payload: any = {
      model,
      messages: fullMessages,
      tools: LLM_TOOLS,
      tool_choice: "auto",
      stream: true,
      temperature: 0.7,
    };

    // Special payload adaptation for Anthropic direct endpoint if not using proxy
    if (provider === "anthropic" && endpoint.includes("api.anthropic.com")) {
      payload = {
        model,
        system: SYSTEM_PROMPT,
        messages: messages.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        max_tokens: 4096,
        stream: true,
      };
    }

    // Execute with auto-retry (3 attempts, exponential backoff)
    let upstreamRes: Response;
    try {
      upstreamRes = await fetchWithAutoRetry(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `Failed to connect to ${provider} endpoint (${endpoint}) after 3 auto-retries: ${err.message}`,
          provider,
          endpoint,
        },
        { status: 502 }
      );
    }

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      return NextResponse.json(
        {
          error: `API error from ${provider} (${upstreamRes.status} ${upstreamRes.statusText}): ${errorText}`,
          status: upstreamRes.status,
          provider,
          endpoint,
        },
        { status: upstreamRes.status }
      );
    }

    // Stream the SSE response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        if (!upstreamRes.body) {
          controller.close();
          return;
        }
        const reader = upstreamRes.body.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (streamErr) {
          controller.error(streamErr);
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
