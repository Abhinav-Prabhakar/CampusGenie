"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import SidebarNav, { type SidebarRecent } from "@/components/primitives/SidebarNav";
import PromptBar, { type RoutingMode } from "@/components/primitives/PromptBar";
import ThinkingState from "@/components/primitives/ThinkingState";
import LoadingState from "@/components/primitives/LoadingState";
import ApprovalCard from "@/components/primitives/ApprovalCard";
import RecommendationCard from "@/components/primitives/RecommendationCard";
import FineTuneCard from "@/components/primitives/FineTuneCard";
import MarkdownMessage from "@/components/primitives/MarkdownMessage";
import { EntityChip } from "@/components/atoms/EntityChip";
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
import ChatEventCards from "@/components/events/ChatEventCards";
import type { EventRecord } from "@/app/api/events/route";
import type { ApprovalQuestion } from "@/components/primitives/ApprovalCard";
import "@/app/events.css";

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
  events?: EventRecord[];
  questions?: ApprovalQuestion[];
  approvalCard?: {
    title: string;
    description?: string;
    itemName?: string;
    costOrLocation?: string;
  };
  recommendation?: {
    title: string;
    subtitle?: string;
    short?: string;
    label?: string;
    eventId?: string;
  };
  finetune?: boolean;
  timestamp: string;
};

const SUGGESTIONS = [
  {
    title: "Don't let me waste my week",
    prompt: "What should a 3rd-year CSE student who loves AI and has Friday evening free do this week on campus and in Bengaluru?",
  },
  {
    title: "Events with free food this week",
    prompt: "What campus workshops, mixers, or hackathons are offering free food and meals this week?",
  },
  {
    title: "Find active research labs & clubs",
    prompt: "Find active campus research labs (AI, Systems) and student technical clubs with open project recruitments right now.",
  },
  {
    title: "Alumni pathways: ML vs Systems",
    prompt: "Compare career trajectories and club involvement of alumni who landed AI research roles vs Big Tech SDE.",
  },
  {
    title: "Preference & Track Survey",
    prompt: "Guide me through choosing a hackathon track or campus club by asking me clarifying questions about my interests and tech stack.",
  },
  {
    title: "Check cafe inventory & supplies",
    prompt: "Check campus cafe dairy and waffle cones inventory levels in Databricks Lakehouse.",
  },
];

function normalizeQuestions(raw: any): ApprovalQuestion[] | null {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.questions)
      ? parsed.questions
      : Array.isArray(parsed.survey)
        ? parsed.survey
        : Array.isArray(parsed.items)
          ? parsed.items
          : Array.isArray(parsed.data)
            ? parsed.data
            : null;
  if (!list || list.length === 0) return null;

  return list.map((item: any, idx: number) => {
    if (typeof item === "string") {
      return {
        id: `q_${idx}`,
        q: item,
        type: "radio",
        options: ["Yes", "No", "Maybe"],
        allowCustom: true,
      };
    }
    const rawOptions = Array.isArray(item.options)
      ? item.options
      : Array.isArray(item.choices)
        ? item.choices
        : Array.isArray(item.answers)
          ? item.answers
          : ["Yes", "No"];
    const options = rawOptions.map((opt: any) =>
      typeof opt === "string" ? opt : opt?.label || opt?.text || opt?.title || String(opt)
    );
    const rawType = String(item.type || item.selectionType || item.mode || "").toLowerCase();
    const type: "radio" | "check" =
      rawType.includes("check") || rawType.includes("multi") ? "check" : "radio";
    return {
      id: item.id || `q_${idx}`,
      q: item.q || item.question || item.title || item.prompt || `Question ${idx + 1}`,
      type,
      options: options.length > 0 ? options : ["Yes", "No"],
      allowCustom: item.allowCustom !== false,
    };
  });
}

