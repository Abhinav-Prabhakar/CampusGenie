import { execFile } from "child_process";
import { promisify } from "util";

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
      const { stdout } = await execFileAsync(executable, ["auth", "token"], { maxBuffer: 1024 * 1024 });
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
  const eventIds = new Set<string>();

  for (const thought of thoughts) send({ choices: [{ delta: { reasoning_content: `${thought}\n` } }] });
  for (const attachment of queries) {
    const query = attachment.query?.query || "";
    send({ type: "tool_status", toolName: "genie_agent", label: `Genie SQL: ${query.slice(0, 70)}…`, active: true });
    let records: Record<string, unknown>[] = [];
    if (attachment.attachment_id) {
      const result = await genieFetch(config, `/spaces/${config.spaceId}/conversations/${conversationId}/messages/${messageId}/attachments/${attachment.attachment_id}/query-result`, { signal });
      if (result.ok) records = recordsFromStatementResponse(await result.json());
    }
    for (const record of records) {
      const id = record.event_id || record.id;
      if (typeof id === "string" && /^EV-?\d+$/i.test(id)) {
        eventIds.add(id.toUpperCase().replace(/^EV(\d+)$/, "EV-$1"));
      }
    }
    send({ type: "tool_status", toolName: "genie_agent", label: `Genie SQL completed (${records.length} rows)`, active: false });
    send({ choices: [{ delta: { reasoning_content: `\n\`\`\`sql\n${query}\n\`\`\`\n` } }] });
  }

  // Reuse the existing interactive card renderer for Genie event queries.
  // Genie remains read-only; this is only a presentation event for the UI.
  if (eventIds.size === 0 && answer) {
    for (const raw of answer.match(/EV-?\d+/gi) || []) {
      eventIds.add(raw.toUpperCase().replace(/^EV(\d+)$/, "EV-$1"));
    }
  }
  if (eventIds.size > 0) {
    send({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "genie_events",
            function: {
              name: "show_events_grid",
              arguments: JSON.stringify({ eventIds: Array.from(eventIds), summary: "Events selected by Campus Genie." }),
            },
          }],
        },
      }],
    });
  }

  send({ choices: [{ delta: { content: answer || "Genie completed the query but did not return an answer." } }] });
}
