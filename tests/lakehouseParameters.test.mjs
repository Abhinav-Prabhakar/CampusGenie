import test from "node:test";
import assert from "node:assert/strict";
import { buildStatementPayload } from "../src/lib/lakehouse.ts";

test("binds values separately from Databricks SQL text", () => {
  const attack = "student' OR 1=1 --";
  const payload = buildStatementPayload(
    "SELECT * FROM app_users WHERE user_id = :user_id;",
    "warehouse-1",
    20,
    [{ name: "user_id", value: attack }]
  );

  assert.equal(payload.statement, "SELECT * FROM app_users WHERE user_id = :user_id");
  assert.equal(payload.statement.includes(attack), false);
  assert.deepEqual(payload.parameters, [{ name: "user_id", value: attack }]);
});

test("preserves nulls and serializes typed values for the Statement API", () => {
  const payload = buildStatementPayload("SELECT :enabled, :limit, :optional", "warehouse-1", 90, [
    { name: "enabled", value: true, type: "BOOLEAN" },
    { name: "limit", value: 25, type: "INT" },
    { name: "optional", value: null },
  ]);

  assert.equal(payload.wait_timeout, "30s");
  assert.deepEqual(payload.parameters, [
    { name: "enabled", value: "true", type: "BOOLEAN" },
    { name: "limit", value: "25", type: "INT" },
    { name: "optional", value: null },
  ]);
});

test("rejects invalid or duplicate parameter metadata", () => {
  assert.throws(
    () => buildStatementPayload("SELECT 1", "warehouse-1", 10, [{ name: "bad-name", value: "x" }]),
    /Invalid Databricks SQL parameter name/
  );
  assert.throws(
    () => buildStatementPayload("SELECT 1", "warehouse-1", 10, [
      { name: "same", value: "x" },
      { name: "same", value: "y" },
    ]),
    /Duplicate Databricks SQL parameter/
  );
  assert.throws(
    () => buildStatementPayload("SELECT 1", "warehouse-1", 10, [{ name: "value", value: "x", type: "STRING); DROP TABLE users" }]),
    /Invalid Databricks SQL parameter type/
  );
});
