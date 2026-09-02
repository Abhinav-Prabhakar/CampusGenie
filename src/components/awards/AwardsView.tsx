"use client";

import { useEffect, useMemo, useState } from "react";
import RecordsTable, { type RecordRow } from "@/components/primitives/RecordsTable";
import { Shimmer } from "@/components/atoms/Shimmer";
import { StatusPill } from "@/components/atoms/StatusPill";
import { Button } from "@/components/atoms/Button";

type AwardRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  position: 1 | 2 | 3;
  winnerName: string;
  winnerStudentId: string;
  teamName: string;
  projectTitle: string;
  prize: string;
  category: string;
  awardedAt: string;
};

type AwardsPayload = { events: Array<{ id: string; title: string; category: string; winners: number }>; awards: AwardRecord[] };

const TIER_META: Record<1 | 2 | 3, {
  label: string;
  color: string;
  tint: string;
  baseHeight: number;
  numeral: string;
}> = {
  1: { label: "Champion", color: "oklch(0.8 0.15 85)", tint: "oklch(0.8 0.15 85 / 0.14)", baseHeight: 84, numeral: "01" },
  2: { label: "Runner-up", color: "oklch(0.75 0.02 260)", tint: "oklch(0.75 0.02 260 / 0.14)", baseHeight: 60, numeral: "02" },
  3: { label: "Third place", color: "oklch(0.63 0.11 50)", tint: "oklch(0.63 0.11 50 / 0.16)", baseHeight: 42, numeral: "03" },
};

