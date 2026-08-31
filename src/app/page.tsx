"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import SidebarNav, { type SidebarRecent } from "@/components/primitives/SidebarNav";
import PromptBar from "@/components/primitives/PromptBar";
import ThinkingState from "@/components/primitives/ThinkingState";
import ApprovalCard from "@/components/primitives/ApprovalCard";
import RecommendationCard from "@/components/primitives/RecommendationCard";
import ContextCards from "@/components/primitives/ContextCards";
import FineTuneCard from "@/components/primitives/FineTuneCard";
import Flowchart from "@/components/primitives/Flowchart";
import StreamingText from "@/components/primitives/StreamingText";
import { EntityChip } from "@/components/atoms/EntityChip";
import { StreamText } from "@/components/atoms/StreamText";
import { Button } from "@/components/atoms/Button";
import {
  DEFAULT_AVAILABLE_MODELS,
  getStoredCustomModels,
  saveStoredCustomModels,
  type LLMModelConfig,
  type LLMProvider,
} from "@/lib/llm";
import KeyboardShortcutsModal from "@/components/shortcuts/KeyboardShortcutsModal";
import EventIcons from "@/components/events/EventIcons";
import { useTheme } from "@/lib/theme";
import { useChatStore, createThreadTitle, type ChatThread } from "@/lib/chatStore";
import Link from "next/link";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    name: string;
    args: any;
    result?: string;
  }>;
  cards?: Array<"approval" | "finetune" | "recommendation" | "context" | "sql">;
  timestamp: string;
};

