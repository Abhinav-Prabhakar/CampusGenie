import { select, checkbox, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import Table from "cli-table3";
import qrcode from "qrcode-terminal";
import { CONFIG, validateConfig } from "./config.js";
import {
  loadState,
  getTrackedGroups,
  setTrackedGroups,
  updateGroupCursor,
  recordExtractedEvent,
} from "./state.js";
import {
  createWhatsAppClient,
  fetchAllGroups,
  fetchNewGroupMessages,
} from "./whatsapp.js";
import { extractEventFromMessage } from "./eventExtractor.js";
import { checkEventExists, insertCampusEvent } from "./lakehouse.js";

export function printBanner() {
  console.clear();
  console.log(chalk.bold.hex("#6366F1")("┌─────────────────────────────────────────────────────────────┐"));
  console.log(chalk.bold.hex("#6366F1")("│       🎓 CAMPUS GENIE — WHATSAPP EVENT TRACKER & INGEST     │"));
  console.log(chalk.bold.hex("#6366F1")("└─────────────────────────────────────────────────────────────┘"));
  console.log(
    chalk.gray("  • Lakehouse: ") +
      chalk.cyan("workspace.campus_explorer.campus_events") +
      chalk.gray(" | LLM: ") +
      chalk.green(CONFIG.llmModel) +
      chalk.gray(" (VoidAI)")
  );
  console.log();
}

/**
 * Interactive group browser allowing the student/admin to select which WhatsApp groups to track
 */
export async function handleManageGroups(client) {
  console.log(chalk.blue("⏳ Fetching all WhatsApp groups from your account..."));
  const allGroups = await fetchAllGroups(client);

  if (allGroups.length === 0) {
    console.log(chalk.yellow("⚠️ No WhatsApp groups found on this account."));
    return;
  }

  const currentlyTracked = getTrackedGroups();
  const trackedIdSet = new Set(currentlyTracked.map((g) => g.id));

  console.log(chalk.green(`✓ Found ${allGroups.length} groups.\n`));

  const choices = allGroups.map((g) => ({
    name: `${g.name} ${chalk.gray(`(${g.participantCount} members${g.unreadCount > 0 ? `, ${g.unreadCount} unread` : ""})`)}`,
    value: g,
    checked: trackedIdSet.has(g.id),
  }));

  const selected = await checkbox({
    message: "Select WhatsApp groups to track for campus events (Space to toggle, Enter to confirm):",
    choices,
    pageSize: 15,
  });

  const updated = setTrackedGroups(selected);
  console.log(chalk.green(`\n✓ Successfully updated tracking list! Now tracking ${updated.length} group(s).\n`));
}

/**
 * Scan all tracked groups for new/unread messages since the last cursor
 */
export async function handleScanTrackedGroups(client) {
  const tracked = getTrackedGroups();
  if (tracked.length === 0) {
    console.log(chalk.yellow("⚠️ No groups are currently being tracked."));
    const wantSelect = await confirm({
      message: "Would you like to browse and select groups to track now?",
      default: true,
    });
    if (wantSelect) {
      await handleManageGroups(client);
    }
    return;
  }

  console.log(chalk.blue(`\n🔍 Scanning ${tracked.length} tracked group(s) for new messages...\n`));

  let totalNewMessages = 0;
  let totalEventsFound = 0;
  let totalEventsInserted = 0;

  for (const group of tracked) {
    const sinceTs = group.lastMessageTimestamp || 0;
    const sinceDateStr = sinceTs > 0 ? new Date(sinceTs * 1000).toLocaleString() : "beginning";

    console.log(chalk.bold(`📁 ${group.name}`) + chalk.gray(` (checking messages after ${sinceDateStr})`));

    const messages = await fetchNewGroupMessages(client, group.id, sinceTs, 60, group.lastMessageId);

    if (messages.length === 0) {
      console.log(chalk.gray("   No new messages.\n"));
      continue;
    }

    console.log(chalk.cyan(`   Found ${messages.length} new message(s). Analyzing with VoidAI Gemini...`));
    totalNewMessages += messages.length;

    let latestTimestamp = sinceTs;
    let latestMessageId = group.lastMessageId;

    for (const msg of messages) {
      if (msg.timestamp > latestTimestamp) {
        latestTimestamp = msg.timestamp;
        latestMessageId = msg.id;
      }

      const eventPayload = await extractEventFromMessage({
        messageText: msg.body,
        senderName: msg.senderName,
        groupName: group.name,
        messageTimestamp: msg.timestamp,
      });

      if (eventPayload && eventPayload.isEvent) {
        totalEventsFound++;
        console.log(chalk.green(`\n   🎉 EVENT DETECTED: `) + chalk.bold(eventPayload.title));
        console.log(chalk.gray(`      Category: `) + chalk.yellow(eventPayload.category) + chalk.gray(` | Date: `) + chalk.yellow(eventPayload.eventDate) + chalk.gray(` | Time: `) + chalk.yellow(eventPayload.startTime || "TBD"));
        console.log(chalk.gray(`      Location: `) + chalk.cyan(eventPayload.location || "Campus"));
        console.log(chalk.gray(`      Host: `) + chalk.magenta(eventPayload.hostOrganization || "Club"));

        // Check if duplicate in Databricks
        const existing = await checkEventExists(eventPayload.title, eventPayload.eventDate);
        if (existing) {
          console.log(chalk.yellow(`      ⚠️ Event already exists in Lakehouse (${existing.event_id}). Skipping insertion.\n`));
        } else {
          try {
            const inserted = await insertCampusEvent(eventPayload);
            totalEventsInserted++;
            console.log(chalk.green.bold(`      ✓ Successfully inserted into Lakehouse as ${inserted.eventId}!\n`));

            recordExtractedEvent({
              eventId: inserted.eventId,
              title: inserted.title,
              category: inserted.category,
              eventDate: inserted.eventDate,
              groupName: group.name,
              extractedAt: new Date().toISOString(),
            });
          } catch (insertErr) {
            console.error(chalk.red(`      ❌ Failed to insert into Lakehouse:`), insertErr.message);
          }
        }
      }
    }

    // Update cursor for this group
    updateGroupCursor(group.id, latestTimestamp, latestMessageId);
  }

  console.log(chalk.bold.green(`\n✨ Scan Complete!`));
  console.log(chalk.gray(`   • Messages analyzed: ${totalNewMessages}`));
  console.log(chalk.gray(`   • Events identified: ${totalEventsFound}`));
  console.log(chalk.gray(`   • Lakehouse events added: ${totalEventsInserted}\n`));
}

/**
 * Real-time watcher that stays connected and processes new incoming messages as they happen
 */
export async function handleLiveWatchMode(client) {
  const tracked = getTrackedGroups();
  if (tracked.length === 0) {
    console.log(chalk.yellow("⚠️ No groups are currently tracked. Please select groups first."));
    return;
  }

  // Drain everything posted since the last run first, so messages that
  // arrived while offline are ingested before live listening begins.
  console.log(chalk.blue("⏳ Catching up on messages posted since the last run..."));
  await handleScanTrackedGroups(client);

  const trackedMap = new Map(tracked.map((g) => [g.id, g.name]));

  console.log(chalk.green.bold("\n🔴 Live Watch Mode Active!"));
  console.log(chalk.gray(`Listening for incoming messages across ${tracked.length} tracked group(s)...`));
  console.log(chalk.gray("Press Ctrl+C to return to main menu.\n"));

  const messageHandler = async (msg) => {
    const groupId = msg.from;
    if (!trackedMap.has(groupId)) return;

    const groupName = trackedMap.get(groupId);
    const body = msg.body;
    if (!body || body.trim().length < 15) return;

    const sender = msg._data?.notifyName || msg.author || "Member";
    console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] `) + chalk.bold(`${groupName}`) + chalk.gray(` > ${sender}: `) + `${body.slice(0, 60)}...`);

    const eventPayload = await extractEventFromMessage({
      messageText: body,
      senderName: sender,
      groupName,
      messageTimestamp: msg.timestamp,
    });

    if (eventPayload && eventPayload.isEvent) {
      console.log(chalk.green.bold(`\n🎉 NEW EVENT ANNOUNCED: `) + chalk.bold(eventPayload.title));
      console.log(chalk.gray(`   Date: `) + chalk.yellow(eventPayload.eventDate) + chalk.gray(` | Location: `) + chalk.cyan(eventPayload.location));

      const existing = await checkEventExists(eventPayload.title, eventPayload.eventDate);
      if (existing) {
        console.log(chalk.yellow(`   ⚠️ Already exists in Lakehouse (${existing.event_id}).`));
      } else {
        try {
          const inserted = await insertCampusEvent(eventPayload);
          console.log(chalk.green.bold(`   ✓ Ingested to Lakehouse: ${inserted.eventId}\n`));
          recordExtractedEvent({
            eventId: inserted.eventId,
            title: inserted.title,
            category: inserted.category,
            eventDate: inserted.eventDate,
            groupName,
            extractedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error(chalk.red(`   ❌ Ingestion failed:`), err.message);
        }
      }
    }

    updateGroupCursor(groupId, msg.timestamp, msg.id._serialized);
  };

  client.on("message", messageHandler);

  // Wait for user to stop with Ctrl+C
  await new Promise((resolve) => {
    const onSigInt = () => {
      client.off("message", messageHandler);
      process.off("SIGINT", onSigInt);
      console.log(chalk.yellow("\nExiting Live Watch Mode...\n"));
      resolve();
    };
    process.on("SIGINT", onSigInt);
  });
}

/**
 * Display table of tracked groups and recent events
 */
export function handleViewStatus() {
  const state = loadState();
  const tracked = state.trackedGroups || [];
  const events = state.extractedEvents || [];

  console.log(chalk.bold.cyan("\n📋 Currently Tracked Groups:"));
  if (tracked.length === 0) {
    console.log(chalk.gray("   No groups tracked yet. Use 'Browse & Select Groups' to add groups."));
  } else {
    const groupTable = new Table({
      head: [chalk.bold("Group Name"), chalk.bold("Last Checked Message Time"), chalk.bold("Added Date")],
      style: { head: ["cyan"] },
    });
    tracked.forEach((g) => {
      const lastCheck = g.lastMessageTimestamp
        ? new Date(g.lastMessageTimestamp * 1000).toLocaleString()
        : "Never scanned";
      const added = g.addedAt ? new Date(g.addedAt).toLocaleDateString() : "-";
      groupTable.push([g.name, lastCheck, added]);
    });
    console.log(groupTable.toString());
  }

  console.log(chalk.bold.green("\n🎟️ Recently Ingested Lakehouse Events:"));
  if (events.length === 0) {
    console.log(chalk.gray("   No events extracted yet."));
  } else {
    const eventTable = new Table({
      head: [chalk.bold("Event ID"), chalk.bold("Title"), chalk.bold("Event Date"), chalk.bold("Source Group"), chalk.bold("Extracted At")],
      style: { head: ["green"] },
    });
    events.slice(0, 8).forEach((e) => {
      eventTable.push([
        e.eventId,
        e.title.slice(0, 28),
        e.eventDate || "-",
        e.groupName ? e.groupName.slice(0, 20) : "WhatsApp",
        new Date(e.extractedAt).toLocaleString(),
      ]);
    });
    console.log(eventTable.toString());
  }
  console.log();
}

/**
 * Main interactive CLI loop
 */
export async function startInteractiveCli() {
  printBanner();

  const val = validateConfig();
  if (!val.valid) {
    console.error(chalk.red("❌ Missing required environment variables:"));
    val.missing.forEach((m) => console.error(chalk.red(`   - ${m}`)));
    console.error(chalk.yellow("\nPlease ensure .env or project root .env.local has these values set.\n"));
    process.exit(1);
  }

  console.log(chalk.blue("Connecting to WhatsApp Web..."));

  let readyResolve;
  const readyPromise = new Promise((resolve) => {
    readyResolve = resolve;
  });

  const client = createWhatsAppClient({
    onQr: (qr) => {
      console.log(chalk.yellow("\n📱 Scan this QR code in WhatsApp (Linked Devices → Link a Device):\n"));
      qrcode.generate(qr, { small: true });
    },
    onReady: () => {
      console.log(chalk.green.bold("\n✓ WhatsApp Web Connected & Authenticated!\n"));
      readyResolve();
    },
    onAuthFailure: (err) => {
      console.error(chalk.red("\n❌ WhatsApp Auth Failure:"), err);
    },
  });

  client.initialize();
  await readyPromise;

  let running = true;
  while (running) {
    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "🔍  Scan & Sync New Messages Now (Tracked Groups)", value: "scan" },
        { name: "📋  Browse & Select Groups to Track", value: "groups" },
        { name: "🔴  Live Watch Mode (Real-Time Stream & Auto-Ingest)", value: "watch" },
        { name: "📊  View Status & Recently Ingested Events", value: "status" },
        { name: "🚪  Disconnect & Exit", value: "exit" },
      ],
    });

    switch (action) {
      case "scan":
        await handleScanTrackedGroups(client);
        break;
      case "groups":
        await handleManageGroups(client);
        break;
      case "watch":
        await handleLiveWatchMode(client);
        break;
      case "status":
        handleViewStatus();
        break;
      case "exit":
        running = false;
        console.log(chalk.cyan("\nClosing WhatsApp Web session..."));
        await client.destroy();
        console.log(chalk.green("Goodbye!\n"));
        process.exit(0);
    }
  }
}
