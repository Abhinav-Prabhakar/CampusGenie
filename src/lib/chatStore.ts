"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/app/page";

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

const ACTIVE_THREAD_KEY = "cg_active_thread_id";
/** Legacy pre-account storage; migrated to the Lakehouse on first load. */
const LEGACY_STORAGE_KEY = "cg_chat_threads";

export const INITIAL_SUGGESTIONS = [
  {
    title: "Don't let me waste my week",
    prompt: "What should a 3rd-year CSE student who loves AI and has Friday evening free do this week on campus and in Bengaluru?",
  },
  {
    title: "Want me to place this restock order?",
    prompt: "Check dairy and waffle cone inventory for the campus cafe and prepare a restock approval order.",
  },
  {
    title: "How many flavors should we launch?",
    prompt: "Simulate summer demand patterns from past campus fests and recommend how many ice cream flavors to launch.",
  },
  {
    title: "Find my AI research tribe",
    prompt: "Find active campus research labs and student clubs working on LLMs with recruitment open right now.",
  },
  {
    title: "Alumni pathways: ML vs Systems",
    prompt: "Compare career trajectories and club involvement of alumni who landed AI research roles vs Big Tech SDE.",
  },
];

/* ─────────────────────────────────────────────────────────
 * Server-backed thread store (Databricks Lakehouse, per user).
 * A module-level cache keeps every hook instance in sync and
 * prevents duplicate fetches across mounts.
 * ───────────────────────────────────────────────────────── */
let threadCache: ChatThread[] | null = null;
let inFlightRefresh: Promise<ChatThread[]> | null = null;

function readLegacyThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function migrateLegacyThreads(): Promise<boolean> {
  const legacy = readLegacyThreads();
  if (legacy.length === 0) return false;
  const results = await Promise.all(
    legacy.map((t) =>
      fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      }).catch(() => null)
    )
  );
  if (results.some((r) => r?.ok)) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  }
  return false;
}

export async function refreshThreads(): Promise<ChatThread[]> {
  if (threadCache) return threadCache;
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    let threads: ChatThread[] = [];
    try {
      const res = await fetch("/api/threads", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        threads = Array.isArray(data.threads) ? data.threads : [];
      }
    } catch {
      // offline / signed out — keep empty list
    }

    if (threads.length === 0) {
      try {
        if (await migrateLegacyThreads()) {
          const retry = await fetch("/api/threads", { cache: "no-store" });
          if (retry.ok) {
            const data = await retry.json();
            threads = Array.isArray(data.threads) ? data.threads : [];
          }
        }
      } catch {
        // migration is best-effort
      }
    }

    threadCache = threads;
    inFlightRefresh = null;
    window.dispatchEvent(new Event("cg-threads-updated"));
    return threads;
  })();

  return inFlightRefresh;
}

function setCachedThreads(threads: ChatThread[]) {
  threadCache = threads;
  window.dispatchEvent(new Event("cg-threads-updated"));
}

export function getActiveThreadId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_THREAD_KEY);
}

export function setActiveThreadId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_THREAD_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_THREAD_KEY);
  }
  window.dispatchEvent(new Event("cg-active-thread-changed"));
}

export function createThreadTitle(query: string): string {
  const cleaned = query.replace(/^["'\s]+|["'\s]+$/g, "").trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 6) return cleaned;
  return words.slice(0, 6).join(" ") + "…";
}

export function useChatStore() {
  const [threads, setThreads] = useState<ChatThread[]>(threadCache ?? []);
  const [activeThreadId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      if (threadCache) setThreads(threadCache);
      setActiveId(getActiveThreadId());
    };
    sync();
    refreshThreads().then(setThreads);

    window.addEventListener("cg-threads-updated", sync);
    window.addEventListener("cg-active-thread-changed", sync);
    return () => {
      window.removeEventListener("cg-threads-updated", sync);
      window.removeEventListener("cg-active-thread-changed", sync);
    };
  }, []);

  const saveThread = useCallback((thread: ChatThread) => {
    const next = threadCache ?? [];
    const idx = next.findIndex((t) => t.id === thread.id);
    const updated = { ...thread, updatedAt: Date.now() };
    const list = idx >= 0 ? next.map((t, i) => (i === idx ? updated : t)) : [updated, ...next];
    setCachedThreads(list);
    setActiveThreadId(thread.id);

    fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch((e) => console.error("Failed to persist chat thread", e));
  }, []);

  const deleteThread = useCallback((id: string) => {
    const next = (threadCache ?? []).filter((t) => t.id !== id);
    setCachedThreads(next);
    if (getActiveThreadId() === id) {
      setActiveThreadId(null);
    }

    fetch(`/api/threads?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch((e) =>
      console.error("Failed to delete chat thread", e)
    );
  }, []);

  return {
    threads,
    activeThreadId,
    saveThread,
    deleteThread,
    setActiveThreadId,
  };
}