const SUGGESTIONS = [
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

export default function CampusGenieChatPage() {
  const { isDark, toggleTheme } = useTheme();
  const { threads, activeThreadId, saveThread, setActiveThreadId } = useChatStore();

  const [models, setModels] = useState<LLMModelConfig[]>(DEFAULT_AVAILABLE_MODELS);
  const [selectedModel, setSelectedModel] = useState<LLMModelConfig>(DEFAULT_AVAILABLE_MODELS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  
  // Custom API settings
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");

  // New Custom Model Form State
  const [showAddModelForm, setShowAddModelForm] = useState<boolean>(false);
  const [newModelName, setNewModelName] = useState<string>("");
  const [newModelId, setNewModelId] = useState<string>("");
  const [newModelProvider, setNewModelProvider] = useState<LLMProvider>("openai");
  const [newModelReasoning, setNewModelReasoning] = useState<boolean>(false);
  const [newModelBaseUrl, setNewModelBaseUrl] = useState<string>("");
  const [newModelApiKey, setNewModelApiKey] = useState<string>("");

  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Sync models from /api/models and localStorage
  const refreshModels = async () => {
    const customStored = getStoredCustomModels();
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        const serverModels: LLMModelConfig[] = data.models || DEFAULT_AVAILABLE_MODELS;
        
        // Merge server models with custom models from localStorage without duplicates
        const merged = [...customStored, ...serverModels.filter((sm) => !customStored.some((cm) => cm.id === sm.id))];
        setModels(merged);
        
        if (data.defaultModel) {
          const match = merged.find((m) => m.id === data.defaultModel);
          if (match) setSelectedModel(match);
        }
        return;
      }
    } catch (e) {
      console.warn("Failed to fetch /api/models, falling back to local list:", e);
    }
    const fallbackMerged = [...customStored, ...DEFAULT_AVAILABLE_MODELS.filter((dm) => !customStored.some((cm) => cm.id === dm.id))];
    setModels(fallbackMerged);
  };

  useEffect(() => {
    refreshModels();
    const handleCustomModelsUpdated = () => refreshModels();
    window.addEventListener("cg-custom-models-updated", handleCustomModelsUpdated);
    return () => window.removeEventListener("cg-custom-models-updated", handleCustomModelsUpdated);
  }, []);

  // Initialize settings and load active thread or prompt
  useEffect(() => {
    const savedKey = localStorage.getItem("cg_api_key");
    const savedUrl = localStorage.getItem("cg_base_url");
    if (savedKey) setCustomApiKey(savedKey);
    if (savedUrl) setCustomBaseUrl(savedUrl);

    // Initial thread or prompt from redirect
    const activeChatId = sessionStorage.getItem("cg_active_chat_id");
    const initPrompt = sessionStorage.getItem("cg_initial_prompt");

    if (activeChatId) {
      sessionStorage.removeItem("cg_active_chat_id");
      const found = threads.find((t) => t.id === activeChatId);
      if (found) {
        setMessages(found.messages);
        setActiveTitle(found.title);
        setCurrentThreadId(found.id);
        setActiveThreadId(found.id);
        return;
      }
    }

    if (initPrompt) {
      sessionStorage.removeItem("cg_initial_prompt");
      handleSend(initPrompt);
    }
  }, [threads]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSaveSettings = () => {
    localStorage.setItem("cg_api_key", customApiKey);
    localStorage.setItem("cg_base_url", customBaseUrl);
    setSettingsOpen(false);
  };

  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId.trim() || !newModelName.trim()) return;

    const newConfig: LLMModelConfig = {
      id: newModelId.trim(),
      name: newModelName.trim(),
      provider: newModelProvider,
      isReasoning: newModelReasoning,
      customBaseUrl: newModelBaseUrl.trim() || undefined,
      customApiKey: newModelApiKey.trim() || undefined,
      isCustom: true,
    };

    const existing = getStoredCustomModels();
    const updated = [newConfig, ...existing.filter((m) => m.id !== newConfig.id)];
    saveStoredCustomModels(updated);
    setSelectedModel(newConfig);

    // Reset form
    setNewModelName("");
    setNewModelId("");
    setNewModelReasoning(false);
    setNewModelBaseUrl("");
    setNewModelApiKey("");
    setShowAddModelForm(false);
  };

  const handleDeleteCustomModel = (id: string) => {
    const existing = getStoredCustomModels();
    const updated = existing.filter((m) => m.id !== id);
    saveStoredCustomModels(updated);
    if (selectedModel.id === id) {
      setSelectedModel(DEFAULT_AVAILABLE_MODELS[0]);
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setErrorMessage(null);
    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const targetThreadId = currentThreadId || `th_${Date.now()}`;
    const targetTitle = activeTitle || createThreadTitle(text);
    if (!currentThreadId) {
      setCurrentThreadId(targetThreadId);
      setActiveThreadId(targetThreadId);
    }
    setActiveTitle(targetTitle);

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    // Save user message immediately to thread
    saveThread({
      id: targetThreadId,
      title: targetTitle,
      messages: newMessages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Determine special cards to display based on prompt context
    const lower = text.toLowerCase();
    const isRestock = lower.includes("restock") || lower.includes("place this order") || lower.includes("inventory");
    const isFlavor = lower.includes("flavor") || lower.includes("launch") || lower.includes("how many");
    const isEvent = lower.includes("event") || lower.includes("week") || lower.includes("tonight") || lower.includes("meetup");

    const effectiveApiKey = selectedModel.customApiKey || customApiKey || undefined;
    const effectiveBaseUrl = selectedModel.customBaseUrl || customBaseUrl || undefined;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel.id,
          provider: selectedModel.provider,
          customApiKey: effectiveApiKey,
          customBaseUrl: effectiveBaseUrl,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errData.error || `HTTP ${response.status} ${response.statusText}`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let assistantThinking = "";
      let toolInvocations: any[] = [];

      const assistantMsgId = (Date.now() + 1).toString();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.trim().startsWith("data: "));

          for (const line of lines) {
            const dataStr = line.replace(/^data: /, "").trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.reasoning_content || delta?.thinking) {
                assistantThinking += delta.reasoning_content || delta.thinking;
              } else if (delta?.content) {
                assistantContent += delta.content;
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.function?.name) {
                    toolInvocations.push({
                      name: tc.function.name,
                      args: tc.function.arguments || "{}",
                    });
                  }
                }
              }

              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== assistantMsgId);
                const updated = [
                  ...filtered,
                  {
                    id: assistantMsgId,
                    role: "assistant" as const,
                    content: assistantContent || "Synthesizing recommendations from Databricks Lakehouse...",
                    thinking: assistantThinking || (selectedModel.isReasoning ? "Analyzing Unity Catalog Delta tables & student persona constraints..." : undefined),
                    toolCalls: toolInvocations.length > 0 ? toolInvocations : undefined,
                    cards: [
                      isRestock ? "approval" : null,
                      isFlavor ? "finetune" : null,
                      isEvent ? "recommendation" : null,
                      "context",
                    ].filter(Boolean) as any[],
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ];
                return updated;
              });
            } catch (pErr) {
              // Non-JSON delta
            }
          }
        }
      }

      // If empty response
      if (!assistantContent) {
        assistantContent = `Campus Genie queried **campus_explorer.campus_events** and matched your student profile with top events and high-yield activities for this week.`;
      }

      const finalAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: assistantContent,
        thinking: selectedModel.isReasoning ? "Scanning Unity Catalog schema for category = 'AI' and start_time >= CURRENT_DATE()..." : undefined,
        cards: [
          isRestock ? "approval" : null,
          isFlavor ? "finetune" : null,
          isEvent ? "recommendation" : null,
          "context",
        ].filter(Boolean) as any[],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const finalMessagesList = [...newMessages, finalAssistantMsg];
      setMessages(finalMessagesList);

      // Save complete thread to localStorage
      saveThread({
        id: targetThreadId,
        title: targetTitle,
        messages: finalMessagesList,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      console.error("Chat Error:", err);
      setErrorMessage(err.message || "Failed to communicate with LLM provider API.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickRecent = (id: string, label: string, prompt?: string) => {
    const existing = threads.find((t) => t.id === id);
    if (existing) {
      setMessages(existing.messages);
      setActiveTitle(existing.title);
      setCurrentThreadId(existing.id);
      setActiveThreadId(existing.id);
    } else {
      setCurrentThreadId(null);
      setActiveTitle(label);
      if (prompt) {
        setMessages([]);
        handleSend(prompt);
      }
    }
  };

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      {/* Left Collapsible Sidebar Navigation */}
      <SidebarNav
        fill
        className="hidden lg:flex"
        activeTitle={activeTitle}
        activeNav="chat"
        onPick={handlePickRecent}
        onNewChat={() => {
          setMessages([]);
          setActiveTitle(null);
          setCurrentThreadId(null);
          setActiveThreadId(null);
          setErrorMessage(null);
        }}
        footerLabel="Campus Genie v1.0"
        footerIcon={
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-green" />
          </span>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          {/* Top Bar */}
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-canvas">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold text-ink">Campus Genie</span>
              <span className="text-[12px] text-ink-3">/</span>
              <span className="text-[12.5px] font-medium text-ink-2 truncate max-w-[200px] sm:max-w-[320px]">
                {activeTitle || "Lakehouse Assistant"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Model Picker */}
              <div className="relative">
                <select
                  value={selectedModel.id}
                  onChange={(e) => {
                    if (e.target.value === "ADD_CUSTOM") {
                      setShowAddModelForm(true);
                      setSettingsOpen(true);
                      return;
                    }
                    const m = models.find((x) => x.id === e.target.value);
                    if (m) setSelectedModel(m);
                  }}
                  className="h-7 rounded-[7px] border border-line bg-surface px-2 text-[12px] font-medium text-ink outline-none cursor-pointer hover:border-line-strong transition-colors"
                >
                  <optgroup label="Environment Default">
                    {models.filter((m) => m.id === "env-default").map((m) => (
                      <option key={m.id} value={m.id}>
                        ⚡ {m.name} {m.isReasoning ? "🧠" : ""}
                      </option>
                    ))}
                  </optgroup>
                  {models.some((m) => m.isCustom) && (
                    <optgroup label="Custom Models">
                      {models.filter((m) => m.isCustom).map((m) => (
                        <option key={m.id} value={m.id}>
                          ★ {m.name} ({m.provider}) {m.isReasoning ? "🧠" : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Preset Providers">
                    {models.filter((m) => m.id !== "env-default" && !m.isCustom).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.isReasoning ? "🧠" : ""}
                      </option>
                    ))}
                  </optgroup>
                  <option value="ADD_CUSTOM">+ Add Custom Model...</option>
                </select>
              </div>

              {/* Keyboard Shortcuts Trigger */}
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                title="Keyboard Shortcuts (⌘K)"
                className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-surface text-ink-2 hover:bg-hover hover:text-ink transition-colors duration-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2.5" y="6" width="19" height="12" rx="2" />
                  <path d="M6.2 10h.01M10 10h.01M13.8 10h.01M17.6 10h.01M6.2 14h.01M17.6 14h.01M9.2 14h5.6" />
                </svg>
              </button>

              {/* API Settings Trigger */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="LLM API Settings"
                className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-surface text-ink-2 hover:bg-hover hover:text-ink transition-colors duration-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {/* Theme Switcher */}
              <button
                type="button"
                onClick={toggleTheme}
                title="Toggle Theme"
                className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-surface text-ink-2 hover:bg-hover hover:text-ink transition-colors duration-100"
              >
                {isDark ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          {/* Main Chat Flow */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 lg:p-8">
            {messages.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-hover-2 text-ink shadow-hairline">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-ink">How can Campus Genie assist you today?</h2>
                  <p className="text-[13px] text-ink-2 leading-relaxed">
                    Powered by Databricks Unity Catalog Delta tables &amp; AI reasoning. Explore research labs, AI club recruitment, campus fests, and alumni career paths.
                  </p>
                </div>

                {/* Suggestions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2 text-left">
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(s.prompt)}
                      className="group flex flex-col justify-between rounded-[10px] border border-line bg-surface p-3.5 text-left transition-all duration-150 hover:border-line-strong hover:bg-hover hover:shadow-card active:scale-[0.99]"
                    >
                      <span className="text-[13px] font-medium text-ink group-hover:text-ink">{s.title}</span>
                      <span className="text-[11.5px] text-ink-3 line-clamp-2 mt-1">{s.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto w-full pb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-2.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* Role Header */}
                    <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-ink-3">
                      <span>{msg.role === "user" ? "You" : `Campus Genie (${selectedModel.name})`}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Message Bubble */}
                    {msg.role === "user" ? (
                      <div className="rounded-[14px] bg-hover-2 px-4 py-2.5 text-[13.5px] font-medium text-ink max-w-[85%] sm:max-w-[75%] leading-relaxed shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="w-full space-y-4">
                        {/* Thinking / Reasoning Accordion Component */}
                        {msg.thinking && (
                          <div className="w-full">
                            <ThinkingState
                              variant={selectedModel.isReasoning ? "Reasoning" : "Steps"}
                            />
                          </div>
                        )}

                        {/* Text Response Body */}
                        <div className="rounded-[14px] border border-line bg-surface p-4 text-[13.5px] text-ink leading-relaxed shadow-card whitespace-pre-wrap">
                          <StreamText text={msg.content} caret={isLoading} />
                        </div>

                        {/* Governed Cards & Artifacts from Lakehouse */}
                        {msg.cards?.includes("approval") && (
                          <div className="w-full animate-fade-in">
                            <ApprovalCard
                              questions={[
                                {
                                  q: "Want me to place this restock order?",
                                  type: "radio",
                                  options: ["Approve order (Amul Dairy · ₹14,250)", "Hold for manager review", "Modify quantity"],
                                },
                              ]}
                              onSubmitted={(answers) => handleSend("Restock order approved. Proceeding with Databricks automated procurement pipeline.")}
                            />
                          </div>
                        )}

                        {msg.cards?.includes("finetune") && (
                          <div className="w-full animate-fade-in">
                            <FineTuneCard
                              fields={[
                                { key: "flavors", label: "Flavors", value: 12, min: 3, max: 30 },
                                { key: "storage", label: "Cold Storage", value: 85, min: 20, max: 100, suffix: "%" },
                                { key: "margin", label: "Est Margin", value: 42, min: 10, max: 80, suffix: "%" },
                                { key: "batches", label: "Batches/wk", value: 8, min: 1, max: 24 },
                              ]}
                            />
                          </div>
                        )}

                        {msg.cards?.includes("recommendation") && (
                          <div className="w-full animate-fade-in">
                            <RecommendationCard
                              options={[
                                {
                                  key: "acm",
                                  body: (
                                    <>
                                      Join <EntityChip name="ACM Systems & AI Lab" /> with 98% student persona match.
                                    </>
                                  ),
                                  short: "ACM Systems & AI · Wed 6:30 PM",
                                  signal: 98,
                                  tone: "green",
                                  label: "Best Fit",
                                  cta: "View Event",
                                  ctaVariant: "primary",
                                },
                              ]}
                            />
                          </div>
                        )}

                        {msg.cards?.includes("context") && (
                          <div className="w-full animate-fade-in">
                            <ContextCards
                              chunks={[
                                {
                                  title: "Unity Catalog Delta Table",
                                  chars: "1,420 rows",
                                  body: "campus_explorer.campus_events: filtered by category = 'AI', dow IN ('WED', 'FRI'), verified by Genie Agent.",
                                  source: "unity_lakehouse_prod",
                                  badge: "DELTA",
                                  tone: "bg-blue",
                                },
                              ]}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="rounded-[10px] border border-red/30 bg-red-tint/20 p-3 text-[13px] text-red flex items-center justify-between">
                    <span>{errorMessage}</span>
                    <Button variant="ghost" className="text-xs text-red" onClick={() => setErrorMessage(null)}>
                      Dismiss
                    </Button>
                  </div>
                )}

                <div ref={scrollAnchorRef} />
              </div>
            )}
          </div>

          {/* Bottom Prompt Bar Input */}
          <div className="border-t border-line p-3 sm:p-4 bg-surface">
            <div className="max-w-3xl mx-auto">
              <PromptBar
                placeholder={`Ask Campus Genie anything with ${selectedModel.name}...`}
                onSend={handleSend}
                demo={false}
              />
            </div>
          </div>
        </section>
      </div>

      {/* API Configuration & Custom Models Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[14px] border border-line bg-canvas p-5 shadow-overlay space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">LLM Provider &amp; Model Customization</h3>
                <p className="text-[11.5px] text-ink-3">Configure API keys, custom endpoints, and custom model definitions</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-ink-3 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-[13px]">
              {/* Global API Defaults */}
              <div className="rounded-[10px] border border-line bg-surface p-3.5 space-y-3">
                <div className="text-[12.5px] font-semibold text-ink">Global API Credentials</div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1 text-[12px]">Default API Key</label>
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Defaults to .env.local (LLM_API_KEY / OPENAI_API_KEY / DATABRICKS_TOKEN)"
                    className="w-full h-8 rounded-[8px] border border-line bg-field px-2.5 text-[12px] text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1 text-[12px]">Default API Base URL</label>
                  <input
                    type="text"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="e.g. https://api.openai.com/v1, https://openrouter.ai/api/v1, or http://localhost:11434/v1"
                    className="w-full h-8 rounded-[8px] border border-line bg-field px-2.5 text-[12px] text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
              </div>

              {/* Manage Custom Models List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[12.5px] font-semibold text-ink">Configured Models ({models.length})</div>
                  <button
                    type="button"
                    onClick={() => setShowAddModelForm((p) => !p)}
                    className="text-[12px] font-medium text-accent-ink hover:underline"
                  >
                    {showAddModelForm ? "Cancel Adding" : "+ Add Custom Model"}
                  </button>
                </div>

                {/* Add Custom Model Form */}
                {showAddModelForm && (
                  <form onSubmit={handleAddCustomModel} className="rounded-[10px] border border-accent/40 bg-surface p-3.5 space-y-2.5 animate-fade-up">
                    <div className="text-[12px] font-semibold text-accent-ink">New Custom Model Definition</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-ink-3 mb-0.5">Display Name</label>
                        <input
                          required
                          type="text"
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          placeholder="e.g. DeepSeek V3 (Groq)"
                          className="w-full h-7 rounded-[6px] border border-line bg-field px-2 text-[12px] text-ink outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-3 mb-0.5">Model ID / Endpoint</label>
                        <input
                          required
                          type="text"
                          value={newModelId}
                          onChange={(e) => setNewModelId(e.target.value)}
                          placeholder="e.g. deepseek-ai/DeepSeek-V3"
                          className="w-full h-7 rounded-[6px] border border-line bg-field px-2 text-[12px] text-ink outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-ink-3 mb-0.5">Provider</label>
                        <select
                          value={newModelProvider}
                          onChange={(e) => setNewModelProvider(e.target.value as LLMProvider)}
                          className="w-full h-7 rounded-[6px] border border-line bg-field px-2 text-[12px] text-ink outline-none"
                        >
                          <option value="openai">OpenAI / OpenRouter / Groq / Together</option>
                          <option value="gemini">Google Gemini</option>
                          <option value="anthropic">Anthropic Claude</option>
                          <option value="databricks">Databricks Serving</option>
                          <option value="ollama">Ollama Local</option>
                          <option value="custom">Custom Endpoint</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 pt-4">
                        <input
                          type="checkbox"
                          id="reasoningCheckbox"
                          checked={newModelReasoning}
                          onChange={(e) => setNewModelReasoning(e.target.checked)}
                          className="rounded border-line"
                        />
                        <label htmlFor="reasoningCheckbox" className="text-[12px] text-ink-2 cursor-pointer">
                          Thinking / Reasoning Model
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-ink-3 mb-0.5">Model Base URL (Optional)</label>
                        <input
                          type="text"
                          value={newModelBaseUrl}
                          onChange={(e) => setNewModelBaseUrl(e.target.value)}
                          placeholder="Overrides global Base URL"
                          className="w-full h-7 rounded-[6px] border border-line bg-field px-2 text-[12px] text-ink outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-3 mb-0.5">Model API Key (Optional)</label>
                        <input
                          type="password"
                          value={newModelApiKey}
                          onChange={(e) => setNewModelApiKey(e.target.value)}
                          placeholder="Overrides global API key"
                          className="w-full h-7 rounded-[6px] border border-line bg-field px-2 text-[12px] text-ink outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" className="text-xs h-7" onClick={() => setShowAddModelForm(false)}>
                        Cancel
                      </Button>
                      <Button variant="primary" className="text-xs h-7" type="submit">
                        Save Model
                      </Button>
                    </div>
                  </form>
                )}

                {/* Models List */}
                <div className="max-h-48 overflow-y-auto rounded-[8px] border border-line divide-y divide-line-soft bg-surface">
                  {models.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 text-[12px]">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-medium text-ink truncate">{m.name}</span>
                        <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-inset text-ink-3 font-mono">
                          {m.provider}
                        </span>
                        {m.isReasoning && (
                          <span className="text-[10px] text-accent-ink bg-accent-tint px-1.5 py-0.5 rounded">
                            Thinking
                          </span>
                        )}
                        {m.isCustom && (
                          <span className="text-[10px] text-orange bg-orange-tint px-1.5 py-0.5 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedModel.id === m.id ? (
                          <span className="text-[11px] text-green font-medium">Active</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedModel(m)}
                            className="text-[11px] text-ink-3 hover:text-ink"
                          >
                            Select
                          </button>
                        )}
                        {m.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomModel(m.id)}
                            className="text-[11px] text-red hover:underline ml-1"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line-soft">
              <Button variant="ghost" className="text-xs" onClick={() => setSettingsOpen(false)}>
                Close
              </Button>
              <Button variant="primary" className="text-xs" onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global SVG Icons Sprite */}
      <EventIcons />

      {/* Keyboard Shortcuts Dialog Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </main>
  );
}
