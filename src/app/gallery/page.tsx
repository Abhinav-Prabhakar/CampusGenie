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
import KeyboardShortcutsModal from "@/components/shortcuts/KeyboardShortcutsModal";
import EventIcons from "@/components/events/EventIcons";
import Link from "next/link";

const CAMPUS_RECENTS: SidebarRecent[] = [
  { id: "waste-week", label: "Don't let me waste my week" },
  { id: "find-tribe", label: "Find my AI research tribe" },
  { id: "city-meetups", label: "Bengaluru weekend tech meetups" },
  { id: "alumni-paths", label: "Alumni pathways: ML vs Systems" },
  { id: "hackathon-plan", label: "HackBangalore preparation roadmap" },
];

export default function GalleryPage() {
  const [activeNav, setActiveNav] = useState<string>("tables");
  const [isDark, setIsDark] = useState<boolean>(true);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [thinkingVariant, setThinkingVariant] = useState<"Steps" | "Reasoning" | "Search">("Steps");
  const [loadingVariant, setLoadingVariant] = useState<"Drive" | "Dots" | "Orbit">("Drive");
  const [codeBlockVariant, setCodeBlockVariant] = useState<"Code" | "Diff">("Code");
  const [syncEnabled, setSyncEnabled] = useState<boolean>(true);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"Day" | "Week" | "Semester">("Week");

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

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      <SidebarNav
        fill
        className="hidden lg:flex"
        recents={CAMPUS_RECENTS}
        activeTitle="UI Components Gallery"
        activeNav="gallery"
        footerLabel="Campus Genie v1.0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-canvas">
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { key: "tables", label: "Lakehouse Tables", icon: "📊" },
                { key: "analytics", label: "Campus Pulse", icon: "📈" },
                { key: "flowchart", label: "Reasoning Graph & SQL", icon: "🕸️" },
                { key: "discovery", label: "Search & Hub", icon: "🔍" },
                { key: "primitives", label: "Interactive Primitives", icon: "⚡" },
                { key: "atoms", label: "UI Atoms Gallery", icon: "✨" },
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

            <div className="flex items-center gap-2">
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

          <div className="min-h-0 flex-1 overflow-y-auto bg-canvas">
            {/* VIEW: TABLES */}
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

                <div className="rounded-[12px] border border-line bg-canvas p-1 shadow-card overflow-hidden">
                  <RecordsTable />
                </div>

                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                  <div className="mb-3">
                    <h3 className="text-[14px] font-semibold text-ink">What-If Semester Schedule Diff</h3>
                    <p className="text-[12.5px] text-ink-2">Comparing standard coursework trajectory vs AI Lab specialization</p>
                  </div>
                  <DiffTable />
                </div>
              </div>
            )}

            {/* VIEW: ANALYTICS */}
            {activeNav === "analytics" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">Campus Pulse & Alumni Outcomes</h2>
                  <p className="text-[13px] text-ink-2">
                    Real-time engagement telemetry and historical alumni pathways from Databricks Lakehouse.
                  </p>
                </div>
                <InsightCards />
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

            {/* VIEW: FLOWCHART */}
            {activeNav === "flowchart" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">Genie Agent Execution Graph & SQL</h2>
                  <p className="text-[13px] text-ink-2">
                    Multi-step Agent DAG showing schema introspection, query generation, and Lakehouse execution.
                  </p>
                </div>
                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card overflow-hidden">
                  <Flowchart />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            {/* VIEW: DISCOVERY */}
            {activeNav === "discovery" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">Campus Discovery Hub & Batch Actions</h2>
                  <p className="text-[13px] text-ink-2">Quickly search clubs, labs, and city meetups or manage bulk registrations.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="mb-3">
                      <h3 className="text-[14px] font-semibold text-ink">Quick Search Directory</h3>
                      <p className="text-[12px] text-ink-2">Search across all registered Unity Catalog entities</p>
                    </div>
                    <SearchList />
                  </div>
                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card flex flex-col justify-between">
                    <div>
                      <h3 className="text-[14px] font-semibold text-ink mb-1">Multi-Modal Composer</h3>
                      <p className="text-[12px] text-ink-2 mb-4">Attach lab PDFs, syllabi, or event flyers for Genie analysis</p>
                      <ChatComposer />
                    </div>
                  </div>
                </div>
                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                  <div className="mb-3">
                    <h3 className="text-[14px] font-semibold text-ink">Selected Items Action Bar</h3>
                    <p className="text-[12.5px] text-ink-2">Select clubs/events to perform batch calendar exports or team RSVPs</p>
                  </div>
                  <SelectionActions />
                </div>
              </div>
            )}

            {/* VIEW: INTERACTIVE PRIMITIVES */}
            {activeNav === "primitives" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">Interactive AI Primitives</h2>
                  <p className="text-[13px] text-ink-2">Thinking traces, action approval cards, tool chips, and recommendation modules.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-line-soft">
                      <span className="text-[12.5px] font-semibold text-ink">ThinkingState Trace</span>
                      <div className="flex items-center gap-1 rounded-[7px] bg-inset p-0.5">
                        {(["Steps", "Reasoning", "Search"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setThinkingVariant(v)}
                            className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              thinkingVariant === v ? "bg-canvas text-ink shadow-hairline" : "text-ink-3"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <ThinkingState variant={thinkingVariant} />
                  </div>

                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-line-soft">
                      <span className="text-[12.5px] font-semibold text-ink">LoadingState Matrix</span>
                      <div className="flex items-center gap-1 rounded-[7px] bg-inset p-0.5">
                        {(["Drive", "Dots", "Orbit"] as const).map((lv) => (
                          <button
                            key={lv}
                            type="button"
                            onClick={() => setLoadingVariant(lv)}
                            className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              loadingVariant === lv ? "bg-canvas text-ink shadow-hairline" : "text-ink-3"
                            }`}
                          >
                            {lv}
                          </button>
                        ))}
                      </div>
                    </div>
                    <LoadingState variant={loadingVariant} label="Querying Delta Tables..." />
                  </div>

                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="mb-2 text-[12.5px] font-semibold text-ink">Tool Chips (Lakehouse Tools)</div>
                    <ToolChips />
                  </div>

                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="mb-2 text-[12.5px] font-semibold text-ink">Task Rows Pipeline</div>
                    <TaskRows />
                  </div>

                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="mb-2 text-[12.5px] font-semibold text-ink">Approval Card (Action Gate)</div>
                    <ApprovalCard />
                  </div>

                  <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                    <div className="mb-2 text-[12.5px] font-semibold text-ink">Recommendation Card</div>
                    <RecommendationCard />
                  </div>
                </div>

                <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card">
                  <div className="mb-2 text-[12.5px] font-semibold text-ink">Context Reference Cards</div>
                  <ContextCards />
                </div>
              </div>
            )}

            {/* VIEW: ATOMS */}
            {activeNav === "atoms" && (
              <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
                <div>
                  <h2 className="text-[18px] font-semibold text-ink">UI Atoms & Primitives Showcase</h2>
                  <p className="text-[13px] text-ink-2">Every building block adhering strictly to Beautiful UI design tokens.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="rounded-[12px] border border-line bg-canvas p-4 space-y-1 shadow-card">
                    <h4 className="text-[13px] font-semibold text-ink mb-2">Text Rows</h4>
                    <TextRow label="Target Year" value="3rd Year" />
                    <TextRow label="Primary Branch" value="Computer Science" />
                    <TextRow label="Weekly Free Hours" value="12 hrs" />
                  </div>
                  <div className="rounded-[12px] border border-line bg-canvas p-4 space-y-3 shadow-card">
                    <h4 className="text-[13px] font-semibold text-ink">StreamText & Shimmer</h4>
                    <div className="p-2.5 rounded-[8px] bg-inset text-xs font-mono">
                      <StreamText text="Genie is compiling Lakehouse SQL queries..." />
                    </div>
                    <Shimmer className="h-5 w-full rounded-[6px]">
                      <span className="text-[11px] text-ink-3 px-2">Streaming Delta Lake pipeline...</span>
                    </Shimmer>
                  </div>
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
