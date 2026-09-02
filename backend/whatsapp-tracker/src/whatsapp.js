import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { CONFIG } from "./config.js";

/**
 * Create and initialize the WhatsApp Web Client
 */
export function createWhatsAppClient({ onQr, onReady, onAuthFailure } = {}) {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: CONFIG.sessionPath,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
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
export async function fetchNewGroupMessages(client, groupId, sinceTimestamp = 0, limit = 50) {
  try {
    const chat = await client.getChatById(groupId);
    if (!chat) return [];

    // Fetch up to `limit` recent messages
    const messages = await chat.fetchMessages({ limit });

    // Filter to messages created strictly after the cursor timestamp
    const newMessages = messages
      .filter((m) => {
        const ts = m.timestamp || 0;
        return ts > sinceTimestamp && m.body && m.body.trim().length > 0;
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
