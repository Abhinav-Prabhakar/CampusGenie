// One-off check: does the WhatsApp Web client boot (puppeteer launch + QR event)?
// Exits 0 when a QR code is generated (WhatsApp Web reachable), 1 on failure/timeout.
import qrcode from "qrcode-terminal";
import { createWhatsAppClient } from "../src/whatsapp.js";

const TIMEOUT_MS = 90_000;

const client = createWhatsAppClient({
  onQr: (qr) => {
    console.log("\n✓ QR RECEIVED — puppeteer + WhatsApp Web connection verified");
    console.log(qrcode.generate(qr, { small: true }));
    console.log("(Not scanning — this is only a connectivity check.)\n");
    client
      .destroy()
      .catch(() => {})
      .finally(() => process.exit(0));
  },
  onReady: () => {
    console.log("✓ READY — existing session authenticated");
    client
      .destroy()
      .catch(() => {})
      .finally(() => process.exit(0));
  },
  onAuthFailure: (msg) => {
    console.error("❌ AUTH FAILURE:", msg);
    process.exit(1);
  },
});

const timeout = setTimeout(() => {
  console.error(`❌ TIMEOUT: no QR or ready event within ${TIMEOUT_MS / 1000}s`);
  process.exit(1);
}, TIMEOUT_MS);

client.on("disconnected", (reason) => {
  console.error("❌ DISCONNECTED:", reason);
  process.exit(1);
});

try {
  client.initialize();
} catch (err) {
  console.error("❌ INITIALIZATION ERROR:", err.message);
  process.exit(1);
} finally {
  timeout.unref?.();
}
