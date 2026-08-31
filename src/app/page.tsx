"use client";

import { useState, useEffect } from "react";
import SidebarNav, { type SidebarRecent } from "@/components/primitives/SidebarNav";
import PromptBar from "@/components/primitives/PromptBar";
import ThinkingState from "@/components/primitives/ThinkingState";
import LoadingState from "@/components/primitives/LoadingState";
import ToolChips from "@/components/primitives/ToolChips";
import TaskRows from "@/components/primitives/TaskRows";
import StreamingText from "@/components/primitives/StreamingText";
import ApprovalCard from "@/components/primitives/ApprovalCard";
import RecommendationCard from "@/components/primitives/RecommendationCard";
import ContextCards from "@/components/primitives/ContextCards";
import RecordsTable from "@/components/primitives/RecordsTable";
import DiffTable from "@/components/primitives/DiffTable";
import FilterTable from "@/components/primitives/FilterTable";
import InsightCards from "@/components/primitives/InsightCards";
import Flowchart from "@/components/primitives/Flowchart";
import CodeBlock from "@/components/primitives/CodeBlock";
import FineTuneCard from "@/components/primitives/FineTuneCard";
import SearchList from "@/components/primitives/SearchList";
import SelectionActions from "@/components/primitives/SelectionActions";
import ChatComposer from "@/components/primitives/ChatComposer";

// Atoms
import { Button } from "@/components/atoms/Button";
import { Chip } from "@/components/atoms/Chip";
import { EntityChip } from "@/components/atoms/EntityChip";
import { ProgressRing } from "@/components/atoms/ProgressRing";
import { SegmentedControl } from "@/components/atoms/SegmentedControl";
import { Shimmer } from "@/components/atoms/Shimmer";
import { StatusPill } from "@/components/atoms/StatusPill";
import { StreamText } from "@/components/atoms/StreamText";
import { Switch } from "@/components/atoms/Switch";
import { TextRow } from "@/components/atoms/TextRow";
import { ValuePill } from "@/components/atoms/ValuePill";

// Sample Recents for Campus Genie
const CAMPUS_RECENTS: SidebarRecent[] = [
  { id: "waste-week", label: "Don't let me waste my week", prompt: "What should a 3rd-year CSE student who loves AI and has Friday evening free do this week?" },
  { id: "find-tribe", label: "Find my AI research tribe", prompt: "Find active campus labs and student clubs working on LLMs with recruitment open right now." },
  { id: "city-meetups", label: "Bengaluru weekend tech meetups", prompt: "Show me developer meetups in Koramangala & Indiranagar happening this Saturday with student discounts." },
  { id: "alumni-paths", label: "Alumni pathways: ML vs Systems", prompt: "Compare career trajectories and club involvement of alumni who landed AI research roles vs Big Tech SDE." },
  { id: "hackathon-plan", label: "HackBangalore preparation roadmap", prompt: "Generate a 3-week prep schedule for HackBangalore based on winning project patterns." },
];