function resolveRelevantEvents(
  toolEventIds: string[],
  content: string,
  allEvents: EventRecord[]
): EventRecord[] {
  const matched = new Map<string, EventRecord>();

  // 1. Explicit tool call IDs (from show_events_grid or search_events)
  if (Array.isArray(toolEventIds)) {
    for (const id of toolEventIds) {
      if (!id || typeof id !== "string") continue;
      const cleanId = id.trim().toUpperCase().replace(/^EV(\d+)$/, "EV-$1");
      const ev = allEvents.find(
        (e) =>
          e.id.toUpperCase() === cleanId ||
          e.id.replace("-", "").toUpperCase() === cleanId.replace("-", "")
      );
      if (ev) matched.set(ev.id, ev);
    }
  }

  // 2. Mentioned event IDs in the assistant's final response text (e.g. EV-01, EV-10)
  if (content && typeof content === "string") {
    const idMatches = content.match(/\bEV-?\d+\b/gi) || [];
    for (const raw of idMatches) {
      const norm = raw.toUpperCase().replace(/^EV(\d+)$/, "EV-$1");
      const ev = allEvents.find((e) => e.id === norm || e.id.replace("-", "") === norm.replace("-", ""));
      if (ev) matched.set(ev.id, ev);
    }

    // 3. Exact full title match in the assistant's response text
    for (const ev of allEvents) {
      if (ev.title && ev.title.length > 6) {
        if (content.toLowerCase().includes(ev.title.toLowerCase())) {
          matched.set(ev.id, ev);
        }
      }
    }
  }

  // Return strictly matching events; if none explicitly referenced, return empty array (no random cards)
  return Array.from(matched.values());
}

