"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SegmentedControl } from "@/components/atoms/SegmentedControl";
import { Shimmer } from "@/components/atoms/Shimmer";
import { Button } from "@/components/atoms/Button";
import { StatusPill } from "@/components/atoms/StatusPill";

type Seeking = "hackathon" | "project" | "study";

type TeammateProfile = {
  id: string;
  name: string;
  year: string;
  major: string;
  college: string;
  seeking: Seeking;
  bio: string;
  skills: string[];
  availabilityNote: string;
  commitmentNote: string;
  stats: { collaboration: number; availability: number; skillDepth: number; consistency: number };
  contactHint: string;
};

type DeckPayload = { queue: TeammateProfile[]; total: number; reviewed: number; liked: number };

const SEEKING_META: Record<Seeking, { label: string; tone: "accent" | "green" | "orange"; icon: React.ReactNode }> = {
  hackathon: {
    label: "Hackathon team",
    tone: "accent",
    icon: <path d="M13 2 3 14h8l-1 8 11-12h-8l1-8Z" />,
  },
  project: {
    label: "Project partner",
    tone: "green",
    icon: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z" />,
  },
  study: {
    label: "Study partner",
    tone: "orange",
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
  },
};

const MONOGRAM_HUES = [
  { color: "var(--accent)", bg: "var(--accent-tint)" },
  { color: "var(--green)", bg: "var(--green-tint)" },
  { color: "var(--orange)", bg: "var(--orange-tint)" },
  { color: "oklch(0.66 0.17 300)", bg: "oklch(0.66 0.17 300 / 0.14)" },
  { color: "oklch(0.72 0.10 221)", bg: "oklch(0.72 0.10 221 / 0.14)" },
  { color: "oklch(0.67 0.19 3)", bg: "oklch(0.67 0.19 3 / 0.14)" },
];

function hueFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return MONOGRAM_HUES[hash % MONOGRAM_HUES.length];
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Icon({ children, size = 14 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const STAT_META: Array<{
  key: keyof TeammateProfile["stats"];
  label: string;
  color: string;
  icon: React.ReactNode;
}> = [
  { key: "collaboration", label: "Collaboration", color: "var(--accent)", icon: (
      <>
        <circle cx="8.5" cy="8" r="3.2" />
        <path d="M2.5 20v-.8a4.2 4.2 0 0 1 4.2-4.2h3.6a4.2 4.2 0 0 1 4.2 4.2V20" />
        <path d="M17 5.5a3.2 3.2 0 0 1 0 5.6" />
        <path d="M19 15.8a4.2 4.2 0 0 1 2.5 3.6V20" />
      </>
    ) },
  { key: "availability", label: "Availability", color: "var(--green)", icon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></> },
  { key: "skillDepth", label: "Skill depth", color: "oklch(0.66 0.17 300)", icon: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></> },
  { key: "consistency", label: "Consistency", color: "var(--orange)", icon: <path d="M12 2.5s6 4.8 6 10a6 6 0 0 1-12 0c0-5.2 6-10 6-10Z" /> },
];

function StatBar({ meta, value, delay }: { meta: (typeof STAT_META)[number]; value: number; delay: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-ink-3" style={{ color: meta.color }}>
          <Icon size={13}>{meta.icon}</Icon>
        </span>
        <span className="flex-1 text-[11.5px] font-medium text-ink-2">{meta.label}</span>
        <span className="text-[11.5px] font-semibold text-ink tabular-nums">{value}</span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-full bg-inset">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: meta.color,
            transformOrigin: "left",
            animation: `bar-scale 700ms var(--ease-out-strong) both`,
            animationDelay: `${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

function FactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
      <span className="shrink-0 text-ink-3">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function TeammateCard({ profile, depth }: { profile: TeammateProfile; depth: number }) {
  const hue = hueFor(profile.id);
  const seeking = SEEKING_META[profile.seeking];
  const behind = depth > 0;

  return (
    <div
      aria-hidden={behind}
      className="absolute inset-x-0 top-0 flex flex-col rounded-[14px] border border-line bg-surface shadow-raised"
      style={{
        padding: "18px 18px 16px",
        zIndex: 10 - depth,
        transform: behind
          ? `translateY(${depth * 14}px) scale(${1 - depth * 0.05}) rotate(${depth % 2 === 0 ? -1.6 : 1.8}deg)`
          : undefined,
        opacity: behind ? 1 - depth * 0.35 : 1,
        pointerEvents: behind ? "none" : undefined,
        transition: "transform 320ms var(--ease-out-strong), opacity 320ms var(--ease-out-strong)",
        ...(behind ? {} : { animation: "rise-in 340ms var(--ease-out-strong) both" }),
      }}
    >
      {/* header row */}
      <div className="mb-3.5 flex items-center gap-2">
        <span
          className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium leading-none"
          style={
            seeking.tone === "accent"
              ? { background: "var(--accent-tint)", color: "var(--accent-ink)" }
              : seeking.tone === "green"
                ? { background: "var(--green-tint)", color: "var(--green)" }
                : { background: "var(--orange-tint)", color: "var(--orange)" }
          }
        >
          <Icon size={12}>{seeking.icon}</Icon>
          {seeking.label}
        </span>
        <span className="ml-auto text-[11.5px] font-medium text-ink-3 tabular-nums">{profile.year}</span>
      </div>

      {/* identity */}
      <div className="flex items-start gap-3.5">
        <span
          className="relative flex size-16 shrink-0 items-center justify-center rounded-[12px] border text-[20px] font-semibold"
          style={{ color: hue.color, background: hue.bg, borderColor: "color-mix(in srgb, currentColor 26%, transparent)" }}
        >
          {initialsFor(profile.name)}
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-btn">
            <Icon size={11}>{seeking.icon}</Icon>
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-semibold tracking-[-0.01em] text-ink">{profile.name}</h3>
          <p className="truncate text-[12.5px] font-medium text-ink-2">{profile.major}</p>
          <p className="truncate text-[11.5px] font-medium text-ink-3">{profile.college}</p>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{profile.bio}</p>

      {/* skills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile.skills.slice(0, 4).map((skill) => {
          const h = hueFor(profile.id + skill);
          return (
            <span
              key={skill}
              className="inline-flex h-5.5 items-center rounded-[6px] border px-1.5 text-[11px] font-medium leading-none"
              style={{ color: h.color, background: h.bg, borderColor: "color-mix(in srgb, currentColor 24%, transparent)" }}
            >
              {skill}
            </span>
          );
        })}
      </div>

      {/* stats */}
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line-soft pt-4">
        {STAT_META.map((meta, i) => (
          <StatBar key={meta.key} meta={meta} value={profile.stats[meta.key]} delay={120 + i * 90} />
        ))}
      </div>

      {/* facts */}
      <div className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-4">
        <FactRow icon={<Icon size={13}><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></Icon>}>
          {profile.availabilityNote}
        </FactRow>
        <FactRow icon={<Icon size={13}><path d="M13 2 3 14h8l-1 8 11-12h-8l1-8Z" /></Icon>}>
          {profile.commitmentNote}
        </FactRow>
        <FactRow icon={<Icon size={13}><path d="M12 21.5s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11Z" /><circle cx="12" cy="10.2" r="2.6" /></Icon>}>
          {profile.contactHint}
        </FactRow>
      </div>
    </div>
  );
}

export default function TeammateMatcher() {
  const [deck, setDeck] = useState<DeckPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | "Hackathon" | "Project" | "Study">("All");
  const [exiting, setExiting] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [match, setMatch] = useState<TeammateProfile | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [likedCount, setLikedCount] = useState(0);
  const busyRef = useRef(false);

  const loadDeck = useCallback(() => {
    fetch("/api/teammates", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
        return res.json() as Promise<DeckPayload>;
      })
      .then((data) => {
        setDeck(data);
        setLikedCount(data.liked);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const queue = useMemo(() => {
    const all = deck?.queue ?? [];
    if (filter === "All") return all;
    const seeking = filter.toLowerCase() as Seeking;
    return all.filter((p) => p.seeking === seeking);
  }, [deck, filter]);

  const visible = exiting ? queue.filter((p) => p.id !== exiting.id) : queue;

  const act = useCallback(
    (dir: 1 | -1) => {
      if (busyRef.current) return;
      const current = queue[0];
      if (!current || exiting) return;
      busyRef.current = true;
      setExiting({ id: current.id, dir });

      const action = dir === 1 ? "like" : "pass";
      fetch("/api/teammates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: current.id, action }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("failed");
          const data = (await res.json()) as { matched: boolean };
          if (data.matched) {
            setMatchedCount((c) => c + 1);
            setTimeout(() => setMatch(current), 260);
          }
        })
        .catch(() => {
          /* keep the card moving even if the sync hiccups */
        });

      setTimeout(() => {
        setExiting(null);
        setDeck((d) => (d ? { ...d, queue: d.queue.filter((p) => p.id !== current.id), reviewed: d.reviewed + 1 } : d));
        if (action === "like") setLikedCount((c) => c + 1);
        busyRef.current = false;
      }, 320);
    },
    [queue, exiting]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") act(-1);
      if (e.key === "ArrowRight") act(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act]);

  useEffect(() => {
    if (!match) return;
    const t = setTimeout(() => setMatch(null), 3000);
    return () => clearTimeout(t);
  }, [match]);

  const progress = deck && deck.total > 0 ? Math.round((deck.reviewed / deck.total) * 100) : 0;

  return (
    <div className="p-4 md:p-6">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink">Teammate Matcher</h2>
          <p className="text-[13px] text-ink-2">
            Project, hackathon &amp; study partners across colleges — details and working style only, no photos.
          </p>
        </div>
        <SegmentedControl
          options={["All", "Hackathon", "Project", "Study"] as const}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-[12px] border border-line bg-canvas p-4 shadow-card">
          <StatusPill tone="red">Deck unavailable</StatusPill>
          <span className="text-[12.5px] text-ink-2">{error}</span>
        </div>
      )}

      {!deck && !error && (
        <div className="mx-auto max-w-[430px]">
          <Shimmer className="text-[14px]">Dealing the campus deck…</Shimmer>
          <div className="mt-3 h-[470px] rounded-[14px] border border-line bg-inset shadow-card" />
        </div>
      )}

      {deck && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[430px_1fr]">
          {/* deck column */}
          <div>
            <div className="relative mx-auto h-[520px] w-full max-w-[430px]">
              {/* stack: render up to 3, deepest first so the front paints on top */}
              {[...visible.slice(0, 3)].reverse().map((profile, i, arr) => {
                const depth = arr.length - 1 - i;
                const isExiting = exiting?.id === profile.id;
                return (
                  <div
                    key={profile.id}
                    className="absolute inset-0"
                    style={
                      isExiting
                        ? {
                            zIndex: 20,
                            transform: `translateX(${exiting.dir * 150}%) rotate(${exiting.dir * 14}deg)`,
                            opacity: 0,
                            transition: "transform 320ms var(--ease-out-strong), opacity 300ms var(--ease-out-strong)",
                          }
                        : undefined
                    }
                  >
                    <TeammateCard profile={profile} depth={depth} />
                  </div>
                );
              })}

              {/* empty deck */}
              {queue.length === 0 && (
                <div
                  className="flex h-full flex-col items-center justify-center gap-4 rounded-[14px] border border-dashed border-line-strong bg-canvas p-8 text-center shadow-card"
                  style={{ animation: "fade-up 340ms var(--ease-out-strong) both" }}
                >
                  <span className="flex size-12 items-center justify-center rounded-[12px] bg-green-tint text-green">
                    <Icon size={24}><path d="M20 6 9 17l-5-5" /></Icon>
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">You&apos;ve met the whole deck</h3>
                    <p className="mt-1 text-[12.5px] text-ink-2">
                      Every profile in <code className="font-mono text-[11.5px] text-accent-ink">teammate_profiles.delta</code> has been reviewed.
                    </p>
                  </div>
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => {
                      fetch("/api/teammates", { method: "DELETE" }).then(loadDeck);
                    }}
                  >
                    Start over
                  </Button>
                </div>
              )}

              {/* match celebration */}
              {match && (
                <div
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-[14px] border border-line bg-surface p-8 text-center shadow-overlay"
                  style={{ animation: "pop-in 220ms cubic-bezier(0.23,1,0.32,1) both" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-14 items-center justify-center rounded-[12px] bg-accent-tint text-[18px] font-semibold text-accent-ink">You</span>
                    <span className="text-accent"><Icon size={20}><path d="M12 2.5 L14 9 l6.5 2 L14 13 l-2 6.5 L10 13 l-6.5 -2 L10 9 l2 -6.5 Z" /></Icon></span>
                    <span
                      className="flex size-14 items-center justify-center rounded-[12px] text-[18px] font-semibold"
                      style={{ ...hueFor(match.id), color: hueFor(match.id).color }}
                    >
                      {initialsFor(match.name)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-ink">It&apos;s a match!</h3>
                    <p className="mt-1 text-[12.5px] text-ink-2">
                      You and {match.name} both want a {match.seeking} crew. {match.contactHint}.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setMatch(null)}>Keep swiping</Button>
                </div>
              )}
            </div>

            {/* controls */}
            {queue.length > 0 && (
              <div className="mt-5 flex items-center justify-center gap-5">
                <button
                  type="button"
                  aria-label="Pass"
                  title="Pass (←)"
                  onClick={() => act(-1)}
                  className="flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-btn transition-transform duration-150 hover:bg-hover hover:text-red active:scale-[0.92]"
                >
                  <Icon size={19}><path d="M18 6 6 18M6 6l12 12" /></Icon>
                </button>
                <span className="text-[11px] font-medium text-ink-3 tabular-nums">
                  {deck.total - deck.reviewed} left · ← pass
                </span>
                <button
                  type="button"
                  aria-label="Connect"
                  title="Connect (→)"
                  onClick={() => act(1)}
                  className="flex size-12 items-center justify-center rounded-full bg-accent text-white shadow-btn transition-transform duration-150 hover:bg-accent-ink active:scale-[0.92]"
                >
                  <Icon size={19}><path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.5 2.9c0 5.7-8.5 11.2-8.5 11.2Z" /></Icon>
                </button>
              </div>
            )}
          </div>

          {/* side column */}
          <div className="space-y-4">
            <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card" style={{ animation: "fade-up 340ms var(--ease-out-strong) both" }}>
              <h3 className="mb-3 text-[14px] font-semibold text-ink">Your session</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Reviewed", value: deck.reviewed, icon: <><path d="M2 6.5S4.5 4 7 4s5 2.5 5 2.5S14.5 4 17 4s5 2.5 5 2.5V19s-2.5 1.5-5 1.5-5-2.5-5-2.5S9.5 20.5 7 20.5 2 19 2 19Z" /><path d="M7 5v15M17 5v15" /></> },
                  { label: "Connected", value: likedCount, icon: <path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.5 2.9c0 5.7-8.5 11.2-8.5 11.2Z" /> },
                  { label: "Matches", value: matchedCount, icon: <path d="M12 2.5 L14 9 l6.5 2 L14 13 l-2 6.5 L10 13 l-6.5 -2 L10 9 l2 -6.5 Z" /> },
                ].map((s, i) => (
                  <div key={s.label} className="rounded-[10px] border border-line-soft bg-inset p-3 text-center">
                    <span className="mx-auto mb-1.5 flex size-7 items-center justify-center rounded-[7px] bg-accent-tint text-accent-ink">
                      <Icon size={14}>{s.icon}</Icon>
                    </span>
                    <div className="text-[18px] font-semibold leading-none text-ink tabular-nums">{s.value}</div>
                    <div className="mt-1 text-[10.5px] font-medium text-ink-3">{s.label}</div>
                    <span className="sr-only">{i}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-ink-3 tabular-nums">
                  <span>Deck progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-inset">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${progress}%`, transitionTimingFunction: "var(--ease-out-strong)" }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[12px] border border-line bg-canvas p-4 shadow-card" style={{ animation: "fade-up 340ms var(--ease-out-strong) both", animationDelay: "80ms" }}>
              <h3 className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                <span className="text-accent-ink"><Icon size={15}><path d="M12 2.5 L14 9 l6.5 2 L14 13 l-2 6.5 L10 13 l-6.5 -2 L10 9 l2 -6.5 Z" /></Icon></span>
                How matching works
              </h3>
              <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-2">
                <li className="flex gap-2"><span className="mt-0.5 shrink-0 text-green"><Icon size={13}><path d="M20 6 9 17l-5-5" /></Icon></span>Cards show working-style metrics — collaboration, availability, skill depth, consistency — computed per student.</li>
                <li className="flex gap-2"><span className="mt-0.5 shrink-0 text-green"><Icon size={13}><path d="M20 6 9 17l-5-5" /></Icon></span>Connect when the stats complement yours; both sides saying connect becomes a match.</li>
                <li className="flex gap-2"><span className="mt-0.5 shrink-0 text-green"><Icon size={13}><path d="M20 6 9 17l-5-5" /></Icon></span>Swipes are stored per account in <code className="font-mono text-[11px] text-accent-ink">teammate_swipes.delta</code> — your deck resumes on any device.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
