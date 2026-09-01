import assert from "node:assert/strict";
import test from "node:test";
import {
  DatabricksClient,
  DatabricksError,
  getDatabricksConfig,
  toPublicDatabricksError,
} from "../src/lib/databricks.ts";

const ENV = {
  DATABRICKS_HOST: "https://example.cloud.databricks.com",
  DATABRICKS_TOKEN: "test-token-never-log",
  DATABRICKS_WAREHOUSE_ID: "warehouse-id",
  DATABRICKS_GENIE_SPACE_ID: "space-id",
};

test("configuration fails clearly when required server variables are missing", () => {
  assert.throws(
    () => getDatabricksConfig({}),
    (error) => error instanceof DatabricksError && error.code === "NOT_CONFIGURED" && !error.message.includes("undefined"),
  );
});

test("SQL adapter calls the supported REST endpoint and parses records", async () => {
  let request;
  const fetchMock = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({
      statement_id: "stmt-1",
      status: { state: "SUCCEEDED" },
      manifest: { schema: { columns: [{ name: "event_id" }, { name: "title" }] }, total_row_count: 1 },
      result: { data_array: [["EV-001", "Applied AI Lab Open House"]] },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const client = new DatabricksClient(getDatabricksConfig(ENV), fetchMock);
  const result = await client.executeSql("SELECT event_id, title FROM workspace.campus_explorer.campus_events");

  assert.equal(request.url, "https://example.cloud.databricks.com/api/2.0/sql/statements");
  assert.equal(request.init.method, "POST");
  assert.equal(JSON.parse(request.init.body).warehouse_id, "warehouse-id");
  assert.deepEqual(result.records, [{ event_id: "EV-001", title: "Applied AI Lab Open House" }]);
  assert.equal(result.rowCount, 1);
});

test("public adapter errors do not expose tokens or upstream bodies", async () => {
  const fetchMock = async () => new Response(JSON.stringify({ message: "secret upstream detail" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
  const client = new DatabricksClient(getDatabricksConfig(ENV), fetchMock);
  let caught;
  try {
    await client.executeSql("SELECT 1");
  } catch (error) {
    caught = error;
  }
  const safe = toPublicDatabricksError(caught);
  const serialized = JSON.stringify(safe);
  assert.equal(safe.status, 401);
  assert.equal(safe.body.error.code, "AUTHENTICATION_FAILED");
  assert.equal(serialized.includes(ENV.DATABRICKS_TOKEN), false);
  assert.equal(serialized.includes("secret upstream detail"), false);
});

test("public SQL adapter rejects write statements", async () => {
  const client = new DatabricksClient(getDatabricksConfig(ENV), async () => {
    throw new Error("fetch should not be called");
  });
  await assert.rejects(
    () => client.executeSql("DELETE FROM workspace.campus_explorer.campus_events"),
    (error) => error instanceof DatabricksError && error.code === "PERMISSION_DENIED",
  );
});
