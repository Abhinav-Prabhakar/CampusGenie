import fs from "fs";
import path from "path";
import { CONFIG } from "./config.js";

const DEFAULT_STATE = {
  version: 1,
  lastRunAt: null,
  trackedGroups: [],
  extractedEvents: [],
};

export function loadState() {
  try {
    if (!fs.existsSync(CONFIG.statePath)) {
      const dir = path.dirname(CONFIG.statePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG.statePath, JSON.stringify(DEFAULT_STATE, null, 2), "utf8");
      return { ...DEFAULT_STATE };
    }
    const raw = fs.readFileSync(CONFIG.statePath, "utf8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (err) {
    console.error("[State] Failed to load tracker state, using defaults:", err.message);
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state) {
  try {
    const dir = path.dirname(CONFIG.statePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG.statePath, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("[State] Failed to save tracker state:", err.message);
  }
}

export function getTrackedGroups() {
  const state = loadState();
  return state.trackedGroups || [];
}

export function setTrackedGroups(groups) {
  const state = loadState();
  const existingMap = new Map((state.trackedGroups || []).map((g) => [g.id, g]));

  const updated = groups.map((g) => {
    const prev = existingMap.get(g.id);
    return {
      id: g.id,
      name: g.name,
      addedAt: prev?.addedAt || new Date().toISOString(),
      lastMessageTimestamp: prev?.lastMessageTimestamp || Math.floor(Date.now() / 1000) - 86400 * 3, // default lookback 3 days
      lastMessageId: prev?.lastMessageId || null,
    };
  });

  state.trackedGroups = updated;
  saveState(state);
  return state.trackedGroups;
}

export function updateGroupCursor(groupId, lastMessageTimestamp, lastMessageId) {
  const state = loadState();
  const group = state.trackedGroups.find((g) => g.id === groupId);
  if (group) {
    if (lastMessageTimestamp && lastMessageTimestamp > (group.lastMessageTimestamp || 0)) {
      group.lastMessageTimestamp = lastMessageTimestamp;
    }
    if (lastMessageId) {
      group.lastMessageId = lastMessageId;
    }
  }
  state.lastRunAt = new Date().toISOString();
  saveState(state);
}

export function recordExtractedEvent(eventMeta) {
  const state = loadState();
  if (!state.extractedEvents) state.extractedEvents = [];
  state.extractedEvents.unshift(eventMeta);
  if (state.extractedEvents.length > 200) {
    state.extractedEvents = state.extractedEvents.slice(0, 200);
  }
  saveState(state);
}