function Icon({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Medal({ tier, size = 30 }: { tier: 1 | 2 | 3; size?: number }) {
  const c = TIER_META[tier].color;
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full border"
      style={{
        width: size,
        height: size,
        color: c,
        background: TIER_META[tier].tint,
        borderColor: "color-mix(in srgb, currentColor 40%, transparent)",
        boxShadow: `0 0 0 3px color-mix(in srgb, currentColor 14%, transparent)`,
      }}
    >
      <Icon size={size * 0.5}><path d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /><path d="M8.5 14 7 21.5l5-2.6 5 2.6L15.5 14" /></Icon>
      <span
        className="absolute inset-[3px] rounded-full border"
        style={{ borderColor: "color-mix(in srgb, currentColor 30%, transparent)" }}
      />
    </span>
  );
}

function PodiumColumn({ award, delay }: { award: AwardRecord; delay: number }) {
  const meta = TIER_META[award.position];
  const isChampion = award.position === 1;
  const initials = award.winnerName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      className="flex w-full max-w-[230px] flex-col items-center"
      style={{ animation: "rise-in 480ms var(--ease-out-strong) both", animationDelay: `${delay}ms` }}
    >
      {/* winner card */}
      <div
        className="relative flex w-full flex-col items-center gap-2 rounded-[12px] border p-4 text-center"
        style={{
          borderColor: isChampion ? "color-mix(in srgb, var(--accent) 34%, transparent)" : "var(--line)",
          background: isChampion ? "var(--accent-tint)" : "var(--surface)",
          boxShadow: isChampion ? "0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent), var(--shadow-raised)" : "var(--shadow-card)",
        }}
      >
        {isChampion && (
          <span className="absolute -top-3 flex h-6 items-center gap-1 rounded-full bg-accent px-2.5 text-[11px] font-semibold leading-none text-white shadow-btn">
            <Icon size={11}><path d="M3 18 5 8l4.5 4L12 5l2.5 7L19 8l2 10Z" /></Icon>
            Champion
          </span>
        )}
        <span className="relative">
          <span
            className="flex size-12 items-center justify-center rounded-[12px] border text-[16px] font-semibold"
            style={{ color: meta.color, background: meta.tint, borderColor: "color-mix(in srgb, currentColor 26%, transparent)" }}
          >
            {initials}
          </span>
          <span className="absolute -bottom-1.5 -right-1.5">
            <Medal tier={award.position} size={22} />
          </span>
        </span>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-ink">{award.winnerName}</div>
          <div className="truncate text-[11.5px] font-medium text-ink-3 tabular-nums">
            {award.winnerStudentId}
          </div>
        </div>
        <div className="w-full border-t border-line-soft pt-2">
          <div className="truncate text-[12px] font-medium text-ink-2" title={award.projectTitle}>
            {award.projectTitle}
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] font-medium text-ink-3">
            <Icon size={11}><path d="M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21" /><circle cx="9" cy="7.5" r="3.5" /></Icon>
            {award.teamName}
          </div>
        </div>
        <span
          className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium leading-none"
          style={{ color: meta.color, background: meta.tint, borderColor: "color-mix(in srgb, currentColor 30%, transparent)" }}
        >
          <Icon size={11}><path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9l2-6.5Z" /></Icon>
          {award.prize}
        </span>
      </div>

      {/* podium base */}
      <div
        className="flex w-full items-start justify-center rounded-t-[10px] border border-b-0 pt-2"
        style={{
          height: meta.baseHeight,
          background: "var(--inset)",
          borderColor: `color-mix(in srgb, ${meta.color} 32%, transparent)`,
          borderTopWidth: 2,
        }}
      >
        <span className="text-[15px] font-semibold tabular-nums" style={{ color: meta.color }}>{meta.numeral}</span>
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const POSITION_TAGS: Record<1 | 2 | 3, string> = { 1: "Champion", 2: "Runner-up", 3: "Third" };

export default function AwardsView() {
  const [payload, setPayload] = useState<AwardsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/awards", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
        return res.json() as Promise<AwardsPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        if (data.events.length > 0) setSelectedEventId(data.events[0].id);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const selectedEvent = payload?.events.find((e) => e.id === selectedEventId) ?? null;
  const podium = useMemo(() => {
    const all = payload?.awards ?? [];
    const forEvent = all.filter((a) => a.eventId === selectedEventId);
    // display order: 2nd · 1st · 3rd (classic podium silhouette)
    return [forEvent.find((a) => a.position === 2), forEvent.find((a) => a.position === 1), forEvent.find((a) => a.position === 3)]
      .filter((a): a is AwardRecord => Boolean(a));
  }, [payload, selectedEventId]);

  const tableRows: RecordRow[] = useMemo(() => {
    const all = payload?.awards ?? [];
    return all.map((a) => ({
      id: a.id,
      name: `${a.winnerName} — ${a.teamName !== "—" ? a.teamName : "Solo"}`,
      tags: [POSITION_TAGS[a.position], a.category],
      last: a.eventTitle,
      strength: "strong" as const,
      website: `linkedin.com/in/${slugify(a.winnerName)}`,
    }));
  }, [payload]);

  const totalWinners = payload?.awards.length ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink">Awards &amp; Prize Distributions</h2>
          <p className="text-[13px] text-ink-2">
            Every podium, prize, and project from (
            <code className="font-mono text-xs text-accent-ink">workspace.campus_explorer.event_awards</code>
            )
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone="accent"><span className="tabular-nums">{totalWinners}</span> winners honoured</StatusPill>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-canvas p-4 shadow-card">
          <StatusPill tone="red">Awards unavailable</StatusPill>
          <span className="text-[12.5px] text-ink-2">{error}</span>
        </div>
      )}

      {!payload && !error && (
        <div className="space-y-4">
          <Shimmer className="text-[14px]">Tallying podiums from the Lakehouse…</Shimmer>
          <div className="flex items-end justify-center gap-4">
            <div className="h-[180px] w-[200px] rounded-[12px] border border-line bg-inset" />
            <div className="h-[240px] w-[200px] rounded-[12px] border border-line bg-inset" />
            <div className="h-[150px] w-[200px] rounded-[12px] border border-line bg-inset" />
          </div>
        </div>
      )}

      {payload && payload.events.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-line-strong bg-canvas p-10 text-center shadow-card">
          <span className="flex size-12 items-center justify-center rounded-[12px] bg-orange-tint text-orange">
            <Icon size={24}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 5.5H4.5a3 3 0 0 0 3 4.8M17 5.5h2.5a3 3 0 0 1-3 4.8" /><path d="M12 14v3M8.5 20.5h7" /></Icon>
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">No podiums yet</h3>
            <p className="mt-1 text-[12.5px] text-ink-2">Award ceremonies will appear here once results are recorded in <code className="font-mono text-[11.5px] text-accent-ink">event_awards.delta</code>.</p>
          </div>
        </div>
      )}

      {payload && payload.events.length > 0 && (
        <>
          {/* event picker */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {payload.events.map((event) => {
              const active = event.id === selectedEventId;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors duration-150 ${
                    active ? "bg-hover-2 text-ink shadow-hairline" : "bg-surface text-ink-2 hover:bg-hover hover:text-ink"
                  }`}
                >
                  <span className={active ? "text-accent" : "text-ink-3"}>
                    <Icon size={13}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 5.5H4.5a3 3 0 0 0 3 4.8M17 5.5h2.5a3 3 0 0 1-3 4.8" /><path d="M12 14v3M8.5 20.5h7" /></Icon>
                  </span>
                  {event.title}
                  <span className="text-[11px] font-medium text-ink-3 tabular-nums">{event.winners}</span>
                </button>
              );
            })}
          </div>

          {/* podium */}
          {selectedEvent && (
            <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card md:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">{selectedEvent.title}</h3>
                  <p className="text-[12.5px] text-ink-2">Final standings — {selectedEvent.category}</p>
                </div>
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-inset px-2.5 text-[11.5px] font-medium leading-none text-ink-2 tabular-nums shadow-hairline">
                  <Icon size={11}><path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9l2-6.5Z" /></Icon>
                  {podium.reduce((sum, a) => sum + (Number(a.prize.replace(/[^\d]/g, "").slice(0, 6)) || 0), 0).toLocaleString("en-IN")} in prizes
                </span>
              </div>
              <div className="flex items-end justify-center gap-4">
                {podium.map((award) => (
                  <PodiumColumn key={award.id} award={award} delay={award.position === 1 ? 0 : award.position === 2 ? 90 : 180} />
                ))}
              </div>
            </div>
          )}

          {/* winners ledger */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-ink">Winners ledger</h3>
                <p className="text-[12.5px] text-ink-2">All prize distributions across every event this term</p>
              </div>
              <Button variant="secondary" className="text-xs">Export results</Button>
            </div>
            <div className="rounded-[12px] border border-line bg-canvas p-1 shadow-card overflow-hidden">
              <RecordsTable rows={tableRows} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
