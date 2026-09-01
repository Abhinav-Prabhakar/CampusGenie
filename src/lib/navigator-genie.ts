import { createDatabricksClient, type DatabricksClient, type SqlStatementResponse } from "./databricks.ts";
import {
  extractTablesFromSql,
  latestTimestamp,
  normalizeOpportunityRecords,
  type GenieEvidence,
  type NavigatorResponse,
} from "./opportunities.ts";

type GenieAttachment = {
  attachment_id?: string;
  text?: { content?: string; purpose?: string };
  query?: { query?: string; description?: string };
};

type GenieMessage = {
  message_id?: string;
  status?: string;
  attachments?: GenieAttachment[];
};

type StartedConversation = {
  conversation_id?: string;
  message_id?: string;
};

type QueryResultResponse = { statement_response?: SqlStatementResponse };

export type GenieProgress = "Contacting Genie Agent" | "Checking governed tables" | "Matching eligibility";

function recordsFromStatement(response: SqlStatementResponse | undefined): Array<Record<string, unknown>> {
  const columns = (response?.manifest?.schema?.columns || []).map((column) => column.name || "column");
  return (response?.result?.data_array || []).map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null])),
  );
}

function answerFromAttachments(attachments: GenieAttachment[]): string {
  const preferred = attachments.find((attachment) => /ANSWER/i.test(attachment.text?.purpose || ""));
  const fallback = attachments.find((attachment) => attachment.text?.content);
  return preferred?.text?.content?.trim() || fallback?.text?.content?.trim() || "";
}

function promptForGenie(prompt: string): string {
  return `${prompt}\n\nReturn a concise, student-facing final answer. Query only the configured campus opportunity tables. Include identifiers and the fields needed to verify time, cost, commute, eligibility, source, and updated_at. Do not describe private reasoning.`;
}

export async function askGenie(
  prompt: string,
  options: {
    conversationId?: string;
    signal?: AbortSignal;
    client?: DatabricksClient;
    onProgress?: (progress: GenieProgress) => void;
  } = {},
): Promise<NavigatorResponse> {
  const client = options.client || createDatabricksClient();
  options.onProgress?.("Contacting Genie Agent");

  const space = await client.request<{ title?: string }>(
    `/api/2.0/genie/spaces/${encodeURIComponent(client.config.genieSpaceId)}`,
    { signal: options.signal },
    10_000,
  );
  const agentName = space.title?.trim() || client.config.genieAgentName;

  let conversationId = options.conversationId;
  let messageId: string | undefined;
  if (conversationId) {
    const created = await client.request<GenieMessage>(
      `/api/2.0/genie/spaces/${encodeURIComponent(client.config.genieSpaceId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        signal: options.signal,
        body: JSON.stringify({ content: promptForGenie(prompt) }),
      },
    );
    messageId = created.message_id;
  } else {
    const started = await client.request<StartedConversation>(
      `/api/2.0/genie/spaces/${encodeURIComponent(client.config.genieSpaceId)}/start-conversation`,
      {
        method: "POST",
        signal: options.signal,
        body: JSON.stringify({ content: promptForGenie(prompt), enable_visualization: false }),
      },
    );
    conversationId = started.conversation_id;
    messageId = started.message_id;
  }

  if (!conversationId || !messageId) throw new Error("Genie did not return conversation identifiers.");

  options.onProgress?.("Checking governed tables");
  let message: GenieMessage = {};
  for (let attempt = 0; attempt < 36; attempt += 1) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1_250));
    message = await client.request<GenieMessage>(
      `/api/2.0/genie/spaces/${encodeURIComponent(client.config.genieSpaceId)}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      { signal: options.signal },
    );
    if (["COMPLETED", "FAILED", "CANCELLED", "CANCELED", "QUERY_RESULT_EXPIRED"].includes(message.status || "")) break;
  }

  if (message.status !== "COMPLETED") throw new Error("Genie did not complete the request.");

  options.onProgress?.("Matching eligibility");
  const attachments = message.attachments || [];
  const queryAttachments = attachments.filter((attachment) => attachment.query?.query);
  const sql = queryAttachments.map((attachment) => attachment.query!.query!.trim());
  const tables = [...new Set(sql.flatMap(extractTablesFromSql))];
  const allRecords: Array<Record<string, unknown>> = [];
  const statementIds: string[] = [];
  let rowsReturned = 0;
  let truncated = false;

  for (const attachment of queryAttachments) {
    if (!attachment.attachment_id) continue;
    const result = await client.request<QueryResultResponse>(
      `/api/2.0/genie/spaces/${encodeURIComponent(client.config.genieSpaceId)}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.attachment_id)}/query-result`,
      { signal: options.signal },
    );
    const statement = result.statement_response;
    const records = recordsFromStatement(statement);
    allRecords.push(...records);
    rowsReturned += statement?.manifest?.total_row_count ?? records.length;
    if (statement?.statement_id) statementIds.push(statement.statement_id);
    truncated ||= Boolean(statement?.manifest?.truncated || statement?.result?.next_chunk_index !== undefined);
  }

  const evidence: GenieEvidence = {
    agentName,
    tables,
    sql,
    rowsReturned,
    freshness: latestTimestamp(allRecords),
    statementIds,
    truncated,
  };
  const opportunities = normalizeOpportunityRecords(allRecords, prompt, tables);
  const answer = answerFromAttachments(attachments);

  return {
    ok: true,
    status: rowsReturned === 0 ? "no_results" : "ok",
    answer: answer || (rowsReturned === 0
      ? "Genie found no opportunities matching those constraints. Broaden one constraint and try again."
      : "Genie returned data but no final narrative. Review the verified rows below."),
    conversationId,
    opportunities,
    evidence,
  };
}
