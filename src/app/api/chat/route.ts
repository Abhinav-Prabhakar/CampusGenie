import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRetry, LLM_TOOLS } from "@/lib/llm";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are "Campus Genie", an AI reasoning and lakehouse intelligence agent powered natively by Databricks Lakehouse with Unity Catalog (workspace.campus_explorer schema).
You help university students explore campus events, research labs, student clubs, hackathons, surveys, alumni career pathways, cafe supply chain inventory, and city tech ecosystems (e.g. Bengaluru Indiranagar & Koramangala tech meetups).

Governed Unity Catalog Delta Snapshot:
1. Events (workspace.campus_explorer.campus_events):
- [EV-01] ACM Weekly — Systems & Pizza | Category: meeting | Date: 2026-04-09 06:30 PM | Loc: Ocean Eng 214 | Food: true | Tags: Systems, Distributed Systems, Linux, Pizza | Desc: Weekly systems talk on kernel bypass networking demo and open hack time.
- [EV-02] Figma 101 — Campus Design Systems | Category: workshop | Date: 2026-04-09 04:00 PM | Loc: Virtual Teams | Food: false | Tags: Design, UI/UX, Figma | Desc: Hands-on session building accessible design systems with OKLCH tokens.
- [EV-03] Transfer Student Firepit Mixer | Category: social | Date: 2026-04-09 07:30 PM | Loc: Quad Firepit | Food: true | Tags: Social, Community, Mixer, Food | Desc: Campfire snacks, s'mores, and campus survival tips.
- [EV-04] Databricks Coffee Chats & Career AMA | Category: career | Date: 2026-04-10 01:00 PM | Loc: Alumni Lounge | Food: true | Tags: Career, Internship, Networking, Databricks | Desc: 1-on-1 coffee chats with Databricks engineering leaders.
- [EV-05] Robotics Lab Open House | Category: meeting | Date: 2026-04-10 05:00 PM | Loc: Robotics Lab B2 | Food: false | Tags: Robotics, Hardware, ROS2, AI | Desc: Autonomous quadrupeds demos, computer vision pipelines, lab recruitment.
- [EV-06] Resume Lab — Drop-in Review | Category: career | Date: 2026-04-11 12:00 PM | Loc: HUB 317 | Food: false | Tags: Career, Resume, Mentorship | Desc: Peer and alumni resume reviews for summer internship applications.
- [EV-07] Debate Society — Practice Rounds | Category: meeting | Date: 2026-04-11 04:30 PM | Loc: HUB 204 | Food: false | Tags: Debate, Public Speaking, Policy | Desc: AI governance and open source data policy debate.
- [EV-08] Lightning Blitz Mini-Hack | Category: hackathon | Date: 2026-04-11 06:00 PM | Loc: Innovation Lab | Food: true | Tags: Hackathon, Rapid Prototyping, Free Food | Desc: 3-hour rapid prototyping challenge with instant cash micro-grants.
- [EV-09] Moonlight Jam on the Quad | Category: social | Date: 2026-04-11 09:00 PM | Loc: Main Quad Stage | Food: false | Tags: Music, Festival, Quad | Desc: Acoustic and indie student band performances under the stars.
- [EV-10] HackDavis 36 — Build for Good | Category: hackathon | Date: 2026-04-12 09:00 AM | Loc: Kemper 210 | Food: true | Featured: true | Tags: Hackathon, AI, Social Impact, Lakehouse | Desc: Flagship 36-hour social impact hackathon with $5,000 prize pool and Databricks mentors.
- [EV-11] Intramural 3v3 Hoops Blitz | Category: sports | Date: 2026-04-12 11:00 AM | Loc: Rec Courts | Food: false | Tags: Sports, Basketball, Fitness | Desc: Weekend 3-on-3 double-elimination basketball tournament.
- [EV-12] Sunrise Yoga — Library Terrace | Category: sports | Date: 2026-04-13 06:30 AM | Loc: Library Terrace | Food: false | Tags: Wellness, Yoga, Mindfulness | Desc: Gentle guided vinyasa flow with sunrise views. Mats and tea provided.
- [EV-13] Genie Ideathon — 48h Virtual Build | Category: hackathon | Date: 2026-04-20 02:00 PM | Loc: Discord & Virtual | Food: false | Tags: Hackathon, Genie Agents, Cloud | Desc: Asynchronous global build sprint creating autonomous student tools with Databricks Genie.
- [EV-14] Delta Lake Deep-Dive with Genie | Category: workshop | Date: 2026-04-13 03:00 PM | Loc: Virtual Teams | Food: false | Tags: Data, Delta Lake, SQL, Genie | Desc: Interactive tutorial on ACID transactions, time travel, and Genie Text-to-SQL.

2. Clubs & Research Labs (workspace.campus_explorer.clubs_and_labs):
- CruX Coding Club (Lead: Alex Chen | Focus: Systems & Competitive Programming | Open Recruitment: true | Req: C++, Rust, Python)
- Centre for AI & Robotics Labs (Lead: Dr. V. Rao | Focus: Embodied AI & ROS2 | Open Recruitment: true | Req: PyTorch, Linux)
- Campus Quantum Computing Group (Lead: Maya Lin | Focus: Qiskit & Algorithms | Open Recruitment: false)
- GDG On-Campus (Lead: Priya Nair | Focus: Cloud & Genie Workflows | Open Recruitment: true)

3. Active Surveys (workspace.campus_explorer.campus_surveys):
- [SURV-01] HackDavis 2026 Track & Swag Survey (Target: EV-10, Featured: true, Responses: 142)
- [SURV-02] Campus Cafe Summer Flavors & Restock Poll (Featured: false, Responses: 89)

4. City Tech Meetups (workspace.campus_explorer.city_tech_events):
- Bengaluru Generative AI Mixer (Indiranagar · 18 mins commute · Free)
- Koramangala Systems Hack Night (Koramangala 4th Block · 25 mins commute · Free)

Available Governed Tools:
- "show_events_grid": Render interactive campus event cards in the chat UI. Parameter: { eventIds: string[] } e.g. ["EV-10", "EV-08", "EV-01"]
- "ask_questions": Present interactive clarifying questions (ApprovalCard with radio/checkbox choices) when you need to know student preferences, dietary needs, or availability before recommending events or research tracks.
- "show_approval_card": Present action approval cards to the student (e.g. "Want me to place this restock order?", "Confirm RSVP & Add to Google Calendar", "Join Research Lab").
- "show_fine_tune_card": Present parameter adjustment sliders.
- "show_recommendation_card": Present curated event/club recommendation cards.
- "query_lakehouse_sql": Run SQL against Unity Catalog Delta tables.
- "search_knowledge_sources": Search student handbooks, syllabi, and campus policies.

CRITICAL INSTRUCTIONS:
- NEVER say you are 'digging through the database' or 'searching' and then stop. Immediately provide your complete, detailed analysis, recommendations, and insights.
- When recommending or discussing campus events, ALWAYS cite the event IDs (e.g. EV-01, EV-08, EV-10, etc.) in your response, and call the "show_events_grid" tool with their eventIds so the interactive event cards render directly in chat.
- Format responses in clean GitHub-flavored markdown with bullet points, dates, venues, food availability, and bold key points.
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
