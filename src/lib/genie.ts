import { execFile } from "child_process";
import { promisify } from "util";
import { executeLakehouseSql } from "@/lib/lakehouse";

const execFileAsync = promisify(execFile);

type GenieMessage = {
  status?: string;
  attachments?: Array<{
    attachment_id?: string;
    text?: { content?: string; purpose?: string };
    query?: { query?: string; description?: string; thoughts?: Array<{ content?: string }> };
    suggested_questions?: { questions?: string[] };
  }>;
};

type GenieConfig = {
  host: string;
  token: string;
  spaceId: string;
};

async function getDatabricksToken(): Promise<string> {
  if (process.env.DATABRICKS_TOKEN) return process.env.DATABRICKS_TOKEN;

  // Desktop-launched Next processes may not inherit the shell PATH. Keep
  // token auth as the preferred deployment path, but make local U2M auth
  // work with the standard macOS/Linux CLI locations as well.
  const candidates = [
    process.env.DATABRICKS_CLI_PATH,
    "/opt/homebrew/bin/databricks",
    "/usr/local/bin/databricks",
    "databricks",
  ].filter((path): path is string => Boolean(path));
  let lastError: unknown;
  for (const executable of candidates) {
    try {
      const { stdout } = await execFileAsync(executable, ["auth", "token"], {
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
        },
      });
      const token = JSON.parse(stdout).access_token;
      if (token) return token;
    } catch (error: any) {
      lastError = error;
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(
    `Databricks authentication is not configured. Set DATABRICKS_TOKEN${lastError instanceof Error ? ` (${lastError.message})` : ""}.`
  );
}

async function genieFetch(config: GenieConfig, path: string, init: RequestInit = {}) {
  return fetch(`${config.host}/api/2.0/genie${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function recordsFromStatementResponse(response: any): Record<string, unknown>[] {
  const statement = response?.statement_response || response;
  const columns = statement?.manifest?.schema?.columns?.map((column: any) => column.name) || [];
  return (statement?.result?.data_array || []).map((row: unknown[]) =>
    Object.fromEntries(columns.map((column: string, index: number) => [column, row[index]]))
  );
}

type LakehouseEvent = {
  event_id: string;
  title: string;
};

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeEventId(value: unknown): string | null {
  const match = String(value || "").match(/^EV-?(\d+)$/i);
  return match ? `EV-${match[1]}` : null;
}

async function getLiveLakehouseEvents(): Promise<LakehouseEvent[]> {
  const result = await executeLakehouseSql(
    "SELECT event_id, title FROM workspace.campus_explorer.campus_events WHERE visibility = 'public' ORDER BY event_date ASC, start_time ASC",
    undefined,
    20
  );

  if (result.state !== "SUCCEEDED" || !result.records) return [];
  return result.records
    .map((record) => ({
      event_id: String(record.event_id || ""),
      title: String(record.title || ""),
    }))
    .filter((event) => Boolean(normalizeEventId(event.event_id) && normalizeText(event.title)));
}

function resolveLiveEventIds(
  records: Record<string, unknown>[],
  answer: string,
  prompt: string,
  liveEvents: LakehouseEvent[]
): string[] {
  const ids = new Set<string>();
  const textCandidates = [answer, prompt, ...records.flatMap((record) => Object.values(record).map(String))]
    .map(normalizeText)
    .filter(Boolean);

  for (const record of records) {
    for (const value of Object.values(record)) {
      const id = normalizeEventId(value);
      if (id) ids.add(id);
    }
  }

  for (const event of liveEvents) {
    const id = normalizeEventId(event.event_id);
    const title = normalizeText(event.title);
    if (!id || !title) continue;

    if (textCandidates.some((candidate) => candidate.includes(title))) {
      ids.add(id);
    }
  }

  const liveIds = new Set(liveEvents.map((event) => normalizeEventId(event.event_id)).filter(Boolean));
  return Array.from(ids).filter((id) => liveIds.has(id));
}

export type GenieSurveyQuestion = {
  id?: string;
  q: string;
  type: "radio" | "check";
  options: string[];
  allowCustom?: boolean;
};

async function resolveGenieSurveyQuestions(
  genieRecords: Record<string, unknown>[],
  prompt: string,
  attachments: GenieMessage["attachments"]
): Promise<GenieSurveyQuestion[] | null> {
  // 1. Check if any returned Lakehouse records contain questions_json (e.g. from campus_surveys)
  for (const record of genieRecords) {
    if (record.questions_json && typeof record.questions_json === "string") {
      try {
        const parsed = JSON.parse(record.questions_json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: Record<string, unknown>, idx: number) => ({
            id: String(item.id || `q_${idx}`),
            q: String(item.q || item.title || item.question || item.prompt || `Question ${idx + 1}`),
            type: (item.type === "checkbox" || item.type === "check" ? "check" : "radio") as "radio" | "check",
            options: Array.isArray(item.options) && item.options.length > 0
              ? item.options.map(String)
              : ["Yes", "No"],
            allowCustom: item.allowCustom !== false,
          }));
        }
      } catch {}
    }
  }

  // 2. Check if Genie returned suggested follow-up questions in the message attachments
  const suggested = (attachments || [])
    .flatMap((a) => a.suggested_questions?.questions || [])
    .filter((q): q is string => typeof q === "string" && q.trim().length > 0);

  if (suggested.length > 0) {
    return suggested.slice(0, 3).map((sq, idx) => ({
      id: `genie_sq_${idx}`,
      q: sq,
      type: "radio" as const,
      options: ["Yes", "No", "Tell me more"],
      allowCustom: true,
    }));
  }

  // 3. If user prompt explicitly requests a survey, quiz, preference questionnaire, or event recommendation:
  const isSurveyIntent = /\b(survey|questionnaire|quiz|poll|feedback|preference|recommend\s+events|help\s+me\s+(choose|pick|decide))\b/i.test(prompt);
  if (isSurveyIntent) {
    try {
      const res = await executeLakehouseSql(
        "SELECT questions_json FROM workspace.campus_explorer.campus_surveys WHERE is_published = true ORDER BY is_featured DESC, response_count DESC LIMIT 1",
        undefined,
        5
      );
      if (res.state === "SUCCEEDED" && res.records && res.records[0]?.questions_json) {
        const parsed = JSON.parse(String(res.records[0].questions_json));
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: Record<string, unknown>, idx: number) => ({
            id: String(item.id || `q_${idx}`),
            q: String(item.q || item.title || item.question || item.prompt || `Question ${idx + 1}`),
            type: (item.type === "checkbox" || item.type === "check" ? "check" : "radio") as "radio" | "check",
            options: Array.isArray(item.options) && item.options.length > 0
              ? item.options.map(String)
              : ["Yes", "No"],
            allowCustom: item.allowCustom !== false,
          }));
        }
      }
    } catch {}
  }

  return null;
}

export async function streamGenieConversation(
  prompt: string,
  signal: AbortSignal,
  send: (event: unknown) => void
) {
  const config: GenieConfig = {
    host: (process.env.DATABRICKS_HOST || "https://dbc-c69189ed-ede0.cloud.databricks.com").replace(/\/+$/, ""),
    token: await getDatabricksToken(),
    spaceId: process.env.DATABRICKS_GENIE_SPACE_ID || "01f1a5c5fe5110d3b2618830a3195ee7",
  };

  const start = await genieFetch(config, `/spaces/${config.spaceId}/start-conversation`, {
    method: "POST",
    body: JSON.stringify({ content: prompt, enable_visualization: false }),
    signal,
  });
  if (!start.ok) throw new Error(`Genie start failed (${start.status}): ${await start.text()}`);

  const started = await start.json();
  const conversationId = started.conversation_id;
  const messageId = started.message_id;
  if (!conversationId || !messageId) throw new Error("Genie did not return a conversation or message ID");

  send({ type: "tool_status", toolName: "genie_agent", label: "Campus Genie Agent is reasoning…", active: true });

  let message: GenieMessage = {};
  for (let attempt = 0; attempt < 120; attempt++) {
    if (signal.aborted) return;
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : 1500));
    const result = await genieFetch(config, `/spaces/${config.spaceId}/conversations/${conversationId}/messages/${messageId}`, { signal });
    if (!result.ok) throw new Error(`Genie status failed (${result.status}): ${await result.text()}`);
    message = await result.json();
    if (["COMPLETED", "FAILED", "CANCELLED", "CANCELED"].includes(message.status || "")) break;
  }

  if (signal.aborted) return;
  if (!["COMPLETED"].includes(message.status || "")) {
    throw new Error(`Genie message ended with status ${message.status || "TIMEOUT"}`);
  }

  const attachments = message.attachments || [];
  const answer = attachments.find((attachment) => attachment.text?.purpose?.includes("ANSWER"))?.text?.content;
  const queries = attachments.filter((attachment) => attachment.query?.query);
  const thoughts = queries.flatMap((attachment) => attachment.query?.thoughts || []).map((thought) => thought.content).filter(Boolean);
  const genieRecords: Record<string, unknown>[] = [];

  for (const thought of thoughts) send({ choices: [{ delta: { reasoning_content: `${thought}\n` } }] });
  for (const attachment of queries) {
    const query = attachment.query?.query || "";
    send({ type: "tool_status", toolName: "genie_agent", label: `Genie SQL: ${query.slice(0, 70)}…`, active: true });
    let records: Record<string, unknown>[] = [];
    if (attachment.attachment_id) {
      const result = await genieFetch(config, `/spaces/${config.spaceId}/conversations/${conversationId}/messages/${messageId}/attachments/${attachment.attachment_id}/query-result`, { signal });
      if (result.ok) records = recordsFromStatementResponse(await result.json());
    }
    genieRecords.push(...records);
    send({ type: "tool_status", toolName: "genie_agent", label: `Genie SQL completed (${records.length} rows)`, active: false });
    send({ choices: [{ delta: { reasoning_content: `\n\`\`\`sql\n${query}\n\`\`\`\n` } }] });
  }

  const liveEvents = await getLiveLakehouseEvents();
  const eventIds = resolveLiveEventIds(genieRecords, answer || "", prompt, liveEvents);

  // Only emit show_events_grid if specific verified events were matched
  if (eventIds.length > 0) {
    send({ type: "events_grid", eventIds });
    send({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "genie_events",
            function: {
              name: "show_events_grid",
              arguments: JSON.stringify({ eventIds, summary: `Matched ${eventIds.length} live Lakehouse events` }),
            },
          }],
        },
      }],
    });
  }

  // Resolve interactive survey questions for Genie Agent
  const surveyQuestions = await resolveGenieSurveyQuestions(genieRecords, prompt, attachments);
  if (surveyQuestions && surveyQuestions.length > 0) {
    send({ type: "survey", questions: surveyQuestions });
    send({
      choices: [{
        delta: {
          tool_calls: [{
            index: 1,
            id: "genie_survey",
            function: {
              name: "ask_user_questions",
              arguments: JSON.stringify({ questions: surveyQuestions }),
            },
          }],
        },
      }],
    });
  }

  send({ choices: [{ delta: { content: answer || "Genie completed the query but did not return an answer." } }] });
}
