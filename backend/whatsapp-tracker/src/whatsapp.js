import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { CONFIG } from "./config.js";

/**
 * Create and initialize the WhatsApp Web Client
 */
export function createWhatsAppClient({ onQr, onReady, onAuthFailure } = {}) {
  // By default Chromium inherits the OS proxy; local proxies (Charles,
  // Proxyman, Zscaler...) reject WhatsApp's WebSocket upgrade so the QR code
  // never renders. Bypass unless an explicit proxy was configured.
  const proxyArgs = CONFIG.whatsappProxyServer
    ? [`--proxy-server=${CONFIG.whatsappProxyServer}`]
    : ["--no-proxy-server"];

  const launchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      ...proxyArgs,
    ],
  };

  // Allow recovering from a corrupt Puppeteer browser cache by pointing at
  // any installed Chrome/Chromium build.
  if (CONFIG.puppeteerExecutablePath) {
    launchOptions.executablePath = CONFIG.puppeteerExecutablePath;
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: CONFIG.sessionPath,
    }),
    // The library's default UA claims Chrome/101 (2022); WhatsApp serves a
    // degraded login flow to stale UAs, so present a current one.
    userAgent: CONFIG.whatsappUserAgent,
    puppeteer: launchOptions,
  });

  client.on("qr", (qr) => {
    if (onQr) {
      onQr(qr);
    } else {
      console.log("\n📱 Please scan this QR code with WhatsApp on your phone:\n");
      qrcode.generate(qr, { small: true });
    }
  });

  client.on("ready", () => {
    if (onReady) onReady();
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ WhatsApp Authentication failed:", msg);
    if (onAuthFailure) onAuthFailure(msg);
  });

  return client;
}

/**
 * Fetch all group chats accessible to this WhatsApp account
 */
export async function fetchAllGroups(client) {
  const chats = await client.getChats();
  const groups = chats
    .filter((chat) => chat.isGroup)
    .map((group) => ({
      id: group.id._serialized,
      name: group.name || "Unnamed Group",
      unreadCount: group.unreadCount || 0,
      participantCount: group.participants?.length || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return groups;
}

/**
 * Fetch unread or new messages from a specific group since a given UNIX timestamp
 */
export async function fetchNewGroupMessages(client, groupId, sinceTimestamp = 0, limit = 50, lastMessageId = null) {
  try {
    const chat = await client.getChatById(groupId);
    if (!chat) return [];

    // Fetch up to `limit` recent messages
    const messages = await chat.fetchMessages({ limit });

    // Messages strictly after the cursor; `===` siblings of the cursor
    // message are re-checked (minus the cursor itself) so messages sharing
    // the cursor's second are never dropped.
    const newMessages = messages
      .filter((m) => {
        const ts = m.timestamp || 0;
        if (ts < sinceTimestamp) return false;
        if (ts === sinceTimestamp && m.id._serialized === lastMessageId) return false;
        return Boolean(m.body && m.body.trim().length > 0);
      })
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return newMessages.map((m) => ({
      id: m.id._serialized,
      body: m.body,
      timestamp: m.timestamp,
      senderName: m._data?.notifyName || m.author || m.from || "Member",
      fromMe: m.fromMe,
    }));
  } catch (err) {
    console.warn(`[WhatsApp] Failed to fetch messages for group ${groupId}:`, err.message);
    return [];
  }
}
