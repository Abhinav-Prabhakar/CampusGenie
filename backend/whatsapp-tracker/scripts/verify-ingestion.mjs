// One-off end-to-end verification of the Lakehouse ingestion path.
// Inserts a clearly-marked test event, reads it back, then deletes it.
import { insertCampusEvent, checkEventExists, executeDatabricksSql } from "../src/lakehouse.js";

const marker = `ZZZ-VERIFY-${Date.now().toString(36).toUpperCase()}`;

try {
  console.log("[1] Inserting test event via insertCampusEvent()...");
  const inserted = await insertCampusEvent({
    title: `${marker} Verification Event`,
    category: "workshop",
    hostOrganization: "Tracker Verification Bot",
    location: "Nowhere Hall 000",
    isVirtual: false,
    eventDate: "2026-12-31",
    startTime: "11:00 AM",
    duration: "1h",
    capacity: 2,
    foodProvided: true,
    tags: ["verify", "temp"],
    description: "Temporary row to verify WhatsApp tracker ingestion. Safe to delete.",
    whatsappUrl: "WhatsApp: Verification Group",
  });
  console.log(`    Inserted eventId=${inserted.eventId}`);

  console.log("[2] Reading back via checkEventExists()...");
  const found = await checkEventExists(`${marker} Verification Event`, "2026-12-31");
  if (!found) throw new Error("Row not found after insert!");
  console.log(`    Found event_id=${found.event_id} title=${found.title}`);

  console.log("[3] Verifying full row contents...");
  const rows = await executeDatabricksSql(
    `SELECT * FROM workspace.campus_explorer.campus_events WHERE event_id = '${inserted.eventId}'`
  );
  const row = rows[0];
  console.log("    ", JSON.stringify(row));
  if (row.created_by !== "whatsapp_tracker") throw new Error(`created_by mismatch: ${row.created_by}`);
  if (row.host_code !== "WA") throw new Error(`host_code mismatch: ${row.host_code}`);

  console.log("[4] Cleaning up test row...");
  await executeDatabricksSql(
    `DELETE FROM workspace.campus_explorer.campus_events WHERE event_id = '${inserted.eventId}'`
  );
  const after = await executeDatabricksSql(
    `SELECT COUNT(*) AS n FROM workspace.campus_explorer.campus_events WHERE event_id = '${inserted.eventId}'`
  );
  if (Number(after[0]?.n) !== 0) throw new Error("Cleanup failed — test row still present!");
  console.log("    Deleted. Table clean.");

  console.log("\n✅ END-TO-END INGESTION VERIFIED (insert → read → delete)");
} catch (err) {
  console.error("\n❌ VERIFICATION FAILED:", err.message);
  // Best-effort cleanup so the table is never left with test data
  try {
    await executeDatabricksSql(
      `DELETE FROM workspace.campus_explorer.campus_events WHERE title LIKE '${marker}%'`
    );
    console.error("   (cleanup attempted)");
  } catch {}
  process.exit(1);
}