export default function CampusGeniePage() {
  const [activeNav, setActiveNav] = useState<string>("chat");
  const [activeTitle, setActiveTitle] = useState<string | null>("Don't let me waste my week");
  const [activePrompt, setActivePrompt] = useState<string>(
    "What should a 3rd-year CSE student who loves AI and has Friday evening free do this week on campus and in Bengaluru?"
  );
  const [isDark, setIsDark] = useState<boolean>(true);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(true);
  
  // Interactive component variants
  const [thinkingVariant, setThinkingVariant] = useState<"Steps" | "Reasoning" | "Search">("Steps");
  const [loadingVariant, setLoadingVariant] = useState<"Drive" | "Dots" | "Orbit">("Drive");
  const [codeBlockVariant, setCodeBlockVariant] = useState<"Code" | "Diff">("Code");
  const [promptBarVariant, setPromptBarVariant] = useState<"Rounded" | "Pill">("Rounded");
  const [syncEnabled, setSyncEnabled] = useState<boolean>(true);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"Day" | "Week" | "Semester">("Week");

  // Initialize theme
  useEffect(() => {
    const saved = localStorage.getItem("bui-theme");
    const darkActive = saved !== "light";
    setIsDark(darkActive);
    document.documentElement.classList.toggle("dark", darkActive);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("bui-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const handleSend = (text: string) => {
    setActivePrompt(text);
    setActiveTitle(text.slice(0, 32) + (text.length > 32 ? "..." : ""));
    setHasSubmitted(true);
  };

  const handlePickRecent = (id: string, label: string, prompt?: string) => {
    setActiveTitle(label);
    if (prompt) setActivePrompt(prompt);
    setActiveNav("chat");
    setHasSubmitted(true);
  };

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      {/* Sidebar Navigation */}
      <SidebarNav
        fill
        className="hidden lg:flex"
        recents={CAMPUS_RECENTS}
        activeTitle={activeTitle}
        activeNav={activeNav}
        onNavigate={(key) => setActiveNav(key)}
        onPick={handlePickRecent}
        onNewChat={() => {
          setActiveTitle(null);
          setActivePrompt("");
          setHasSubmitted(false);
          setActiveNav("chat");
        }}
        footerLabel="Lakehouse: Connected"
        footerIcon={
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-green" />
          </span>
        }
      />

      {/* Main App Container */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          {/* Top Bar / Tab Header */}
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-canvas">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { key: "chat", label: "Genie Chat", icon: "💬" },
                { key: "tables", label: "Lakehouse Tables", icon: "📊" },
                { key: "analytics", label: "Campus Pulse", icon: "📈" },
                { key: "flowchart", label: "Reasoning Graph & SQL", icon: "🕸️" },
                { key: "discovery", label: "Search & Hub", icon: "🔍" },
                { key: "atoms", label: "UI Primitives Gallery", icon: "✨" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveNav(tab.key)}
                  className={`flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium transition-colors duration-100 ${
                    activeNav === tab.key
                      ? "bg-hover-2 text-ink shadow-hairline"
                      : "text-ink-2 hover:bg-hover hover:text-ink"
                  }`}
                >
                  <span className="text-xs">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-accent-tint/60 px-2.5 py-0.5 text-[11.5px] font-medium text-accent-ink border border-accent/20">
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                Unity Catalog: campus_explorer
              </span>

              {/* Theme Switcher Button */}
              <button
                type="button"
                onClick={toggleTheme}
                title="Toggle Theme"
                className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-canvas text-ink-2 hover:bg-hover hover:text-ink transition-colors duration-100"
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

          {/* Tab View Content Panels */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-canvas">
            {/* VIEW 1: GENIE CHAT */}
            {activeNav === "chat" && (
              <div className="flex h-full flex-col justify-between">
                {/* Scrollable Conversation Stream */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-[840px] mx-auto w-full">
                  {!hasSubmitted ? (
                    <div className="my-auto flex flex-col items-center justify-center text-center py-16 px-4">
                      <div className="flex size-12 items-center justify-center rounded-[12px] bg-accent-tint text-accent text-2xl mb-3 shadow-hairline">
                        🧞
                      </div>
                      <h2 className="text-[19px] font-semibold text-ink mb-1">
                        What can Campus Genie find for you today?
                      </h2>
                      <p className="text-[13.5px] text-ink-2 max-w-[480px] mb-6">
                        Ask about campus events, open research labs, alumni career paths, or Bengaluru tech meetups tailored to your exact year, branch, and schedule.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-[620px]">
                        {CAMPUS_RECENTS.slice(0, 4).map((rec) => (
                          <button
                            key={rec.id}
                            type="button"
                            onClick={() => handleSend(rec.prompt || rec.label)}
                            className="flex flex-col items-start p-3 rounded-[10px] border border-line bg-canvas hover:bg-hover hover:border-line-strong transition-all duration-150 text-left shadow-card"
                          >
                            <span className="text-[13px] font-medium text-ink mb-0.5">{rec.label}</span>
                            <span className="text-[11.5px] text-ink-3 line-clamp-1">{rec.prompt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Student User Prompt Bubble */}
                      <div className="flex items-start gap-3 justify-end">
                        <div className="max-w-[85%] rounded-[12px] bg-canvas border border-line-strong p-3.5 shadow-card">
                          <div className="flex items-center gap-2 mb-1">
                            <EntityChip name="Abhinav (You)" color="var(--accent)" />
                            <span className="text-[11px] text-ink-3 tabular-nums">Just now</span>
                          </div>
                          <p className="text-[13.5px] text-ink font-medium leading-relaxed">
                            {activePrompt}
                          </p>
                        </div>
                      </div>

                      {/* Genie Agent Reasoning Block */}
                      <div className="space-y-4 pt-2">
                        {/* Thinking State Component with Variation Selector */}
                        <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-line-soft">
                            <span className="text-[12.5px] font-semibold text-ink">Agent Reasoning State</span>
                            {/* Variant switcher for Steps, Reasoning, Search */}
                            <div className="flex items-center gap-1 rounded-[7px] bg-inset p-0.5">
                              {(["Steps", "Reasoning", "Search"] as const).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setThinkingVariant(v)}
                                  className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                    thinkingVariant === v
                                      ? "bg-canvas text-ink shadow-hairline"
                                      : "text-ink-3 hover:text-ink-2"
                                  }`}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                          <ThinkingState variant={thinkingVariant} />
                        </div>

                        {/* Loading State with Shimmer & Elapsed Time */}
                        <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-line-soft">
                            <span className="text-[12.5px] font-semibold text-ink">Lakehouse Execution Stream</span>
                            <div className="flex items-center gap-1 rounded-[7px] bg-inset p-0.5">
                              {(["Drive", "Dots", "Orbit"] as const).map((lv) => (
                                <button
                                  key={lv}
                                  type="button"
                                  onClick={() => setLoadingVariant(lv)}
                                  className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                    loadingVariant === lv
                                      ? "bg-canvas text-ink shadow-hairline"
                                      : "text-ink-3 hover:text-ink-2"
                                  }`}
                                >
                                  {lv}
                                </button>
                              ))}
                            </div>
                          </div>
                          <LoadingState variant={loadingVariant} label="Querying Delta Tables & Alumni Pathways" />
                        </div>

                        {/* Databricks Tool Execution Chips */}
                        <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                          <div className="mb-2 text-[12.5px] font-semibold text-ink">Governed Tool Invocations</div>
                          <ToolChips />
                        </div>

                        {/* Task Execution Rows */}
                        <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                          <div className="mb-2 text-[12.5px] font-medium text-ink-2 flex items-center justify-between">
                            <span>Execution Pipeline Status</span>
                            <span className="text-[11px] text-ink-3 tabular-nums">4/4 Steps</span>
                          </div>
                          <TaskRows />
                        </div>

                        {/* Streaming Text Response */}
                        <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card space-y-3">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-line-soft">
                            <span className="size-2 rounded-full bg-accent animate-pulse" />
                            <span className="text-[12.5px] font-semibold text-ink">Campus Genie Synthesis</span>
                            <span className="text-[11px] text-ink-3">via Databricks Agent API</span>
                          </div>
                          <StreamingText />
                        </div>

                        {/* Curated Recommendation Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <RecommendationCard />
                          <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="rounded-full bg-green-tint px-2 py-0.5 text-[11px] font-medium text-green border border-green/20">
                                  98% Match · City Meetup
                                </span>
                                <ValuePill tone="accent">Free Entry</ValuePill>
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

                        {/* Human In The Loop Approval Card */}
                        <div className="pt-2">
                          <ApprovalCard />
                        </div>

                        {/* Context Reference Cards */}
                        <div className="pt-2">
                          <ContextCards />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Bottom Floating Prompt Bar */}
                <div className="shrink-0 border-t border-line bg-canvas p-3">
                  <div className="mx-auto max-w-[780px]">
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <span className="text-[11px] text-ink-3">Prompt Bar Style:</span>
                      <div className="flex gap-1">
                        {(["Rounded", "Pill"] as const).map((pv) => (
                          <button
                            key={pv}
                            type="button"
                            onClick={() => setPromptBarVariant(pv)}
                            className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${
                              promptBarVariant === pv ? "bg-hover-2 text-ink" : "text-ink-3"
                            }`}
                          >
                            {pv}
                          </button>
                        ))}
                      </div>
                    </div>
                    <PromptBar
                      variant={promptBarVariant}
                      demo={false}
                      tall
                      placeholder="Ask Campus Genie about events, clubs, labs, or career paths..."
                      onSend={handleSend}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: LAKEHOUSE TABLES */}
            {activeNav === "tables" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-semibold text-ink">Unity Catalog Lakehouse Records</h2>
                    <p className="text-[13px] text-ink-2">
                      Live governed Delta tables powering Genie queries (<code className="font-mono text-xs text-accent-ink">campus_explorer.campus_events</code>)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" className="text-xs">Export CSV</Button>
                    <Button variant="primary" className="text-xs">+ Ingest Event</Button>
                  </div>
                </div>

                {/* Records Table Component */}
                <div className="rounded-[12px] border border-line bg-canvas p-1 shadow-card overflow-hidden">
                  <RecordsTable />
                </div>

                {/* Schedule Diff Table */}
                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                  <div className="mb-3">
                    <h3 className="text-[14px] font-semibold text-ink">What-If Semester Schedule Diff</h3>
                    <p className="text-[12.5px] text-ink-2">Comparing standard coursework trajectory vs AI Lab specialization</p>
                  </div>
                  <DiffTable />
                </div>
              </div>
            )}

            {/* VIEW 3: CAMPUS ANALYTICS */}
            {activeNav === "analytics" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">Campus Pulse & Alumni Outcomes</h2>
                  <p className="text-[13px] text-ink-2">
                    Real-time engagement telemetry and historical alumni pathways from Databricks Lakehouse.
                  </p>
                </div>

                {/* Insight Cards Component */}
                <InsightCards />

                {/* Filter Table Component */}
                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-[14px] font-semibold text-ink">Filtered Activity Queue</h3>
                      <p className="text-[12.5px] text-ink-2">Prioritized club tasks, lab deliverables, and hackathon milestones</p>
                    </div>
                  </div>
                  <FilterTable />
                </div>
              </div>
            )}

            {/* VIEW 4: REASONING GRAPH & SQL */}
            {activeNav === "flowchart" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">Genie Agent Execution Graph & SQL</h2>
                  <p className="text-[13px] text-ink-2">
                    Multi-step Agent DAG showing schema introspection, query generation, and Lakehouse execution.
                  </p>
                </div>

                {/* Flowchart Component */}
                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card overflow-hidden">
                  <Flowchart />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Generated SQL CodeBlock */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-[13.5px] font-semibold text-ink">Generated Lakehouse SQL</h3>
                        <p className="text-[12px] text-ink-2">Auto-compiled by Databricks Genie Agent</p>
                      </div>
                      <div className="flex gap-1 bg-inset p-0.5 rounded-[6px]">
                        {(["Code", "Diff"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setCodeBlockVariant(mode)}
                            className={`px-2 py-0.5 text-[11px] font-medium rounded-[5px] transition-colors ${
                              codeBlockVariant === mode ? "bg-canvas text-ink shadow-hairline" : "text-ink-3"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                    <CodeBlock
                      variant={codeBlockVariant}
                      filename="campus_genie_query.sql"
                      lines={[
                        "-- Databricks Genie Generated Query",
                        "SELECT",
                        "  e.event_id,",
                        "  e.title,",
                        "  e.category,",
                        "  e.start_time,",
                        "  e.location,",
                        "  c.match_score",
                        "FROM campus_explorer.campus_events e",
                        "JOIN campus_explorer.clubs_labs c",
                        "  ON e.host_id = c.club_id",
                        "WHERE e.category = 'Artificial Intelligence'",
                        "  AND e.start_time >= CURRENT_TIMESTAMP()",
                        "  AND e.commitment_level IN ('Low', 'Medium')",
                        "ORDER BY c.match_score DESC",
                        "LIMIT 5;",
                      ]}
                    />
                  </div>

                  {/* Fine Tune Card */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="mb-2">
                      <h3 className="text-[13.5px] font-semibold text-ink">Persona & Recommendation Tuning</h3>
                      <p className="text-[12px] text-ink-2">Adjust agent weights for extroversion, bandwidth, and city radius</p>
                    </div>
                    <FineTuneCard />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 5: DISCOVERY & SELECTION HUB */}
            {activeNav === "discovery" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">Campus Discovery Hub & Batch Actions</h2>
                  <p className="text-[13px] text-ink-2">Quickly search clubs, labs, and city meetups or manage bulk registrations.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Search List */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="mb-3">
                      <h3 className="text-[14px] font-semibold text-ink">Quick Search Directory</h3>
                      <p className="text-[12px] text-ink-2">Search across all registered Unity Catalog entities</p>
                    </div>
                    <SearchList />
                  </div>

                  {/* Multi-modal Chat Composer */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card flex flex-col justify-between">
                    <div>
                      <h3 className="text-[14px] font-semibold text-ink mb-1">Multi-Modal Composer</h3>
                      <p className="text-[12px] text-ink-2 mb-4">Attach lab PDFs, syllabi, or event flyers for Genie analysis</p>
                      <ChatComposer />
                    </div>
                  </div>
                </div>

                {/* Selection Actions Banner */}
                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                  <div className="mb-3">
                    <h3 className="text-[14px] font-semibold text-ink">Selected Items Action Bar</h3>
                    <p className="text-[12.5px] text-ink-2">Select clubs/events to perform batch calendar exports or team RSVPs</p>
                  </div>
                  <SelectionActions />
                </div>
              </div>
            )}

            {/* VIEW 6: UI PRIMITIVES GALLERY */}
            {activeNav === "atoms" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">UI Atoms & Primitives Showcase</h2>
                  <p className="text-[13px] text-ink-2">Every building block adhering strictly to Beautiful UI design tokens.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Buttons */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 space-y-3 shadow-card">
                    <h4 className="text-[13px] font-semibold text-ink">Button Variants</h4>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="accent">Accent</Button>
                      <Button variant="success">Success</Button>
                      <Button variant="quiet">Quiet</Button>
                    </div>
                  </div>

                  {/* Status Pills & Value Pills */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 space-y-3 shadow-card">
                    <h4 className="text-[13px] font-semibold text-ink">Status & Value Pills</h4>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone="green">Active</StatusPill>
                      <StatusPill tone="orange">In Progress</StatusPill>
                      <StatusPill tone="neutral">Pending</StatusPill>
                      <ValuePill tone="accent">+18.4% AI Match</ValuePill>
                      <Chip tone="neutral">Delta Lake</Chip>
                      <Chip tone="accent">Genie Agent</Chip>
                    </div>
                  </div>

                  {/* Progress & Switches */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 space-y-3 shadow-card">
                    <h4 className="text-[13px] font-semibold text-ink">Progress & Controls</h4>
                    <div className="flex items-center gap-4">
                      <ProgressRing progress={78} />
                      <div className="space-y-2">
                        <Switch checked={syncEnabled} onChange={setSyncEnabled} label="Lakehouse Sync" />
                        <Switch checked={alertsEnabled} onChange={setAlertsEnabled} label="City Alerts" />
                      </div>
                    </div>
                  </div>

                  {/* Text Rows */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 space-y-1 shadow-card">
                    <h4 className="text-[13px] font-semibold text-ink mb-2">Text Rows</h4>
                    <TextRow label="Target Year" value="3rd Year" />
                    <TextRow label="Primary Branch" value="Computer Science" />
                    <TextRow label="Weekly Free Hours" value="12 hrs" />
                  </div>

                  {/* StreamText & Shimmer */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 space-y-3 shadow-card">
                    <h4 className="text-[13px] font-semibold text-ink">StreamText & Shimmer</h4>
                    <div className="p-2.5 rounded-[8px] bg-inset text-xs font-mono">
                      <StreamText text="Genie is compiling Lakehouse SQL queries..." />
                    </div>
                    <Shimmer className="h-5 w-full rounded-[6px]">
                      <span className="text-[11px] text-ink-3 px-2">Streaming Delta Lake pipeline...</span>
                    </Shimmer>
                  </div>

                  {/* Segmented Control & Entity */}
                  <div className="rounded-[12px] border border-line bg-canvas p-4 space-y-3 shadow-card">
                    <h4 className="text-[13px] font-semibold text-ink">Segmented Control & Entity</h4>
                    <SegmentedControl
                      options={["Day", "Week", "Semester"] as const}
                      value={selectedPeriod}
                      onChange={setSelectedPeriod}
                    />
                    <div className="pt-2">
                      <EntityChip name="Databricks Unity Catalog" monogram="UC" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
