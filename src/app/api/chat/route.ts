import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRetry, LLM_TOOLS } from "@/lib/llm";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are "Campus Genie", an AI reasoning agent powered by a Databricks Lakehouse with Unity Catalog.
You help university students explore campus life, research labs, student clubs, hackathons, alumni outcomes, and city meetups (e.g. Bengaluru tech ecosystem).

You have access to several governed tools:
1. "query_lakehouse_sql" — Run SQL against Unity Catalog Delta tables (campus_explorer.campus_events, clubs_labs, city_events, alumni_paths).
2. "show_approval_card" — Present action approval cards to the student (e.g. "Want me to place this restock order?", "Confirm RSVP & Add to Google Calendar", "Join Research Lab").
3. "show_fine_tune_card" — Present parameter adjustment sliders (e.g. "How many flavors should we launch?", "Weekly Free Hours / Bandwidth", "Extrovert vs Quiet Vibe").
4. "show_recommendation_card" — Present curated event/club recommendation cards.

Instructions:
- When a student asks about their schedule, events, or labs, invoke the appropriate tools (SQL queries, recommendation cards, or action approvals).
- If the user asks about launching flavors, restock orders, or decision planning, call "show_approval_card" or "show_fine_tune_card" with rich custom details.
- Provide data-backed answers referencing alumni outcomes and actual event timings.
- If you reason through a complex problem, share your analytical steps clearly.
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages = [],
      model = "gpt-4o",
      provider = "openai",
      customApiKey,
      customBaseUrl,
    } = body;

    // Resolve API Key
    const apiKey =
      customApiKey ||
      process.env.LLM_API_KEY ||
      (provider === "databricks" ? process.env.DATABRICKS_TOKEN : undefined) ||
      (provider === "openai" ? process.env.OPENAI_API_KEY : undefined) ||
      (provider === "gemini" ? process.env.GEMINI_API_KEY : undefined) ||
      (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined);

    // Resolve Base URL
    let baseUrl = customBaseUrl || process.env.LLM_BASE_URL;
    if (!baseUrl) {
      if (provider === "databricks") {
        const host = process.env.DATABRICKS_HOST || "https://adb-default.cloud.databricks.com";
        baseUrl = `${host.replace(/\/+$/, "")}/serving-endpoints`;
      } else if (provider === "gemini") {
        baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
      } else if (provider === "ollama") {
        baseUrl = "http://localhost:11434/v1";
      } else {
        baseUrl = "https://api.openai.com/v1";
      }
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const endpoint = `${cleanBaseUrl}/chat/completions`;

    // Format messages with system prompt
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const payload: any = {
      model,
      messages: fullMessages,
      tools: LLM_TOOLS,
      tool_choice: "auto",
      stream: true,
      temperature: 0.7,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
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
        const decoder = new TextDecoder();

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
