import test from "node:test";
import assert from "node:assert/strict";
import { validateCampusReadOnlySql } from "../src/lib/chatSqlSecurity.ts";

function expectRejected(sql, pattern) {
  const result = validateCampusReadOnlySql(sql);
  assert.equal(result.ok, false, `expected rejection for: ${sql}`);
  assert.match(result.error, pattern);
}

test("accepts and namespaces an approved SELECT", () => {
  assert.deepEqual(
    validateCampusReadOnlySql("SELECT event_id, title FROM campus_events WHERE title LIKE '%AI%';"),
    {
      ok: true,
      sql: "SELECT event_id, title FROM workspace.campus_explorer.campus_events WHERE title LIKE '%AI%'",
      tables: ["campus_events"],
    },
  );
});

test("accepts approved fully-qualified tables, joins, subqueries, and CTEs", () => {
  const result = validateCampusReadOnlySql(`
    WITH upcoming AS (
      SELECT event_id, location FROM workspace.campus_explorer.campus_events
    )
    SELECT u.event_id, l.name
    FROM upcoming u
    JOIN campus_locations l ON l.name = u.location
  `);
  assert.equal(result.ok, true);
  assert.deepEqual(result.tables.sort(), ["campus_events", "campus_locations"]);
  assert.match(result.sql, /JOIN workspace\.campus_explorer\.campus_locations/);
});

test("rejects private application tables", () => {
  for (const table of ["app_users", "chat_threads", "student_attendance_logs", "complaints", "alumni_intro_requests"]) {
    expectRejected(`SELECT * FROM workspace.campus_explorer.${table}`, /not available/);
  }
});

test("does not let a CTE name shadow a private physical table in its own body", () => {
  expectRejected(
    "WITH app_users AS (SELECT email FROM app_users) SELECT * FROM app_users",
    /not available/,
  );
  expectRejected(
    "WITH chat_threads AS (SELECT messages_json FROM chat_threads) SELECT * FROM chat_threads",
    /not available/,
  );
});

test("rejects unknown and cross-schema tables", () => {
  expectRejected("SELECT * FROM secrets", /not available/);
  expectRejected("SELECT * FROM system.information_schema.tables", /not available/);
  expectRejected("SELECT * FROM other.campus_explorer.campus_events", /not available/);
  expectRejected("SELECT * FROM campus_explorer.campus_events", /not available/);
});

test("rejects DML, DDL, maintenance, and permission statements", () => {
  const statements = [
    "DELETE FROM campus_events",
    "WITH rows AS (SELECT * FROM campus_events) DELETE FROM campus_events",
    "MERGE INTO campus_events USING campus_surveys ON true WHEN MATCHED THEN DELETE",
    "CREATE TABLE copied AS SELECT * FROM campus_events",
    "COPY INTO campus_events FROM '/tmp/data'",
    "VACUUM campus_events",
    "GRANT SELECT ON TABLE campus_events TO user",
  ];
  for (const sql of statements) expectRejected(sql, /SELECT or WITH|not permitted/);
});

test("rejects multiple statements and SQL comments", () => {
  expectRejected("SELECT * FROM campus_events; SELECT * FROM app_users", /one SQL statement/);
  expectRejected("SELECT * FROM campus_events -- hide the next statement", /comments/);
  expectRejected("SELECT * FROM campus_events /* trusted */", /comments/);
});

test("rejects table-valued functions and relation bypasses", () => {
  expectRejected("SELECT * FROM read_files('/Volumes/private')", /Table-valued functions/);
  expectRejected("SELECT * FROM delta.`/Volumes/private`", /not available/);
  expectRejected("SELECT * FROM (app_users)", /subqueries must begin/);
});

test("keywords and semicolons inside string literals are harmless", () => {
  const result = validateCampusReadOnlySql(
    "SELECT title FROM campus_events WHERE description = 'DROP; -- not executable'",
  );
  assert.equal(result.ok, true);
});

test("normalizes invisible characters before validating", () => {
  expectRejected("DRO\u200BP TABLE campus_events", /SELECT or WITH/);
});

test("requires an approved campus data source", () => {
  expectRejected("SELECT current_user()", /approved Campus Genie table/);
});
