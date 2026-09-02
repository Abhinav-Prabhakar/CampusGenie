#!/usr/bin/env node

import {
  startInteractiveCli,
  handleScanTrackedGroups,
  handleManageGroups,
  handleLiveWatchMode,
  printBanner,
} from "./src/cli.js";
import { createWhatsAppClient } from "./src/whatsapp.js";
import qrcode from "qrcode-terminal";
import chalk from "chalk";

const args = process.argv.slice(2);

async function main() {
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
      },
    });
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
