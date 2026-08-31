"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "@/app/page";

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "cg_chat_threads";
const ACTIVE_THREAD_KEY = "cg_active_thread_id";

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

export function getStoredThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse chat threads", e);
    return [];
  }
}

export function saveStoredThreads(threads: ChatThread[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    window.dispatchEvent(new Event("cg-threads-updated"));
  } catch (e) {
    console.error("Failed to save chat threads", e);
  }
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
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setThreads(getStoredThreads());
      setActiveId(getActiveThreadId());
    };
    sync();

    window.addEventListener("cg-threads-updated", sync);
    window.addEventListener("cg-active-thread-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cg-threads-updated", sync);
      window.removeEventListener("cg-active-thread-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const saveThread = (thread: ChatThread) => {
    const existing = getStoredThreads();
    const idx = existing.findIndex((t) => t.id === thread.id);
    let updated: ChatThread[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...thread, updatedAt: Date.now() };
    } else {
      updated = [{ ...thread, updatedAt: Date.now() }, ...existing];
    }
    saveStoredThreads(updated);
    setThreads(updated);
    setActiveThreadId(thread.id);
  };

  const deleteThread = (id: string) => {
    const existing = getStoredThreads();
    const updated = existing.filter((t) => t.id !== id);
    saveStoredThreads(updated);
    setThreads(updated);
    if (activeThreadId === id) {
      setActiveThreadId(null);
    }
  };

  return {
    threads,
    activeThreadId,
    saveThread,
    deleteThread,
    setActiveThreadId,
  };
}
