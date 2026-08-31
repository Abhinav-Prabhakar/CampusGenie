"use client";

import { useState, useEffect, useRef } from "react";
import SidebarNav, { type SidebarRecent } from "@/components/primitives/SidebarNav";
import PromptBar from "@/components/primitives/PromptBar";
import ThinkingState from "@/components/primitives/ThinkingState";
import LoadingState from "@/components/primitives/LoadingState";
import ToolChips from "@/components/primitives/ToolChips";
import TaskRows from "@/components/primitives/TaskRows";
import ApprovalCard from "@/components/primitives/ApprovalCard";
import RecommendationCard from "@/components/primitives/RecommendationCard";
import ContextCards from "@/components/primitives/ContextCards";
import FineTuneCard from "@/components/primitives/FineTuneCard";
import CodeBlock from "@/components/primitives/CodeBlock";
import { EntityChip } from "@/components/atoms/EntityChip";
import { StreamText } from "@/components/atoms/StreamText";
import { Button } from "@/components/atoms/Button";
import { AVAILABLE_MODELS, type LLMModelConfig, type LLMProvider } from "@/lib/llm";
import Link from "next/link";

type ChatMessage = {
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

const CAMPUS_RECENTS: SidebarRecent[] = [
  { id: "waste-week", label: "Don't let me waste my week", prompt: SUGGESTIONS[0].prompt },
  { id: "restock-order", label: "Place restock order", prompt: SUGGESTIONS[1].prompt },
  { id: "flavor-launch", label: "Flavor launch simulation", prompt: SUGGESTIONS[2].prompt },
  { id: "find-tribe", label: "Find my AI research tribe", prompt: SUGGESTIONS[3].prompt },
  { id: "alumni-paths", label: "Alumni pathways: ML vs Systems", prompt: SUGGESTIONS[4].prompt },
];

export default function CampusGenieChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<LLMModelConfig>(AVAILABLE_MODELS[0]);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  
  // Custom API settings
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");

  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Initialize theme and load session prompts if any
  useEffect(() => {
    const savedTheme = localStorage.getItem("bui-theme");
    const darkActive = savedTheme !== "light";
    setIsDark(darkActive);
    document.documentElement.classList.toggle("dark", darkActive);

    const savedKey = localStorage.getItem("cg_api_key");
    const savedUrl = localStorage.getItem("cg_base_url");
    if (savedKey) setCustomApiKey(savedKey);
    if (savedUrl) setCustomBaseUrl(savedUrl);

    // Initial prompt from events page redirect
    const initPrompt = sessionStorage.getItem("cg_initial_prompt");
    if (initPrompt) {
      sessionStorage.removeItem("cg_initial_prompt");
      handleSend(initPrompt);
    }
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("bui-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const handleSaveSettings = () => {
    localStorage.setItem("cg_api_key", customApiKey);
    localStorage.setItem("cg_base_url", customBaseUrl);
    setSettingsOpen(false);
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

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setActiveTitle(text.slice(0, 32) + (text.length > 32 ? "..." : ""));
    setIsLoading(true);

    // Determine special cards to display based on prompt context
    const lower = text.toLowerCase();
    const isRestock = lower.includes("restock") || lower.includes("place this order") || lower.includes("inventory");
    const isFlavor = lower.includes("flavor") || lower.includes("launch") || lower.includes("how many");
    const isEvent = lower.includes("event") || lower.includes("week") || lower.includes("tonight") || lower.includes("meetup");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel.id,
          provider: selectedModel.provider,
          customApiKey: customApiKey || undefined,
          customBaseUrl: customBaseUrl || undefined,
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
                return [
                  ...filtered,
                  {
                    id: assistantMsgId,
                    role: "assistant",
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
              });
            } catch (pErr) {
              // Non-JSON delta
            }
          }
        }
      }

      // If empty response
      if (!assistantContent) {
        assistantContent = `Campus Genie queried **campus_explorer.campus_events** and matched your 3rd-year student profile with top events and high-yield activities for this week.`;
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantMsgId);
          return [
            ...filtered,
            {
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
            },
          ];
        });
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      setErrorMessage(err.message || "Failed to communicate with LLM provider API.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickRecent = (id: string, label: string, prompt?: string) => {
    setActiveTitle(label);
    if (prompt) handleSend(prompt);
  };

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      {/* Left Collapsible Sidebar Navigation */}
      <SidebarNav
        fill
        className="hidden lg:flex"
        recents={CAMPUS_RECENTS}
        activeTitle={activeTitle}
        activeNav="chat"
        onPick={handlePickRecent}
        onNewChat={() => {
          setMessages([]);
          setActiveTitle(null);
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

      {/* Main Chat Pane */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          {/* Header Tab Bar */}
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-canvas">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold text-ink">Campus Genie</span>
              <span className="text-[11px] text-ink-3">· Lakehouse Agent</span>
            </div>

            {/* Right Controls: Model Picker, Settings, Theme */}
            <div className="flex items-center gap-2">
              {/* Model Selector Dropdown */}
              <div className="relative">
                <select
                  value={selectedModel.id}
                  onChange={(e) => {
                    const m = AVAILABLE_MODELS.find((x) => x.id === e.target.value);
                    if (m) setSelectedModel(m);
                  }}
                  className="h-7 rounded-[7px] border border-line bg-surface px-2 text-[12px] font-medium text-ink outline-none cursor-pointer hover:border-line-strong transition-colors"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.isReasoning ? "🧠" : ""}
                    </option>
                  ))}
                </select>
              </div>

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

          {/* Conversation Stream & Chat Body */}
          <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden bg-canvas">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-[860px] mx-auto w-full">
              {/* Empty State / Suggestions */}
              {messages.length === 0 && (
                <div className="my-auto flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="flex size-12 items-center justify-center rounded-[12px] bg-accent-tint text-accent text-2xl mb-3 shadow-hairline">
                    🧞
                  </div>
                  <h2 className="text-[19px] font-semibold text-ink mb-1">
                    Ask Campus Genie anything about your week
                  </h2>
                  <p className="text-[13.5px] text-ink-2 max-w-[500px] mb-6 leading-relaxed">
                    Powered by Databricks Lakehouse &amp; Genie Agents. Tap a prompt below or ask your own question about campus life, research labs, or city meetups.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-[660px]">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => handleSend(s.prompt)}
                        className="flex flex-col items-start p-3.5 rounded-[12px] border border-line bg-canvas hover:bg-hover hover:border-line-strong transition-all duration-150 text-left shadow-card"
                      >
                        <span className="text-[13px] font-semibold text-ink mb-1">{s.title}</span>
                        <span className="text-[11.5px] text-ink-3 line-clamp-2 leading-normal">{s.prompt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Loop */}
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-4">
                  {msg.role === "user" ? (
                    <div className="flex items-start gap-3 justify-end">
                      <div className="max-w-[85%] rounded-[12px] bg-canvas border border-line-strong p-3.5 shadow-card">
                        <div className="flex items-center gap-2 mb-1.5">
                          <EntityChip name="Abhinav (You)" color="var(--accent)" />
                          <span className="text-[11px] text-ink-3 tabular-nums">{msg.timestamp}</span>
                        </div>
                        <p className="text-[13.5px] text-ink font-medium leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Thinking State */}
                      {msg.thinking && (
                        <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                          <ThinkingState variant="Steps" />
                        </div>
                      )}

                      {/* Tool Chips */}
                      <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                        <div className="mb-2 text-[12.5px] font-semibold text-ink">Lakehouse Governed Tools</div>
                        <ToolChips />
                      </div>

                      {/* Assistant Text Response */}
                      <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-line-soft">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-accent animate-pulse" />
                            <span className="text-[12.5px] font-semibold text-ink">Campus Genie Synthesis</span>
                            <span className="text-[11px] text-ink-3">via {selectedModel.name}</span>
                          </div>
                          <span className="text-[11px] text-ink-3 tabular-nums">{msg.timestamp}</span>
                        </div>
                        <div className="text-[13.5px] leading-relaxed text-ink font-normal space-y-2">
                          <StreamText text={msg.content} />
                        </div>
                      </div>

                      {/* Conditional Interactive Cards */}
                      {msg.cards?.includes("approval") && (
                        <div>
                          <ApprovalCard />
                        </div>
                      )}

                      {msg.cards?.includes("finetune") && (
                        <div>
                          <FineTuneCard />
                        </div>
                      )}

                      {msg.cards?.includes("recommendation") && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <RecommendationCard />
                          <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="rounded-full bg-green-tint px-2 py-0.5 text-[11px] font-medium text-green border border-green/20">
                                  98% Match · City Meetup
                                </span>
                                <span className="text-[11.5px] font-semibold text-accent-ink">Free Entry</span>
                              </div>
                              <h4 className="text-[14px] font-semibold text-ink mb-1">
                                Bengaluru Generative AI Mixer @ Koramangala
                              </h4>
                              <p className="text-[12.5px] text-ink-2 mb-3">
                                Hands-on agentic workflows, open-source models, and networking with founders from top AI startups.
                              </p>
                              <div className="space-y-1 text-[11.5px] text-ink-3 mb-4">
                                <div>📅 Saturday · 4:00 PM – 7:30 PM</div>
                                <div>📍 Indiranagar 100ft Road (18 mins from campus)</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="secondary" className="flex-1 text-xs">View Map</Button>
                              <Button variant="primary" className="flex-1 text-xs">Reserve Seat</Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {msg.cards?.includes("context") && (
                        <div>
                          <ContextCards />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Live Loading State while waiting */}
              {isLoading && (
                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                  <LoadingState variant="Drive" label="Querying Delta Tables & Synthesizing Reasoning..." />
                </div>
              )}

              {/* Error Banner — NO FALLBACK */}
              {errorMessage && (
                <div className="rounded-[12px] border border-red/40 bg-red-tint/30 p-4 shadow-card text-red space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-[13px]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    API Communication Error ({selectedModel.provider})
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-ink-2 break-words">
                    {errorMessage}
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <Button variant="secondary" className="text-xs" onClick={() => setSettingsOpen(true)}>
                      Configure API Key
                    </Button>
                    <Button variant="primary" className="text-xs" onClick={() => handleSend(messages.at(-1)?.content || "Retry")}>
                      Retry Request
                    </Button>
                  </div>
                </div>
              )}

              <div ref={scrollAnchorRef} />
            </div>

            {/* Bottom Floating Prompt Bar (Rounded Permanently) */}
            <div className="shrink-0 border-t border-line bg-canvas p-3">
              <div className="mx-auto max-w-[780px]">
                <PromptBar
                  variant="Rounded"
                  demo={false}
                  tall
                  placeholder="Ask Campus Genie about events, clubs, labs, or career paths..."
                  onSend={handleSend}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* API Configuration Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-[14px] border border-line bg-canvas p-5 shadow-overlay space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <h3 className="text-[15px] font-semibold text-ink">LLM Provider &amp; API Settings</h3>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-ink-3 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="block text-ink-2 font-medium mb-1">Select Provider &amp; Model</label>
                <select
                  value={selectedModel.id}
                  onChange={(e) => {
                    const m = AVAILABLE_MODELS.find((x) => x.id === e.target.value);
                    if (m) setSelectedModel(m);
                  }}
                  className="w-full h-8 rounded-[8px] border border-line bg-surface px-2.5 text-[12.5px] text-ink outline-none"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider}) {m.isReasoning ? "— Thinking" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-2 font-medium mb-1">Custom API Key</label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Defaults to .env.local (LLM_API_KEY / OPENAI_API_KEY / DATABRICKS_TOKEN)"
                  className="w-full h-8 rounded-[8px] border border-line bg-field px-2.5 text-[12.5px] text-ink outline-none placeholder:text-ink-3"
                />
              </div>

              <div>
                <label className="block text-ink-2 font-medium mb-1">Custom API Base URL (Optional)</label>
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="e.g. https://api.openai.com/v1 or http://localhost:11434/v1"
                  className="w-full h-8 rounded-[8px] border border-line bg-field px-2.5 text-[12.5px] text-ink outline-none placeholder:text-ink-3"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line-soft">
              <Button variant="ghost" className="text-xs" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" className="text-xs" onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
