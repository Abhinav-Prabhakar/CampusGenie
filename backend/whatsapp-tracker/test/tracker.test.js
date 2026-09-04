import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG, validateConfig, resolveDatabricksToken } from "../src/config.js";
import {
  loadState,
  setTrackedGroups,
  updateGroupCursor,
  getTrackedGroups,
  recordExtractedEvent,
} from "../src/state.js";
import { extractEventFromMessage, normalizeEventPayload } from "../src/eventExtractor.js";
import { checkEventExists } from "../src/lakehouse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Configuration validates environment keys and resolves Databricks OAuth token", async () => {
  const res = await validateConfig();
  assert.equal(res.valid, true, `Config should be valid, missing: ${res.missing.join(", ")}`);
  assert.ok(CONFIG.llmApiKey.length > 0);
  assert.ok(CONFIG.databricksHost.startsWith("https://"));
  const token = await resolveDatabricksToken();
  assert.ok(token && token.length > 0);
});

test("State management persists tracked groups and cursors", () => {
  const originalStatePath = CONFIG.statePath;
  const testStatePath = path.resolve(__dirname, "test-state.json");
  CONFIG.statePath = testStatePath;

  try {
    if (fs.existsSync(testStatePath)) fs.unlinkSync(testStatePath);

    // Initial state
    const initial = loadState();
    assert.deepEqual(initial.trackedGroups, []);

    // Add groups
    const sampleGroups = [
      { id: "1203630281928@g.us", name: "CS Club Announcements" },
      { id: "1203630999999@g.us", name: "Campus Hackathons 2026" },
    ];
    setTrackedGroups(sampleGroups);

    const tracked = getTrackedGroups();
    assert.equal(tracked.length, 2);
    assert.equal(tracked[0].name, "CS Club Announcements");

    // Update cursor
    const now = Math.floor(Date.now() / 1000);
    updateGroupCursor("1203630281928@g.us", now, "msg_123");

    const reloaded = loadState();
    const updated = reloaded.trackedGroups.find((g) => g.id === "1203630281928@g.us");
    assert.equal(updated.lastMessageTimestamp, now);
    assert.equal(updated.lastMessageId, "msg_123");

    // Record event
    recordExtractedEvent({
      eventId: "EV-TEST-1",
      title: "Test Hackathon",
      groupName: "Campus Hackathons 2026",
      extractedAt: new Date().toISOString(),
    });

    const withEvents = loadState();
    assert.equal(withEvents.extractedEvents.length, 1);
    assert.equal(withEvents.extractedEvents[0].title, "Test Hackathon");
  } finally {
    if (fs.existsSync(testStatePath)) fs.unlinkSync(testStatePath);
    CONFIG.statePath = originalStatePath;
  }
});

test("Event Extractor correctly rejects non-event casual conversation", async () => {
  const nonEvent = await extractEventFromMessage({
    messageText: "Hey guys does anyone have notes from today's linear algebra lecture? I missed the first 20 mins.",
    senderName: "Alice",
    groupName: "Study Group",
    messageTimestamp: Math.floor(Date.now() / 1000),
  });

  assert.equal(nonEvent, null, "Casual chat should not be identified as an event");
});

test("Event Extractor correctly identifies and parses a real campus event announcement", async () => {
  const eventMsg = `🚀 GDG Campus Spring Hackathon 2026 is finally here!
Join us this Saturday, March 14, 2026 from 10:00 AM to 6:00 PM at Kemper Hall 210.
Build cool AI apps, meet mentors from tech companies, and win prizes worth $2000!
🍕 Free pizza and Boba will be provided for all attendees.
RSVP is mandatory: https://gdg.community.dev/events/spring-hack-2026`;

  const extracted = await extractEventFromMessage({
    messageText: eventMsg,
    senderName: "Club President",
    groupName: "GDG Student Chapter",
    messageTimestamp: Math.floor(Date.now() / 1000),
  });

  assert.ok(extracted, "Should extract event data");
  assert.equal(extracted.isEvent, true);
  assert.ok(extracted.title.toLowerCase().includes("hackathon"));
  assert.equal(extracted.foodProvided, true);
  assert.ok(extracted.location.length > 0);
  assert.ok(extracted.eventDate.startsWith("2026-"));
});

test("normalizeEventPayload coerces dates, categories and scalar types", () => {
  const good = normalizeEventPayload({
    isEvent: true,
    title: "Spring Hackathon",
    category: "HACKATHON",
    eventDate: "March 14, 2026",
    capacity: "250",
    isVirtual: "true",
    foodProvided: 1,
  });
  assert.equal(good.eventDate, "2026-03-14", "Flexible date strings should become YYYY-MM-DD");
  assert.equal(good.category, "hackathon", "Category should be lowercased and allowed");
  assert.equal(good.capacity, 250, "Numeric strings should become numbers");
  assert.equal(good.isVirtual, true, "String 'true' should coerce to boolean true");
  assert.equal(good.foodProvided, true, "Numeric 1 should coerce to boolean true");

  const badCategory = normalizeEventPayload({
    isEvent: true,
    title: "Mystery Event",
    category: "gala",
    eventDate: "not a date at all",
  });
  assert.equal(badCategory.category, "social", "Unknown categories should fall back to social");
  assert.match(
    badCategory.eventDate,
    /^\d{4}-\d{2}-\d{2}$/,
    "Unparseable dates should fall back to today's YYYY-MM-DD"
  );
  assert.equal(badCategory.capacity, 100, "Missing capacity should default");

  assert.equal(
    normalizeEventPayload({ isEvent: false, title: "Nope" }),
    null,
    "Non-event payloads should be rejected"
  );
  assert.equal(normalizeEventPayload({ isEvent: true }), null, "Payloads without a title should be rejected");
});

test("Lakehouse SQL checkEventExists queries Delta table successfully", async () => {
  // Query Databricks Lakehouse to ensure connection and table access works
  const result = await checkEventExists("NonExistentEventTitleRandom999", "2026-12-31");
  assert.equal(result, null, "Non-existent event should return null");
});
