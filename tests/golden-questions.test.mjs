import assert from "node:assert/strict";
import test from "node:test";
import {
  CORE_QUESTION,
  extractTablesFromSql,
  isOpportunityQuestion,
  normalizeOpportunityRecords,
} from "../src/lib/opportunities.ts";

const MATCHING_ROW = {
  event_id: "EV-001",
  title: "Applied AI Lab Open House",
  opportunity_type: "campus_event",
  domain: "AI",
  starts_at: "2026-09-04T17:00:00+05:30",
  location_name: "BMSCE Data Lab",
  commute_minutes: "8",
  fee_inr: "0",
  eligibility: "Third-year CSE students",
  recruitment_status: "open",
  is_synthetic: "true",
  updated_at: "2026-09-01T09:00:00+05:30",
};

test("golden question 1 verifies time, budget, travel, interest, and status", () => {
  const [result] = normalizeOpportunityRecords([MATCHING_ROW], CORE_QUESTION, ["campus_events"]);
  assert.equal(result.title, "Applied AI Lab Open House");
  assert.equal(result.synthetic, true);
  assert.ok(result.whyMatch.includes("Relevant to AI or data interests"));
  assert.ok(result.whyMatch.includes("Within the ₹300 budget"));
  assert.ok(result.whyMatch.includes("Within the 30-minute travel limit"));
  assert.ok(result.whyMatch.includes("Scheduled on Friday"));
  assert.ok(result.whyMatch.includes("Starts after 4 PM"));
});

test("golden questions 2 and 3 stay within the navigator scope", () => {
  assert.equal(isOpportunityQuestion("Find active AI clubs or labs with open recruitment."), true);
  assert.equal(isOpportunityQuestion("Compare two opportunities for a student with low weekly availability."), true);
});

test("golden question 4 returns a clear empty result model", () => {
  assert.deepEqual(normalizeOpportunityRecords([], "Find events from 1 January to 2 January 2025", ["campus_events"]), []);
});

test("golden question 5 rejects an unrelated request", () => {
  assert.equal(isOpportunityQuestion("Write a recipe for tomato soup."), false);
});

test("evidence only reports allowlisted governed tables", () => {
  const tables = extractTablesFromSql(`
    SELECT * FROM workspace.campus_explorer.campus_events e
    JOIN workspace.campus_explorer.recruitment_windows r ON e.event_id = r.entity_id
    JOIN workspace.other.secret_table s ON true
  `);
  assert.deepEqual(tables, ["campus_events", "recruitment_windows"]);
});
