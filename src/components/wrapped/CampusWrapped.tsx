"use client";

import { useEffect, useRef, useState } from "react";
import { Shimmer } from "@/components/atoms/Shimmer";
import { Button } from "@/components/atoms/Button";
import { StatusPill } from "@/components/atoms/StatusPill";

type WrappedPayload = {
  term: string;
  stats: {
    eventsDiscovered: number;
    eventsAttended: number;
    newConnections: number;
    projects: number;
    clubsExplored: number;
    alumniConversations: number;
  };
  personality: Array<{ key: "creator" | "builder" | "researcher" | "connector"; label: string; share: number }>;
  dominant: "creator" | "builder" | "researcher" | "connector";
  crossDepartmentPct: number;
  weeklyActivity: number[];
  topCategories: Array<{ label: string; pct: number }>;
  derivedFrom: string[];
};

function Icon({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const PERSONALITY_META: Record<string, { color: string; tint: string; blurb: string; icon: React.ReactNode }> = {
  creator: {
    color: "oklch(0.67 0.19 3)",
    tint: "oklch(0.67 0.19 3 / 0.14)",
    blurb: "You launch things — fliers, zines, opening slides.",
    icon: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.6-1.7-1.9-1.7-3.2 0-1 .8-1.7 2-1.7h1.9A4.8 4.8 0 0 0 21 9.5C21 5.9 17 3 12 3Z" />
        <circle cx="7.7" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="10.8" cy="7.1" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="14.9" cy="7.9" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  builder: {
    color: "var(--accent)",
    tint: "var(--accent-tint)",
    blurb: "You ship — repos, demos, 3 AM deploys.",
    icon: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z" />,
  },
  researcher: {
    color: "oklch(0.66 0.17 300)",
    tint: "oklch(0.66 0.17 300 / 0.14)",
    blurb: "You dig — papers, benchmarks, why-it-works.",
    icon: (
      <>
        <path d="M10 2.5v6.2L4.6 18a2 2 0 0 0 1.8 3h11.2a2 2 0 0 0 1.8-3L14 8.7V2.5" />
        <path d="M8.5 2.5h7M7.5 14.5h9" />
      </>
    ),
  },
  connector: {
    color: "var(--green)",
    tint: "var(--green-tint)",
    blurb: "You gather — group chats, intros, teamwork.",
    icon: (
      <>
        <circle cx="8.5" cy="8" r="3.2" />
        <path d="M2.5 20v-.8a4.2 4.2 0 0 1 4.2-4.2h3.6a4.2 4.2 0 0 1 4.2 4.2V20" />
        <path d="M17 5.5a3.2 3.2 0 0 1 0 5.6M19 15.8a4.2 4.2 0 0 1 2.5 3.6V20" />
      </>
    ),
  },
};

const STAT_CARDS: Array<{
  key: keyof WrappedPayload["stats"];
  label: string;
  color: string;
  tint: string;
  icon: React.ReactNode;
}> = [
  { key: "eventsDiscovered", label: "Events discovered", color: "var(--accent)", tint: "var(--accent-tint)", icon: <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></> },
  { key: "eventsAttended", label: "Attended", color: "var(--green)", tint: "var(--green-tint)", icon: <path d="M20 6 9 17l-5-5" /> },
  { key: "newConnections", label: "New connections", color: "oklch(0.67 0.19 3)", tint: "oklch(0.67 0.19 3 / 0.14)", icon: <><circle cx="8.5" cy="8" r="3.2" /><path d="M2.5 20v-.8a4.2 4.2 0 0 1 4.2-4.2h3.6a4.2 4.2 0 0 1 4.2 4.2V20" /><path d="M17 5.5a3.2 3.2 0 0 1 0 5.6" /></> },
  { key: "projects", label: "Projects shipped", color: "var(--orange)", tint: "var(--orange-tint)", icon: <><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></> },
  { key: "clubsExplored", label: "Clubs explored", color: "oklch(0.72 0.10 221)", tint: "oklch(0.72 0.10 221 / 0.14)", icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 3v18" /></> },
  { key: "alumniConversations", label: "Alumni conversations", color: "oklch(0.66 0.17 300)", tint: "oklch(0.66 0.17 300 / 0.14)", icon: <><path d="M22 9.5 12 4.5 2 9.5l10 5 10-5Z" /><path d="M6 11.8V16c3.2 2.6 8.8 2.6 12 0v-4.2" /></> },
];

const CONFETTI_COLORS = ["var(--accent)", "var(--green)", "var(--orange)", "oklch(0.66 0.17 300)", "oklch(0.67 0.19 3)"];

function Confetti({ pieces = 22 }: { pieces?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => {
        const unit = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const isDot = i % 3 === 0;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${4 + unit(1) * 92}%`,
              top: `${unit(2) * 70}%`,
              width: isDot ? 5 : 4 + Math.round(unit(3) * 4),
              height: isDot ? 5 : 4 + Math.round(unit(3) * 4),
              borderRadius: isDot ? "9999px" : 2,
              background: color,
              opacity: 0,
              animation: `confetti-drift ${2400 + unit(4) * 1800}ms linear infinite`,
              animationDelay: `${unit(5) * 2600}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

function useCountUp(target: number, delay: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const begin = performance.now() + delay;
    const tick = (now: number) => {
      if (start === null) start = begin;
      const p = Math.min(1, Math.max(0, (now - begin) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration]);
  return value;
}

function StatCounter({ target, delay }: { target: number; delay: number }) {
  const value = useCountUp(target, delay);
  return <>{value}</>;
}

function WeeklySpark({ points }: { points: number[] }) {
  const w = 260;
  const h = 56;
  const max = Math.max(...points, 1);
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - (p / max) * (h - 8) - 4] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full text-accent" aria-hidden="true">
      <path d={area} fill="var(--accent-tint)" stroke="none" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (i === coords.length - 1 ? <circle key={i} cx={x} cy={y} r="3.5" fill="currentColor" /> : null))}
    </svg>
  );
}

export default function CampusWrapped() {
  const [payload, setPayload] = useState<WrappedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wrapped", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
        return res.json() as Promise<WrappedPayload>;
      })
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const crossDept = payload?.crossDepartmentPct ?? 68;

  return (
    <div className="p-4 md:p-6 space-y-6" ref={scrollRef}>
      {error && (
        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-canvas p-4 shadow-card">
          <StatusPill tone="red">Wrapped unavailable</StatusPill>
          <span className="text-[12.5px] text-ink-2">{error}</span>
        </div>
      )}

      {!payload && !error && (
        <div className="space-y-4">
          <Shimmer className="text-[18px]">Compiling your semester rewind from the Lakehouse…</Shimmer>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[104px] rounded-[12px] border border-line bg-inset shadow-card" />
            ))}
          </div>
        </div>
      )}

      {payload && (
        <div key={replayKey} className="space-y-6">
          {/* ── hero ─────────────────────────────────────────── */}
          <section
            className="relative overflow-hidden rounded-[14px] border border-line bg-surface p-6 md:p-8 shadow-raised"
            style={{ animation: "rise-in 420ms var(--ease-out-strong) both" }}
          >
            <Confetti />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-tint px-2.5 text-[12px] font-medium leading-none text-accent-ink">
                  <Icon size={12}><path d="M12 2.5 L14 9 l6.5 2 L14 13 l-2 6.5 L10 13 l-6.5 -2 L10 9 l2 -6.5 Z" /></Icon>
                  Semester rewind
                </span>
                <h2
                  className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[32px]"
                  style={{
                    backgroundImage: "linear-gradient(90deg, var(--ink) 20%, var(--accent-ink) 50%, var(--ink) 80%)",
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    animation: "shimmer-text 2.6s linear infinite",
                  }}
                >
                  Your Campus Wrapped
                </h2>
                <p className="mt-1 text-[13px] font-medium text-ink-3 tabular-nums">{payload.term} · one term, every signal</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setReplayKey((k) => k + 1)}>
                <span style={{ display: "inline-flex" }}><Icon size={13}><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5" /></Icon></span>
                Replay
              </Button>
            </div>
          </section>

          {/* ── headline stats ───────────────────────────────── */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {STAT_CARDS.map((card, i) => (
              <div
                key={card.key}
                className="relative overflow-hidden rounded-[12px] border border-line bg-canvas p-4 shadow-card"
                style={{ animation: "rise-in 460ms var(--ease-out-strong) both", animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border"
                    style={{ color: card.color, background: card.tint, borderColor: "color-mix(in srgb, currentColor 24%, transparent)" }}
                  >
                    <Icon size={18}>{card.icon}</Icon>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[24px] font-semibold leading-none text-ink tabular-nums">
                      <StatCounter target={payload.stats[card.key]} delay={200 + i * 90} />
                    </div>
                    <div className="mt-1 truncate text-[11.5px] font-medium text-ink-3">{card.label}</div>
                  </div>
                </div>
                <div
                  className="absolute inset-x-0 bottom-0 h-[3px]"
                  style={{
                    background: card.color,
                    transformOrigin: "left",
                    animation: "bar-scale 900ms var(--ease-out-strong) both",
                    animationDelay: `${200 + i * 90}ms`,
                  }}
                />
              </div>
            ))}
          </section>

          {/* ── personality ──────────────────────────────────── */}
          <section className="rounded-[12px] border border-line bg-canvas p-4 shadow-card md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">Your campus personality</h3>
                <p className="text-[12.5px] text-ink-2">Every event you touched fed the mix — here&apos;s the blend.</p>
              </div>
              <span className="text-[11.5px] font-medium text-ink-3 tabular-nums">
                dominant · {payload.personality[0].label.toLowerCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {payload.personality.map((p, i) => {
                const meta = PERSONALITY_META[p.key];
                const isDominant = p.key === payload.dominant;
                return (
                  <div
                    key={p.key}
                    className="relative flex flex-col items-center gap-3 rounded-[12px] border p-4 text-center"
                    style={{
                      animation: "rise-in 480ms var(--ease-out-strong) both",
                      animationDelay: `${i * 90}ms`,
                      borderColor: isDominant ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--line-soft)",
                      background: isDominant ? "var(--accent-tint)" : "var(--inset)",
                      boxShadow: isDominant ? "0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)" : undefined,
                    }}
                  >
                    {isDominant && (
                      <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-accent text-white shadow-btn">
                        <Icon size={11}><path d="M12 2.8l2.8 5.9 6.2.8-4.6 4.4 1.2 6.3L12 17l-5.6 3.2 1.2-6.3L3 9.5l6.2-.8L12 2.8Z" /></Icon>
                      </span>
                    )}
                    <span
                      className="flex size-14 items-center justify-center rounded-full border"
                      style={{ color: meta.color, background: meta.tint, borderColor: "color-mix(in srgb, currentColor 26%, transparent)" }}
                    >
                      <Icon size={24}>{meta.icon}</Icon>
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold text-ink">{p.label}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{meta.blurb}</div>
                    </div>
                    <div className="w-full">
                      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-ink-3 tabular-nums">
                        <span>share</span>
                        <span className="text-ink">{p.share}%</span>
                      </div>
                      <div className="h-[6px] overflow-hidden rounded-full bg-canvas shadow-hairline">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${p.share}%`,
                            background: meta.color,
                            transformOrigin: "left",
                            animation: "bar-scale 800ms var(--ease-out-strong) both",
                            animationDelay: `${300 + i * 90}ms`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── cross-department + weekly pulse ──────────────── */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              className="rounded-[12px] border border-line bg-canvas p-4 shadow-card md:p-5"
              style={{ animation: "rise-in 500ms var(--ease-out-strong) both", animationDelay: "120ms" }}
            >
              <h3 className="text-[15px] font-semibold text-ink">Outside your bubble</h3>
              <p className="text-[12.5px] text-ink-2">Event time spent with people outside your department.</p>
              <div className="mt-4 flex items-center gap-5">
                <div className="relative size-[104px] shrink-0">
                  <svg viewBox="0 0 104 104" className="size-full">
                    <circle cx="52" cy="52" r="44" fill="none" stroke="var(--inset)" strokeWidth="9" />
                    <circle
                      cx="52"
                      cy="52"
                      r="44"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={`${(crossDept / 100) * 276.5} 276.5`}
                      transform="rotate(-90 52 52)"
                      style={{ transformOrigin: "center", animation: "bar-scale 900ms var(--ease-out-strong) both", transformBox: "fill-box" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[24px] font-semibold leading-none text-ink tabular-nums">
                      <StatCounter target={crossDept} delay={420} />%
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
                    <span className="size-2.5 shrink-0 rounded-full bg-accent" />
                    Cross-department
                    <span className="ml-auto text-ink tabular-nums">{crossDept}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
                    <span className="size-2.5 shrink-0 rounded-full bg-inset shadow-hairline" />
                    Own department
                    <span className="ml-auto text-ink tabular-nums">{100 - crossDept}%</span>
                  </div>
                  <p className="pt-1 text-[11.5px] leading-relaxed text-ink-3">
                    You keep good company outside your wing — that&apos;s where the surprise projects live.
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-[12px] border border-line bg-canvas p-4 shadow-card md:p-5"
              style={{ animation: "rise-in 500ms var(--ease-out-strong) both", animationDelay: "200ms" }}
            >
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-ink">Weekly pulse</h3>
                <span className="text-[11.5px] font-medium text-ink-3 tabular-nums">12 weeks</span>
              </div>
              <p className="text-[12.5px] text-ink-2">Campus activity intensity, week by week.</p>
              <div className="mt-4">
                <WeeklySpark points={payload.weeklyActivity} />
                <div className="mt-1 flex justify-between text-[10.5px] font-medium text-ink-3 tabular-nums">
                  <span>W1</span><span>W6</span><span>W12</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-line-soft pt-4">
                {payload.topCategories.map((cat, i) => (
                  <div key={cat.label} className="flex items-center gap-2.5">
                    <span className="w-[92px] shrink-0 truncate text-[11.5px] font-medium text-ink-2">{cat.label}</span>
                    <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-inset">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${cat.pct}%`,
                          background: ["var(--accent)", "var(--green)", "var(--orange)", "oklch(0.66 0.17 300)"][i % 4],
                          transformOrigin: "left",
                          animation: "bar-scale 800ms var(--ease-out-strong) both",
                          animationDelay: `${420 + i * 90}ms`,
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] font-medium text-ink-3 tabular-nums">{cat.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── footer strip ─────────────────────────────────── */}
          <footer
            className="flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 text-[11.5px] font-medium text-ink-3 shadow-card tabular-nums"
            style={{ animation: "rise-in 520ms var(--ease-out-strong) both", animationDelay: "260ms" }}
          >
            <span className="text-green"><Icon size={13}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></Icon></span>
            compiled from
            {payload.derivedFrom.map((table) => (
              <code key={table} className="rounded-[5px] bg-inset px-1.5 py-0.5 font-mono text-[11px] text-accent-ink">{table}</code>
            ))}
            <span className="ml-auto">Campus Genie · Wrapped {payload.term}</span>
          </footer>
        </div>
      )}
    </div>
  );
}