export default function CampusGenieChatPage() {
  const { isDark, toggleTheme } = useTheme();
  const { threads, activeThreadId, saveThread, deleteThread, setActiveThreadId } = useChatStore();

  const [models, setModels] = useState<LLMModelConfig[]>(DEFAULT_AVAILABLE_MODELS);
  const [selectedModel, setSelectedModel] = useState<LLMModelConfig>(DEFAULT_AVAILABLE_MODELS[0]);
  const [routingMode, setRoutingMode] = useState<RoutingMode>("auto");
  const [rateLimitBlocked, setRateLimitBlocked] = useState<boolean>(false);
  const [rateLimitSecondsRemaining, setRateLimitSecondsRemaining] = useState<number>(0);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  
  // Rate limit countdown effect
  useEffect(() => {
    if (!rateLimitBlocked || rateLimitSecondsRemaining <= 0) {
      if (rateLimitBlocked && rateLimitSecondsRemaining <= 0) {
        setRateLimitBlocked(false);
        setRateLimitMessage(null);
      }
      return;
    }

    const timer = setInterval(() => {
      setRateLimitSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRateLimitBlocked(false);
          setRateLimitMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitBlocked, rateLimitSecondsRemaining]);
  
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
  const [lakehouseEvents, setLakehouseEvents] = useState<EventRecord[]>([]);
  const [toolActivity, setToolActivity] = useState<{ label: string; active: boolean } | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const lakehouseEventsRef = useRef<EventRecord[]>([]);
  const lakehouseEventsLoadRef = useRef<Promise<EventRecord[]> | null>(null);

  useEffect(() => {
    const refreshEvents = () => {
      const load = fetch("/api/events", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => (Array.isArray(data.events) ? data.events as EventRecord[] : []));
      lakehouseEventsLoadRef.current = load;
      load.then((events) => {
        lakehouseEventsRef.current = events;
        setLakehouseEvents(events);
      })
      .catch((err) => console.warn("Failed to load events for chat matching", err));
    };

    refreshEvents();
    window.addEventListener("cg-events-updated", refreshEvents);
    window.addEventListener("focus", refreshEvents);
    window.addEventListener("storage", refreshEvents);
    return () => {
      window.removeEventListener("cg-events-updated", refreshEvents);
      window.removeEventListener("focus", refreshEvents);
      window.removeEventListener("storage", refreshEvents);
    };
  }, []);

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
    setErrorMessage(null);
    setToolActivity(null);
    const abortController = new AbortController();
    requestAbortRef.current = abortController;

    // Save user message immediately to thread
    saveThread({
      id: targetThreadId,
      title: targetTitle,
      messages: newMessages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const effectiveApiKey = selectedModel.customApiKey || customApiKey || undefined;
    const effectiveBaseUrl = selectedModel.customBaseUrl || customBaseUrl || undefined;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel.id,
          provider: selectedModel.provider,
          routingMode,
          customApiKey: effectiveApiKey,
          customBaseUrl: effectiveBaseUrl,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: response.statusText }));
        if (response.status === 429 && errData.rateLimit) {
          setRateLimitBlocked(true);
          setRateLimitSecondsRemaining(errData.rateLimit.retryAfterSeconds || 60);
          setRateLimitMessage(errData.error);
        }
        throw new Error(errData.error || `HTTP ${response.status} ${response.statusText}`);
      }

      // Read SSE stream with robust line buffer
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let assistantThinking = "";
      const toolMap = new Map<number, { name: string; args: string }>();
      let lineBuffer = "";
      let streamError: string | null = null;

      const assistantMsgId = (Date.now() + 1).toString();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const rawLines = lineBuffer.split("\n");
          // Keep trailing incomplete fragment in lineBuffer
          lineBuffer = rawLines.pop() ?? "";

          for (const line of rawLines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const dataStr = trimmed.replace(/^data: /, "").trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);

              if (parsed.error) {
                streamError = parsed.error;
                continue;
              }

              if (parsed.type === "tool_status") {
                setToolActivity({
                  label: parsed.label,
                  active: parsed.active ?? true,
                });
                if (parsed.label) {
                  assistantThinking += `\n[Lakehouse Tool] ${parsed.label}\n`;
                }
              }

              const delta = parsed.choices?.[0]?.delta;

              if (delta?.reasoning_content || delta?.reasoning || delta?.thinking || delta?.thought) {
                assistantThinking += (delta.reasoning_content || delta.reasoning || delta.thinking || delta.thought);
              }
              if (delta?.content) {
                assistantContent += delta.content;
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  const current = toolMap.get(idx) || { name: "", args: "" };
                  if (tc.function?.name) current.name = tc.function.name;
                  if (tc.function?.arguments) current.args += tc.function.arguments;
                  toolMap.set(idx, current);
                }
              }

              const toolInvocations = Array.from(toolMap.values());
              let parsedQuestions: any = null;
              let parsedApproval: any = null;
              let parsedRecommendation: any = null;
              const explicitToolEventIds: string[] = [];

              for (const ti of toolInvocations) {
                try {
                  const parsedArgs = JSON.parse(ti.args);
                  if (
                    (ti.name === "ask_questions" || ti.name === "trigger_survey" || ti.name === "ask_survey") &&
                    (parsedArgs.questions || Array.isArray(parsedArgs) || parsedArgs.survey)
                  ) {
                    parsedQuestions = normalizeQuestions(parsedArgs);
                  } else if (ti.name === "show_approval_card") {
                    parsedApproval = parsedArgs;
                  } else if (ti.name === "show_recommendation_card") {
                    parsedRecommendation = parsedArgs;
                  } else if (ti.name === "show_events_grid" && Array.isArray(parsedArgs.eventIds)) {
                    explicitToolEventIds.push(...parsedArgs.eventIds);
                  } else if (ti.name === "search_events") {
                    const q = (parsedArgs.query || "").toLowerCase();
                    for (const ev of lakehouseEvents) {
                      if (
                        ev.title.toLowerCase().includes(q) ||
                        ev.cat.toLowerCase().includes(q) ||
                        (ev.subhead && ev.subhead.toLowerCase().includes(q)) ||
                        (ev.description && ev.description.toLowerCase().includes(q))
                      ) {
                        explicitToolEventIds.push(ev.id);
                      }
                    }
                  }
                } catch {
                  // Arguments still streaming
                }
              }

              const currentMatchedEvents = resolveRelevantEvents(
                explicitToolEventIds,
                assistantContent,
                lakehouseEvents
              );

              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== assistantMsgId);
                const updated = [
                  ...filtered,
                  {
                    id: assistantMsgId,
                    role: "assistant" as const,
                    content: assistantContent,
                    thinking: assistantThinking || undefined,
                    toolCalls: toolInvocations.length > 0 ? toolInvocations : undefined,
                    questions: parsedQuestions || undefined,
                    approvalCard: parsedApproval || undefined,
                    recommendation: parsedRecommendation || undefined,
                    events: currentMatchedEvents.length > 0 ? currentMatchedEvents : undefined,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ];
                return updated;
              });
            } catch (pErr) {
              // Non-JSON SSE payload
            }
          }
        }
      }

      if (streamError) throw new Error(streamError);

      const finalToolInvocations = Array.from(toolMap.values());
      let finalQuestions: any = null;
      let finalApproval: any = null;
      let finalRecommendation: any = null;
      const finalToolEventIds: string[] = [];

      for (const ti of finalToolInvocations) {
        try {
          const parsedArgs = JSON.parse(ti.args);
          if (
            (ti.name === "ask_questions" || ti.name === "trigger_survey" || ti.name === "ask_survey") &&
            (parsedArgs.questions || Array.isArray(parsedArgs) || parsedArgs.survey)
          ) {
            finalQuestions = normalizeQuestions(parsedArgs);
          } else if (ti.name === "show_approval_card") {
            finalApproval = parsedArgs;
          } else if (ti.name === "show_recommendation_card") {
            finalRecommendation = parsedArgs;
          } else if (ti.name === "show_events_grid" && Array.isArray(parsedArgs.eventIds)) {
            finalToolEventIds.push(...parsedArgs.eventIds);
          }
        } catch {}
      }

      const availableEvents = lakehouseEventsRef.current.length > 0
        ? lakehouseEventsRef.current
        : await (lakehouseEventsLoadRef.current || Promise.resolve([]));
      lakehouseEventsRef.current = availableEvents;

      const finalMatchedEvents = resolveRelevantEvents(
        finalToolEventIds,
        assistantContent,
        availableEvents
      );

      // If no text content and no tool calls, report error
      if (!assistantContent && finalToolInvocations.length === 0) {
        assistantContent = "Unable to process query. No response returned from Lakehouse LLM.";
      }

      const finalAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: assistantContent,
        thinking: assistantThinking || undefined,
        toolCalls: finalToolInvocations.length > 0 ? finalToolInvocations : undefined,
        questions: finalQuestions || undefined,
        approvalCard: finalApproval || undefined,
        recommendation: finalRecommendation || undefined,
        events: finalMatchedEvents.length > 0 ? finalMatchedEvents : undefined,
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
      if (abortController.signal.aborted) return;
      console.error("Chat Error:", err);
      setErrorMessage(err.message || "Failed to communicate with LLM provider API.");
    } finally {
      if (requestAbortRef.current === abortController) requestAbortRef.current = null;
      setIsLoading(false);
      setToolActivity(null);
    }
  };

  const handleStop = () => {
    requestAbortRef.current?.abort();
    setIsLoading(false);
    setToolActivity(null);
  };

  const handleDeleteChat = (id: string) => {
    deleteThread(id);
    if (currentThreadId === id || activeThreadId === id) {
      setMessages([]);
      setActiveTitle(null);
      setCurrentThreadId(null);
      setActiveThreadId(null);
      setErrorMessage(null);
    }
  };

  const handleClearCurrentChat = () => {
    if (currentThreadId) {
      deleteThread(currentThreadId);
    }
    setMessages([]);
    setActiveTitle(null);
    setCurrentThreadId(null);
    setActiveThreadId(null);
    setErrorMessage(null);
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
        onDeleteChat={handleDeleteChat}
        onNewChat={() => {
          setMessages([]);
          setActiveTitle(null);
          setCurrentThreadId(null);
          setActiveThreadId(null);
          setErrorMessage(null);
        }}
        footerLabel="Campus Genie v1.0"
        footerIcon={
          <span className="flex size-2">
            <span className="size-2 rounded-full bg-green" />
          </span>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          {/* Top Bar */}
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line/35 px-3 sm:px-4 bg-canvas">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold text-ink">Campus Genie</span>
              <span className="text-[12px] text-ink-3">/</span>
              <span className="text-[12.5px] font-medium text-ink-2 truncate max-w-[200px] sm:max-w-[320px]">
                {activeTitle || "Lakehouse Assistant"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Clear / Delete Current Chat Button */}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCurrentChat}
                  title="Delete/Clear this chat"
                  className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-surface text-ink-3 hover:bg-hover hover:text-red transition-colors duration-100"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}

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
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-2 pb-28 sm:px-6 sm:pt-3 sm:pb-36">
            {messages.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center text-center max-w-3xl mx-auto w-full space-y-6 px-2">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-hover-2 text-ink shadow-hairline">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>

                <div className="space-y-2 max-w-lg mx-auto">
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
              <div className="space-y-5 max-w-3xl mx-auto w-full pb-4">
                {messages.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* Message Bubble */}
                    {msg.role === "user" ? (
                      <div className="rounded-[14px] bg-hover-2 px-4 py-2.5 text-[13.5px] font-medium text-ink max-w-[85%] sm:max-w-[75%] leading-relaxed shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="w-full space-y-3">
                        {/* Thinking / Reasoning Accordion Component with real live trace */}
                        {msg.thinking && (
                          <div className="w-full">
                            <ThinkingState
                              variant="Reasoning"
                              thinking={msg.thinking}
                              isStreaming={isLoading && idx === messages.length - 1 && !msg.content}
                            />
                          </div>
                        )}

                        {/* Markdown Text Response Body - Only render when content is non-empty */}
                        {Boolean(msg.content && msg.content.trim()) && (
                          <div className="rounded-[14px] border border-line bg-surface p-4 text-[13.5px] text-ink leading-relaxed shadow-card">
                            <MarkdownMessage content={msg.content} />
                          </div>
                        )}

                        {/* Interactive Lakehouse Event Cards with click-to-open modal */}
                        {msg.events && msg.events.length > 0 && (
                          <div className="w-full animate-fade-in">
                            <ChatEventCards events={msg.events} onAskGenie={handleSend} />
                          </div>
                        )}

                        {/* Interactive Multi-Step MCQ Survey from LLM (ask_questions tool) */}
                        {msg.questions && msg.questions.length > 0 && (
                          <div className="w-full animate-fade-in">
                            <ApprovalCard
                              questions={msg.questions}
                              labels={{
                                skip: "Skip",
                                continue: "Continue",
                                send: "Submit Answers",
                                customPlaceholder: "Other details…",
                                sentMessage: "Answers sent to Genie",
                              }}
                              onSubmitted={(_answers, result) => {
                                if (result?.formattedText) {
                                  handleSend(result.formattedText);
                                } else {
                                  const summary = Object.entries(_answers)
                                    .map(([qIdx, optionIndices]) => {
                                      const questionObj = msg.questions?.[Number(qIdx)];
                                      const qTitle = questionObj?.q || `Question ${Number(qIdx) + 1}`;
                                      const selected = Array.isArray(optionIndices)
                                        ? optionIndices.map((i) => questionObj?.options?.[i] || i).join(", ")
                                        : optionIndices;
                                      return `${qTitle} -> ${selected}`;
                                    })
                                    .join("\n");
                                  handleSend(`Survey Responses:\n${summary}`);
                                }
                              }}
                            />
                          </div>
                        )}

                        {/* Action Approval Card from LLM (show_approval_card tool) */}
                        {msg.approvalCard && (
                          <div className="w-full animate-fade-in">
                            <ApprovalCard
                              questions={[
                                {
                                  q: msg.approvalCard.title,
                                  type: "radio",
                                  options: [
                                    `Confirm & Proceed (${msg.approvalCard.itemName || "Action"}${msg.approvalCard.costOrLocation ? ` · ${msg.approvalCard.costOrLocation}` : ""})`,
                                    "Hold for review",
                                    "Cancel",
                                  ],
                                },
                              ]}
                              onSubmitted={(answers) => {
                                const ans = Object.values(answers)[0];
                                handleSend(`Action decision for "${msg.approvalCard?.title}": ${ans}`);
                              }}
                            />
                          </div>
                        )}

                        {/* Recommendation Card from LLM (show_recommendation_card tool) */}
                        {msg.recommendation && (
                          <div className="w-full animate-fade-in">
                            <RecommendationCard
                              labels={{
                                title: msg.recommendation.title,
                                alternatives: "Alternatives",
                                otherOptions: "Other Options",
                                accepted: "Selected",
                              }}
                              options={[
                                {
                                  key: "primary",
                                  body: <>{msg.recommendation.subtitle || msg.recommendation.title}</>,
                                  short: msg.recommendation.short || msg.recommendation.title,
                                  signal: 95,
                                  tone: "var(--green)",
                                  label: msg.recommendation.label || "Top Pick",
                                  cta: "Explore More",
                                  ctaVariant: "primary",
                                },
                              ]}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading State Spinner Component when waiting for assistant response or running tools */}
                {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === "user" || (!messages[messages.length - 1]?.content && !messages[messages.length - 1]?.thinking) || toolActivity?.active) && (
                  <div className="w-full flex items-center py-2 animate-fade-in">
                    <LoadingState
                      variant="Drive"
                      label={toolActivity?.active ? toolActivity.label : (selectedModel.isReasoning ? "Reasoning through Lakehouse Delta tables…" : "Querying Unity Catalog…")}
                    />
                  </div>
                )}

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

          {/* Floating Bottom Prompt Bar Input */}
          <div className="absolute inset-x-0 bottom-0 pointer-events-none pb-5 sm:pb-6 px-4 flex justify-center items-center z-20">
            <div className="w-full max-w-3xl pointer-events-auto rounded-[14px] shadow-[0_12px_36px_rgba(0,0,0,0.38)] backdrop-blur-md">
              <PromptBar
                placeholder="Ask Campus Genie anything"
                onSend={handleSend}
                demo={false}
                isWorking={isLoading}
                onStop={handleStop}
                routingMode={routingMode}
                onSelectRoutingMode={setRoutingMode}
                rateLimitBlocked={rateLimitBlocked}
                rateLimitSecondsRemaining={rateLimitSecondsRemaining}
                rateLimitMessage={rateLimitMessage}
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
        onOpen={() => setShortcutsOpen(true)}
      />
    </main>
  );
}
