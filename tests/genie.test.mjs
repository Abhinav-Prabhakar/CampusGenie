import assert from "node:assert/strict";
import test from "node:test";
import { askGenie } from "../src/lib/navigator-genie.ts";
import { CORE_QUESTION } from "../src/lib/opportunities.ts";

test("Genie flow returns a final answer and compact evidence without reasoning traces", async () => {
  const calls = [];
  const client = {
    config: {
      host: "https://example.cloud.databricks.com",
      token: "test-token",
      warehouseId: "warehouse-id",
      genieSpaceId: "space-id",
      genieAgentName: "Configured fallback name",
      catalog: "workspace",
      schema: "campus_explorer",
    },
    async request(path, init = {}) {
      calls.push({ path, method: init.method || "GET" });
      if (path === "/api/2.0/genie/spaces/space-id") return { title: "Campus Opportunity Navigator" };
      if (path.endsWith("/start-conversation")) return { conversation_id: "conversation-1", message_id: "message-1" };
      if (path.endsWith("/messages/message-1")) {
        return {
          status: "COMPLETED",
          attachments: [
            { text: { purpose: "ANSWER", content: "Join the Applied AI Lab Open House." } },
            {
              attachment_id: "attachment-1",
              query: { query: "SELECT * FROM workspace.campus_explorer.campus_events" },
            },
          ],
        };
      }
      if (path.endsWith("/attachments/attachment-1/query-result")) {
        return {
          statement_response: {
            statement_id: "statement-1",
            status: { state: "SUCCEEDED" },
            manifest: {
              schema: { columns: [{ name: "event_id" }, { name: "title" }, { name: "updated_at" }] },
              total_row_count: 1,
            },
            result: { data_array: [["EV-001", "Applied AI Lab Open House", "2026-09-01T09:00:00+05:30"]] },
          },
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    },
  };

  const response = await askGenie(CORE_QUESTION, { client });
  assert.equal(response.ok, true);
  assert.equal(response.answer, "Join the Applied AI Lab Open House.");
  assert.equal(response.evidence.agentName, "Campus Opportunity Navigator");
  assert.deepEqual(response.evidence.tables, ["campus_events"]);
  assert.equal(response.evidence.rowsReturned, 1);
  assert.equal(response.opportunities[0].id, "EV-001");
  assert.equal(JSON.stringify(response).includes("reasoning"), false);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "GET", "GET"]);
});
