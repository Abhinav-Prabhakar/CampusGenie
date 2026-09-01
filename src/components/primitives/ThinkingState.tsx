"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * THINKING — expandable agent trace with real LLM reasoning support
 *
 *   Steps      step list with spinner → muted checks
 *   Reasoning  prose reasoning that expands, then settles
 *   Search     web-search trace: query + sources read
 *   Coding     tool trace: files read, edits, commands
 * ───────────────────────────────────────────────────────── */

const STAGES = [800, 600, 1800, 2600, 1600];

function useSequence(steps: number[]) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= steps.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), steps[stage]);
    return () => clearTimeout(t);
  }, [stage, steps]);
  return stage;
}

type Row = {
  primary: string;
  secondary?: string;
  mono?: boolean;
  add?: number;
  del?: number;
  href?: string;
};

const VARIANTS: Record<
  string,
  { active: string; done: string; rows: Row[]; query?: string }
> = {
  Steps: {
    active: "Thinking",
    done: "Thought for 3.4 seconds",
    rows: [
      { primary: "Scanning student persona: 3rd Year CSE · AI & ML focus" },
      { primary: "Querying Unity Catalog Delta table: campus_explorer.campus_events" },
      { primary: "Matching open research labs & club recruitment cycles", secondary: "5 labs" },
      { primary: "Cross-referencing Bengaluru weekend meetups (Indiranagar/Koramangala)" },
    ],
  },
  Reasoning: {
    active: "Reasoning",
    done: "Reasoned for 2.8 seconds",
    rows: [
      { primary: "Student has Friday 4 PM+ and Saturday free; prioritize hands-on workshops over general orientations." },
      { primary: "Alumni outcome pattern shows joining a specialized AI lab in 3rd year correlates with 3.2x higher interview conversion." },
      { primary: "Recommending 'Bengaluru Generative AI Mixer' due to proximity (18 min commute) and peer networking." },
    ],
  },
  Search: {
    active: "Searching Lakehouse & Meetups",
    done: "Searched 3 campus databases",
    query: "campus_events category:AI city:Bengaluru format:in-person",
    rows: [
      { primary: "Unity Catalog Delta Table", secondary: "campus_explorer.campus_events", href: "#" },
      { primary: "Bengaluru AI Dev Meetups", secondary: "meetup.com/bengaluru-ai", href: "#" },
      { primary: "Centre for AI & Robotics Labs", secondary: "cair.campus.edu/recruitment", href: "#" },
    ],
  },
  Coding: {
    active: "Running SQL Queries",
    done: "Executed 2 Lakehouse queries",
    rows: [
      { primary: "Introspect", secondary: "campus_explorer.clubs_labs", mono: true },
      { primary: "Query", secondary: "alumni_paths.sql", mono: true, add: 18, del: 2 },
      { primary: "Execute", secondary: "SELECT * FROM campus_events", mono: true },
    ],
  },
};

function Dot({ tone }: { tone: string }) {
  return (
    <span className={`flex size-3.5 shrink-0 items-center justify-center rounded-full text-white ${tone}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    </span>
  );
}

const TONES = ["bg-accent", "bg-orange", "bg-green"];

interface ThinkingStateProps {
  variant?: string;
  thinking?: string;
  isStreaming?: boolean;
  onSettled?: () => void;
}

export default function ThinkingState({
  variant = "Reasoning",
  thinking,
  isStreaming = false,
  onSettled,
}: ThinkingStateProps) {
  const stage = useSequence(STAGES);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const v = VARIANTS[variant] ?? VARIANTS.Reasoning;
  
  // If actual LLM thinking is provided
  const hasLiveThinking = Boolean(thinking && thinking.trim().length > 0);
  const autoExpanded = isStreaming || (stage >= 1 && stage < 4);
  const expanded = manualExpanded ?? (isStreaming ? true : false);
  const working = isStreaming || (!hasLiveThinking && stage < 3);

  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);
  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [thinking, expanded, variant, stage, isStreaming]);

  /* let embedders sequence content after the trace settles */
  const settledRef = useRef(false);
  useEffect(() => {
    if (working || settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [working, onSettled]);

  return (
    <div
      className="flex w-full flex-col max-w-full"
      style={{
        transition: "min-height 400ms cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      {/* header */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setManualExpanded((current) => !(current ?? expanded))}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1 transition-colors duration-100 hover:bg-hover-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={working ? "var(--ink-2)" : "var(--ink-3)"}>
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        <span role="status" className="contents">
          {working ? (
            <span
              className="bg-clip-text text-[13px] font-medium whitespace-nowrap text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-text 1.4s linear infinite",
              }}
            >
              {hasLiveThinking ? "Reasoning through Lakehouse constraints…" : v.active}
            </span>
          ) : (
            <span
              className="text-[13px] font-medium whitespace-nowrap text-ink-2"
              style={{ animation: "fade-in 350ms ease-out both" }}
            >
              {hasLiveThinking ? "Reasoned through student context" : v.done}
            </span>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* expandable trace */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-3.5">
            <span
              aria-hidden
              className="absolute left-[3px] w-px bg-line-soft"
              style={{
                top: 0,
                height: lineHeight ? lineHeight : 0,
                transition: "height 500ms cubic-bezier(0.23,1,0.32,1)",
              }}
            />
            <div ref={traceRef} className="flex flex-col gap-1.5 py-1">
              {hasLiveThinking ? (
                <div className="rounded-[8px] bg-canvas border border-line-soft p-3 text-[12.5px] text-ink-2 font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {thinking}
                </div>
              ) : (
                <>
                  {v.query && (
                    <div className="flex h-6 items-center gap-2 px-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M21 21l-4.3-4.3" />
                      </svg>
                      <span className="text-[12.5px] text-ink-2">{v.query}</span>
                    </div>
                  )}
                  {v.rows.map((row, i) => (
                    <div key={row.primary} className="flex min-h-6 w-full items-center gap-2 rounded-[6px] px-1.5 py-0.5 text-left text-[12.5px] text-ink-2">
                      <span className="size-1.5 rounded-full bg-ink-3 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{row.primary}</span>
                      {row.secondary && <span className="text-[11px] text-ink-3">{row.secondary}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
