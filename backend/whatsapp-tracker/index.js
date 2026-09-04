#!/usr/bin/env node

import {
  startInteractiveCli,
  handleScanTrackedGroups,
  handleManageGroups,
  handleLiveWatchMode,
  handleViewStatus,
  printBanner,
} from "./src/cli.js";
import { createWhatsAppClient } from "./src/whatsapp.js";
import qrcode from "qrcode-terminal";
import chalk from "chalk";

const args = process.argv.slice(2);

function exitOnAuthFailure(client) {
  client.on("auth_failure", (msg) => {
    console.error(chalk.red("\n❌ WhatsApp Authentication failed:"), msg);
    console.error(chalk.yellow("Delete the .wwebjs_auth folder and re-run to scan a fresh QR code."));
    process.exit(1);
  });
}

function printHelp() {
  console.log(`
${chalk.bold("Campus Genie — WhatsApp Event Tracker")}

Usage: node index.js [flag]

Flags:
  -s, --scan     One-time sync of new messages across tracked groups
  -w, --watch    Live watch mode (catches up on backlog, then auto-ingests in real time)
  -g, --groups   Browse and select WhatsApp groups to track
      --status   Show tracked groups and recently ingested events (no WhatsApp connection needed)
  -h, --help     Show this help

Run without flags for the full interactive menu.
`);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--status")) {
    printBanner();
    handleViewStatus();
    return;
  }

  if (args.includes("--scan") || args.includes("-s")) {
    printBanner();
    console.log(chalk.blue("Starting automated scan... Connecting WhatsApp Web..."));
    const client = createWhatsAppClient({
      onQr: (qr) => qrcode.generate(qr, { small: true }),
      onReady: async () => {
        console.log(chalk.green("✓ Connected!"));
        await handleScanTrackedGroups(client);
        await client.destroy();
        process.exit(0);
      },
    });
    exitOnAuthFailure(client);
    client.initialize();
    return;
  }

  if (args.includes("--watch") || args.includes("-w")) {
    printBanner();
    console.log(chalk.blue("Starting Live Watch Mode... Connecting WhatsApp Web..."));
    const client = createWhatsAppClient({
      onQr: (qr) => qrcode.generate(qr, { small: true }),
      onReady: async () => {
        console.log(chalk.green("✓ Connected!"));
        await handleLiveWatchMode(client);
        await client.destroy();
        process.exit(0);
      },
    });
    exitOnAuthFailure(client);
    client.initialize();
    return;
  }

  if (args.includes("--groups") || args.includes("-g")) {
    printBanner();
    console.log(chalk.blue("Connecting to WhatsApp Web to browse groups..."));
    const client = createWhatsAppClient({
      onQr: (qr) => qrcode.generate(qr, { small: true }),
      onReady: async () => {
        console.log(chalk.green("✓ Connected!"));
        await handleManageGroups(client);
        await client.destroy();
        process.exit(0);
      },
    });
    exitOnAuthFailure(client);
    client.initialize();
    return;
  }

  // Default: Start full interactive menu
  await startInteractiveCli();
}

main().catch((err) => {
  console.error(chalk.red("\n❌ Fatal Error:"), err);
  process.exit(1);
});
