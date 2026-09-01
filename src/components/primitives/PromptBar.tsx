"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createShader, playSweep, accentChain, ACCENTS } from "glimm";

/* The built-in "prism" palette is only cyan→indigo→magenta, so a sweep
 * reads as blue/purple. Build a true full-spectrum rainbow instead. */
const RAINBOW = accentChain([
  ACCENTS.red,
  ACCENTS.orange,
  ACCENTS.yellow,
  ACCENTS.green,
  ACCENTS.cyan,
  ACCENTS.blue,
  ACCENTS.purple,
]);

/* ─────────────────────────────────────────────────────────
 * PROMPT BAR
 * A composer with real controls: attach, @ data sources,
 * / commands, a 3-way routing mode picker (Auto, Genie, Qwen),
 * dictation, rate-limit cooldown blocker, and send.
 * ───────────────────────────────────────────────────────── */

function Icon({ children, size = 15, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, React.ReactNode> = {
  clip: <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  layers: <g><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></g>,
  globe: <g><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g>,
};

/* real product marks */
const BRANDS: Record<string, React.ReactNode> = {
  figma: (
    <svg width="11" height="16" viewBox="0 0 38 57" aria-hidden="true">
      <path d="M9.5 57A9.5 9.5 0 0 0 19 47.5V38H9.5a9.5 9.5 0 0 0 0 19z" fill="#0ACF83" />
      <path d="M0 28.5A9.5 9.5 0 0 1 9.5 19H19v19H9.5A9.5 9.5 0 0 1 0 28.5z" fill="#A259FF" />
      <path d="M0 9.5A9.5 9.5 0 0 1 9.5 0H19v19H9.5A9.5 9.5 0 0 1 0 9.5z" fill="#F24E1E" />
      <path d="M19 0h9.5a9.5 9.5 0 1 1 0 19H19V0z" fill="#FF7262" />
      <path d="M38 28.5a9.5 9.5 0 1 1-19 0 9.5 9.5 0 0 1 19 0z" fill="#1ABCFE" />
    </svg>
  ),
  slack: (
    <svg width="15" height="15" viewBox="0 0 127 127" aria-hidden="true">
      <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A" />
      <path d="M47 27.2c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.7 39.7.8 47 .8c7.3 0 13.2 5.9 13.2 13.2v13.2H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.3.7 54.4.7 47.1c0-7.3 5.9-13.2 13.2-13.2H47z" fill="#36C5F0" />
      <path d="M99.9 47.1c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V47.1zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.9C66.9 6.6 72.8.7 80.1.7c7.3 0 13.2 5.9 13.2 13.2v33.2z" fill="#2EB67D" />
      <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E" />
    </svg>
  ),
};

type Source = {
  key: string;
  name: string;
  desc: string;
  glyph?: string;
  brand?: string;
  attach?: boolean;
  connect?: boolean;
};

const SOURCES: Source[] = [
  { key: "attach", name: "Add photos & files", desc: "Upload from your computer", glyph: "clip", attach: true },
  { key: "events", name: "Campus Events", desc: "Live Lakehouse events & RSVP status", glyph: "chart" },
  { key: "attendance", name: "Attendance Logs", desc: "Course check-ins & recovery plans", glyph: "layers" },
  { key: "sources", name: "Knowledge Sources", desc: "University catalog documents & policies", glyph: "globe" },
  { key: "figma", name: "Figma", desc: "Design-to-code workflows", brand: "figma" },
  { key: "slack", name: "Slack", desc: "Read and manage Slack", brand: "slack" },
];

const COMMANDS = [
  { key: "events", name: "/events", desc: "Discover campus hackathons & workshops" },
  { key: "attendance", name: "/attendance", desc: "View attendance rates & risk status" },
  { key: "recovery", name: "/recovery", desc: "Generate an academic recovery schedule" },
  { key: "survey", name: "/survey", desc: "Trigger guided student preference survey" },
  { key: "sources", name: "/sources", desc: "Search uploaded university policies & PDFs" },
];

export type RoutingMode = "auto" | "genie" | "gemini" | "qwen";

export interface RoutingOption {
  key: RoutingMode;
  name: string;
  shortName: string;
  tag: string;
  desc: string;
}

export const ROUTING_MODES: RoutingOption[] = [
  {
    key: "auto",
    name: "Auto (Smart Hybrid)",
    shortName: "Auto",
    tag: "Default",
    desc: "Auto-routes read queries to Genie Space & actions to Campus Genie Gemini LLM",
  },
  {
    key: "genie",
    name: "Databricks Genie Agent",
    shortName: "Genie",
    tag: "Genie Space",
    desc: "Direct queries to Databricks Lakehouse Genie Space",
  },
  {
    key: "gemini",
    name: "Campus Genie (Gemini 3.6 Flash)",
    shortName: "Gemini",
    tag: "Gemini 3.6",
    desc: "Direct high-speed Gemini 3.6 Flash reasoning & campus actions",
  },
];

const FILES = ["syllabus.pdf", "attendance-export.csv", "project-proposal.md"];

function parseToken(draft: string): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

export default function PromptBar({
  variant = "Rounded",
  demo = false,
  tall = false,
  placeholder,
  onSend,
  isWorking = false,
  onStop,
  routingMode = "auto",
  onSelectRoutingMode,
  rateLimitBlocked = false,
  rateLimitSecondsRemaining = 0,
  rateLimitMessage,
}: {
  variant?: string;
  demo?: boolean;
  tall?: boolean;
  placeholder?: string;
  onSend?: (text: string) => void;
  isWorking?: boolean;
  onStop?: () => void;
  routingMode?: RoutingMode;
  onSelectRoutingMode?: (mode: RoutingMode) => void;
  rateLimitBlocked?: boolean;
  rateLimitSecondsRemaining?: number;
  rateLimitMessage?: string | null;
}) {
  const pill = variant === "Pill";
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const wide = expanded || tall;
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [modelBox, setModelBox] = useState<{ top: number; height: number } | null>(null);
  const [modelHovered, setModelHovered] = useState<number | null>(null);
  const [modelMenuLeft, setModelMenuLeft] = useState(0);
  const [modelMenuBottom, setModelMenuBottom] = useState(0);
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const glimmRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<ReturnType<typeof createShader> | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sampleVoiceIndexRef = useRef(0);

  const SAMPLE_VOICE_PROMPTS = [
    "Find upcoming hackathons and workshops with free food this weekend",
    "Show my attendance rates and generate an academic recovery schedule for CS301",
    "What student clubs and AI research labs are recruiting this term?",
    "Recommend campus career panels with alumni working at Databricks and Stripe",
    "Help me prepare for Hack the Lake build sprint and find teammates",
  ];

  const currentModeOption = ROUTING_MODES.find((m) => m.key === routingMode) || ROUTING_MODES[0];

  const token = dismissed ? null : parseToken(draft);
  const menu: "at" | "slash" | null = plusOpen ? "at" : token?.kind ?? null;
  const query = plusOpen ? "" : token?.query ?? "";

  const rows: { key: string; name: string; desc: string }[] =
    menu === "at"
      ? SOURCES.filter((s) => s.name.toLowerCase().includes(query))
      : menu === "slash"
        ? COMMANDS.filter((c) => c.name.slice(1).startsWith(query))
        : [];

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, connected, rows.length]);

  const modelIndex = ROUTING_MODES.findIndex((m) => m.key === routingMode);
  useLayoutEffect(() => {
    if (!modelOpen) return;
    const target = modelRowRefs.current[modelHovered ?? modelIndex];
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [modelOpen, modelHovered, modelIndex]);

  useLayoutEffect(() => {
    if (!modelOpen || !composerAnchorRef.current || !modelRef.current) return;
    const anchorRect = composerAnchorRef.current.getBoundingClientRect();
    const triggerRect = modelRef.current.getBoundingClientRect();
    setModelMenuLeft(Math.max(0, Math.min(triggerRect.left - anchorRect.left, anchorRect.width - 240)));
    setModelMenuBottom(anchorRect.bottom - triggerRect.top + 8);
  }, [modelOpen, wide, routingMode]);

  useEffect(() => {
    if (!modelOpen) setModelHovered(null);
  }, [modelOpen]);

  useLayoutEffect(() => {
    const canvas = glimmRef.current;
    if (!canvas) return;
    const shader = createShader({
      canvas,
      palette: RAINBOW,
      brightness: 1,
      direction: "ltr",
    });
    shaderRef.current = shader;
    return () => {
      shader?.destroy();
    };
  }, []);

  const selectRoutingMode = (mode: RoutingOption) => {
    onSelectRoutingMode?.(mode.key);
    setModelOpen(false);
    if (shaderRef.current) {
      playSweep(shaderRef.current, { sweepMs: 900 });
    }
  };

  /* voice dictation & auto sample input */
  const fallbackToSampleVoice = () => {
    const sample = SAMPLE_VOICE_PROMPTS[sampleVoiceIndexRef.current % SAMPLE_VOICE_PROMPTS.length];
    sampleVoiceIndexRef.current += 1;
    setDraft("");
    setListening(true);
    setDismissed(true);

    const words = sample.split(" ");
    let curIndex = 0;

    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);

    const streamNextWord = () => {
      if (curIndex < words.length) {
        curIndex++;
        setDraft(words.slice(0, curIndex).join(" "));
        const delay = Math.floor(Math.random() * 80) + 120;
        voiceTimerRef.current = setTimeout(streamNextWord, delay);
      } else {
        setListening(false);
        if (shaderRef.current) {
          playSweep(shaderRef.current, { sweepMs: 900 });
        }
        inputRef.current?.focus();
      }
    };

    voiceTimerRef.current = setTimeout(streamNextWord, 180);
  };

  const startVoiceInput = () => {
    if (rateLimitBlocked) return;
    setListening(true);
    setDismissed(true);

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    let nativeStarted = false;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setDraft(currentTranscript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn("Speech recognition notice, using sample voice simulation:", e?.error);
          try {
            recognition.stop();
          } catch {}
          fallbackToSampleVoice();
        };

        recognition.onend = () => {
          setListening(false);
          if (shaderRef.current) {
            playSweep(shaderRef.current, { sweepMs: 800 });
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        nativeStarted = true;
      } catch (err) {
        console.warn("Could not start speech recognition, using sample simulation:", err);
      }
    }

    if (!nativeStarted) {
      fallbackToSampleVoice();
    }
  };

  const stopVoiceInput = () => {
    setListening(false);
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  };

  const toggleVoiceInput = () => {
    if (listening) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  };

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  /* keyboard navigation */
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (rateLimitBlocked) {
      event.preventDefault();
      return;
    }

    if (modelOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        setModelOpen(false);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const current = modelHovered ?? modelIndex;
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const next = (current + delta + ROUTING_MODES.length) % ROUTING_MODES.length;
        setModelHovered(next);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectRoutingMode(ROUTING_MODES[modelHovered ?? modelIndex]);
        return;
      }
    }

    if (menu) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => (current + 1) % rows.length);
        setEngaged(true);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => (current - 1 + rows.length) % rows.length);
        setEngaged(true);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (rows[active]) {
          event.preventDefault();
          pick(rows[active]);
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissed(true);
        setPlusOpen(false);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  /* auto-grow the textarea */
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    const minHeight = 22;
    const maxHeight = 160;
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [draft, expanded]);

  useEffect(() => {
    if (!modelOpen && !plusOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-promptbar]")) {
        setModelOpen(false);
        setPlusOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [modelOpen, plusOpen]);

  const closeMenus = () => {
    setPlusOpen(false);
    setModelOpen(false);
  };

  const pick = (row: { key: string; name: string }) => {
    const source = SOURCES.find((s) => s.key === row.key);
    if (source?.attach) {
      setAttachments((current) => [...current, FILES[current.length % FILES.length]]);
      if (token) setDraft(draft.slice(0, token.start));
    } else if (menu === "at") {
      setDraft(`${token ? draft.slice(0, token.start) : draft}@${row.name} `);
    } else {
      setDraft(`${token ? draft.slice(0, token.start) : draft}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !rateLimitBlocked;
  const send = () => {
    if (isWorking) {
      onStop?.();
      return;
    }
    if (!canSend) return;
    onSend?.(draft.trim());
    setDraft("");
    setAttachments([]);
    closeMenus();
  };

  // Format seconds into MM:SS
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div data-promptbar className="w-full">
      {/* ── Rate Limit Quota Cooldown Banner (design.md compliant) ── */}
      {rateLimitBlocked && (
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-[12px] border border-red/40 bg-red-tint/30 p-3 shadow-sm backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-[8px] bg-red text-white shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <b className="text-[13px] font-semibold text-red">Rate Limit Quota Active</b>
                <span className="rounded-full bg-red/15 px-2 py-0.2 font-mono text-[10.5px] font-semibold text-red">
                  Temporary Cooldown
                </span>
              </div>
              <p className="text-[11.5px] text-ink-2 mt-0.5">
                {rateLimitMessage || "High request volume detected. Your composer is paused to ensure fair platform usage."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-[8px] border border-red/30 bg-surface px-2.5 py-1 text-[12px] font-mono font-bold text-red tabular-nums shadow-sm shrink-0">
            <span className="size-2 rounded-full bg-red animate-ping" />
            <span>Unlocks in {formatCountdown(rateLimitSecondsRemaining)}</span>
          </div>
        </div>
      )}

      {/* composer is the anchor — menus grow up from its top edge */}
      <div ref={composerAnchorRef} className="relative">
        {/* ── @ / slash menu ─────────────────────────────── */}
        {menu && (
          <div
            onMouseLeave={() => setEngaged(false)}
            className="absolute bottom-full left-0 z-10 mb-2 w-72 rounded-[10px] bg-surface p-1 shadow-raised"
            style={{ animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom left" }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
              style={{
                top: rowBox?.top ?? 0,
                height: rowBox?.height ?? 0,
                opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
                transition: "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
              }}
            />
            {rows.map((row, i) => {
              const source = menu === "at" ? SOURCES.find((s) => s.key === row.key) : undefined;
              return (
                <button
                  key={row.key}
                  type="button"
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => {
                    setActive(i);
                    setEngaged(true);
                  }}
                  onClick={() => pick(row)}
                  className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
                >
                  {source && (
                    <span className="flex size-5.5 shrink-0 items-center justify-center text-ink-2">
                      {source.brand ? BRANDS[source.brand] : <Icon size={15}>{GLYPHS[source.glyph ?? "clip"]}</Icon>}
                    </span>
                  )}
                  <span className="shrink-0 text-[12.5px] font-medium text-ink">
                    {row.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{row.desc}</span>
                </button>
              );
            })}
            {rows.length === 0 && (
              <div className="flex h-9 items-center px-2 text-[12px] text-ink-3">
                No matches for “{query}”
              </div>
            )}
            <div className="mt-1 border-t border-line px-2 pt-1.5 pb-1 text-[11px] text-ink-3">
              {menu === "at" ? "Type to search sources & files" : "Type to search commands"}
            </div>
          </div>
        )}

        {/* ── 3-Way Mode / Model Selector Popover ──────────── */}
        {modelOpen && (
          <div
            onMouseLeave={() => setModelHovered(null)}
            className="absolute z-30 w-64 rounded-[12px] border border-line bg-surface p-1.5 shadow-2xl"
            style={{ left: modelMenuLeft, bottom: modelMenuBottom, animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom left" }}
          >
            <div className="px-2 py-1.5 border-b border-line mb-1">
              <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider block">Routing Strategy</span>
              <span className="text-[10.5px] text-ink-3">Select how prompts are processed</span>
            </div>

            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1.5 rounded-[8px] bg-hover"
              style={{
                top: modelBox?.top ?? 0,
                height: modelBox?.height ?? 0,
                opacity: modelBox && modelHovered !== null ? 1 : 0,
                transition: "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
              }}
            />
            {ROUTING_MODES.map((m, i) => {
              const isSelected = m.key === routingMode;
              return (
                <button
                  key={m.key}
                  type="button"
                  ref={(el) => {
                    modelRowRefs.current[i] = el;
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setModelHovered(i)}
                  onClick={() => selectRoutingMode(m)}
                  className={`relative z-10 flex w-full flex-col gap-0.5 rounded-[8px] p-2 text-left transition-colors cursor-pointer ${
                    isSelected ? "bg-accent-tint/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
                      {m.name}
                    </span>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full border ${
                      isSelected ? "border-accent/40 bg-accent-tint text-accent" : "border-line bg-field text-ink-3"
                    }`}>
                      {m.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-3 leading-tight pr-2">{m.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* ── composer ───────────────────────────────────── */}
        <div
          className={`relative isolate flex flex-col overflow-hidden border border-line bg-surface shadow-card transition-[border-color,border-radius] duration-150 focus-within:border-line-strong ${
            tall ? "gap-2.5 p-3.5" : "gap-1.5 p-1.5"
          } ${
            pill ? (attachments.length > 0 || wide ? "rounded-[24px]" : "rounded-full") : tall ? "rounded-[22px]" : "rounded-[14px]"
          } ${rateLimitBlocked ? "opacity-75 border-red/40" : ""}`}
        >
          {/* rainbow glimm sweep */}
          <canvas
            ref={glimmRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
            style={{ borderRadius: "inherit" }}
          />
          <span
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
          >
            {draft}
          </span>

          {attachments.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 pt-0.5 ${pill ? "px-1" : "px-0.5"}`}>
              {attachments.map((file, i) => (
                <span
                  key={`${file}-${i}`}
                  className={`flex h-6.5 items-center gap-1.5 bg-field py-1 pr-1 pl-1.5 text-[11.5px] text-ink-2 shadow-hairline ${
                    pill ? "rounded-full" : "rounded-chip"
                  }`}
                >
                  <Icon size={12} strokeWidth={2}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </Icon>
                  <span className="max-w-28 truncate">{file}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file}`}
                    onClick={() => setAttachments((current) => current.filter((_, idx) => idx !== i))}
                    className="flex size-4.5 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-hover hover:text-ink"
                  >
                    <Icon size={10} strokeWidth={2.4}><path d="M18 6 6 18M6 6l12 12" /></Icon>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* input grid */}
          <div
            ref={controlsRef}
            className={`grid items-end gap-1.5 ${
              wide ? "grid-cols-[auto_1fr_auto_auto_auto] gap-y-1.5" : "grid-cols-[auto_1fr_auto_auto_auto]"
            }`}
          >
            {/* plus button: opens the @ sources menu */}
            <button
              type="button"
              aria-label="Add sources or files"
              data-prompt-attach
              aria-expanded={plusOpen}
              disabled={rateLimitBlocked}
              onClick={() => {
                setModelOpen(false);
                setPlusOpen((current) => !current);
              }}
              className={`flex size-7 shrink-0 items-center justify-center transition-colors duration-150 ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${
                plusOpen ? "bg-hover text-ink" : "text-ink-3 hover:bg-hover hover:text-ink"
              } ${wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1"}`}
            >
              <Icon size={16} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon>
            </button>

            {/* main composer input */}
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              disabled={rateLimitBlocked}
              onChange={(e) => {
                setDraft(e.target.value);
                setDismissed(false);
              }}
              onKeyDown={onKeyDown}
              placeholder={
                rateLimitBlocked
                  ? `Cooldown active: unlocks in ${formatCountdown(rateLimitSecondsRemaining)}`
                  : placeholder || "Ask Campus Genie anything (Type @ for sources, / for commands)"
              }
              className={`w-full resize-none bg-transparent px-1 py-1 text-[13.5px] leading-[20px] text-ink outline-none placeholder:text-ink-3 ${
                wide ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1"
              } ${rateLimitBlocked ? "cursor-not-allowed opacity-60" : ""}`}
            />

            {/* 3-Way Mode selector pill button */}
            <button
              ref={modelRef}
              type="button"
              aria-expanded={modelOpen}
              aria-label="Choose routing mode"
              disabled={rateLimitBlocked}
              onClick={() => {
                setPlusOpen(false);
                setModelOpen((current) => !current);
              }}
              className={`flex h-7 shrink-0 items-center gap-1.5 px-2 text-[12px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink border border-line bg-surface ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${wide ? "col-start-2 row-start-2 justify-self-start" : "col-start-3 row-start-1"}`}
            >
              <span className={`size-1.5 rounded-full ${
                routingMode === "auto" ? "bg-cyan-500" : routingMode === "genie" ? "bg-accent animate-pulse" : "bg-emerald-500"
              }`} />
              <span>{currentModeOption.name}</span>
              <span className="text-ink-3">
                <Icon size={11} strokeWidth={2.4}><path d="M6 9l6 6 6-6" /></Icon>
              </span>
            </button>

            {/* dictation button */}
            <button
              type="button"
              aria-label={listening ? "Stop dictation" : "Start dictation"}
              aria-pressed={listening}
              disabled={rateLimitBlocked}
              onClick={toggleVoiceInput}
              className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${listening ? "bg-accent-tint text-accent-ink" : "text-ink-3 hover:bg-hover hover:text-ink"} ${
                wide ? "col-start-4 row-start-2" : "col-start-4 row-start-1"
              }`}
            >
              {listening ? (
                <span className="flex h-3.5 items-center gap-[2.5px]">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-[2.5px] rounded-full bg-current"
                      style={{ height: "100%", animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite` }}
                    />
                  ))}
                </span>
              ) : (
                <Icon size={15} strokeWidth={2}><g><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></g></Icon>
              )}
            </button>

            {/* send/stop button */}
            <button
              type="button"
              aria-label={isWorking ? "Stop response" : "Send"}
              data-prompt-send={!isWorking ? "true" : undefined}
              data-prompt-stop={isWorking ? "true" : undefined}
              title={isWorking ? "Stop response" : "Send"}
              disabled={(!isWorking && !canSend) || rateLimitBlocked}
              onClick={send}
              className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1"}`}
              style={{
                background: isWorking || canSend ? "var(--ink)" : "var(--line-strong)",
                color: isWorking || canSend ? "var(--surface)" : "var(--ink-2)",
              }}
            >
              {isWorking ? (
                <Icon size={14} strokeWidth={2.5}><rect x="7" y="7" width="10" height="10" rx="1.5" /></Icon>
              ) : (
                <Icon size={16} strokeWidth={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
