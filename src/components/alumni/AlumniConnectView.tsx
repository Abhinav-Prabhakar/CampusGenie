"use client";

import { useEffect, useMemo, useState } from "react";
import RecordsTable, { type RecordRow } from "@/components/primitives/RecordsTable";
import { SegmentedControl } from "@/components/atoms/SegmentedControl";
import { Shimmer } from "@/components/atoms/Shimmer";
import { StatusPill } from "@/components/atoms/StatusPill";
import { Button } from "@/components/atoms/Button";

type AlumniApiRecord = {
  id: string;
  graduationYear: number;
  major: string;
  clubs: string[];
  labs: string[];
  firstJobTitle: string;
  firstCompany: string;
  currentRole: string;
  currentOrganization: string;
  domain: string;
  advice: string;
  displayName: string;
  availability: "strong" | "weak" | "veryweak" | "none";
};

type AlumniPayload = {
  alumni: AlumniApiRecord[];
  stats: { pathways: number; organizations: number; domains: string[]; openToMentorship: number };
};

/* short segment labels for the domain filter */
const DOMAIN_SHORT: Record<string, string> = {
  "Lakehouse AI & Model Serving": "AI",
  "Distributed Cloud Infrastructure": "Systems",
};

function shortDomain(domain: string): string {
  return DOMAIN_SHORT[domain] ?? domain.split(" ")[0];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toTableRows(alumni: AlumniApiRecord[]): RecordRow[] {
  return alumni.map((a) => ({
    id: a.id,
    name: a.displayName,
    tags: [a.domain, ...a.clubs.slice(0, 1), ...a.labs.slice(0, 1)].filter(Boolean),
    last: `Class of ${a.graduationYear}`,
    strength: a.availability,
    website: `linkedin.com/in/${slugify(a.displayName.split(" — ")[0])}`,
  }));
}

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: AlumniApiRecord[]): void {
  const header = [
    "Alumni ID", "Name", "Graduation Year", "Major", "Domain",
    "Clubs", "Labs", "First Job", "First Company",
    "Current Role", "Current Organization", "LinkedIn", "Advice",
  ];
  const lines = rows.map((a) =>
    [
      a.id,
      a.displayName,
      a.graduationYear,
      a.major,
      a.domain,
      a.clubs.join("; "),
      a.labs.join("; "),
      a.firstJobTitle,
      a.firstCompany,
      a.currentRole,
      a.currentOrganization,
      `linkedin.com/in/${slugify(a.displayName.split(" — ")[0])}`,
      a.advice,
    ]
      .map(csvCell)
      .join(",")
  );
  const blob = new Blob([`${header.join(",")}\n${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `alumni-connect-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* ── icon glyphs (2px rounded stroke, matches the app's inline set) ── */
function Icon({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const TINT = {
  accent: { color: "var(--accent)", bg: "var(--accent-tint)", border: "color-mix(in srgb, var(--accent) 26%, transparent)" },
  green: { color: "var(--green)", bg: "var(--green-tint)", border: "color-mix(in srgb, var(--green) 26%, transparent)" },
  orange: { color: "var(--orange)", bg: "var(--orange-tint)", border: "color-mix(in srgb, var(--orange) 26%, transparent)" },
  purple: { color: "oklch(0.66 0.17 300)", bg: "oklch(0.66 0.17 300 / 0.14)", border: "oklch(0.66 0.17 300 / 0.26)" },
} as const;

function StatCard({
  icon, value, label, tint, delay,
}: { icon: React.ReactNode; value: string; label: string; tint: keyof typeof TINT; delay: number }) {
  const t = TINT[tint];
  return (
    <div
      className="rounded-[12px] border border-line bg-canvas p-4 shadow-card"
      style={{ animation: "fade-up 340ms var(--ease-out-strong) both", animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border"
          style={{ color: t.color, background: t.bg, borderColor: t.border }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[21px] font-semibold leading-tight text-ink tabular-nums">{value}</div>
          <div className="truncate text-[11.5px] font-medium text-ink-3">{label}</div>
        </div>
      </div>
    </div>
  );
}

function AdviceCard({ alumni, delay }: { alumni: AlumniApiRecord; delay: number }) {
  return (
    <figure
      className="flex flex-col gap-3 rounded-[12px] border border-line bg-canvas p-4 shadow-card"
      style={{ animation: "fade-up 340ms var(--ease-out-strong) both", animationDelay: `${delay}ms` }}
    >
      <span className="flex size-7 items-center justify-center rounded-[7px] bg-accent-tint text-accent-ink">
        <Icon size={15}><path d="M10 8.5c-3 .5-4.5 2.5-4.5 6v1h4v-5" /><path d="M18.5 8.5c-3 .5-4.5 2.5-4.5 6v1h4v-5" /></Icon>
      </span>
      <blockquote className="text-[13px] leading-relaxed text-ink-2">“{alumni.advice}”</blockquote>
      <figcaption className="mt-auto flex items-center gap-2 pt-1 text-[11.5px] font-medium text-ink-3 tabular-nums">
        <Icon size={13}><path d="M22 9.5 12 4.5 2 9.5l10 5 10-5Z" /><path d="M6 11.8V16c3.2 2.6 8.8 2.6 12 0v-4.2" /></Icon>
        {alumni.currentRole} · {alumni.currentOrganization}
        <span className="ml-auto">{alumni.domain}</span>
      </figcaption>
    </figure>
  );
}

export default function AlumniConnectView() {
  const [payload, setPayload] = useState<AlumniPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<string>("All");

  // Request-intro dialog state
  const [introOpen, setIntroOpen] = useState<boolean>(false);
  const [introAlumniId, setIntroAlumniId] = useState<string>("");
  const [introNote, setIntroNote] = useState<string>("");
  const [introBusy, setIntroBusy] = useState<boolean>(false);
  const [introError, setIntroError] = useState<string | null>(null);
  const [introSuccessId, setIntroSuccessId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/alumni", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
        return res.json() as Promise<AlumniPayload>;
      })
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const alumni = useMemo(() => payload?.alumni ?? [], [payload]);
  const domainOptions = useMemo(
    () => ["All", ...Array.from(new Set(alumni.map((a) => shortDomain(a.domain))))],
    [alumni]
  );
  const filtered = useMemo(
    () => (domainFilter === "All" ? alumni : alumni.filter((a) => shortDomain(a.domain) === domainFilter)),
    [alumni, domainFilter]
  );
  const rows = useMemo(() => toTableRows(filtered), [filtered]);

  const openIntro = () => {
    setIntroError(null);
    setIntroSuccessId(null);
    setIntroNote("");
    setIntroAlumniId((prev) => prev || filtered[0]?.id || "");
    setIntroOpen(true);
  };

  const submitIntro = async () => {
    if (!introAlumniId || introBusy) return;
    setIntroBusy(true);
    setIntroError(null);
    try {
      const res = await fetch("/api/alumni/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumniId: introAlumniId, note: introNote.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setIntroSuccessId(String(data.requestId ?? ""));
      setRequestedIds((prev) => (prev.includes(introAlumniId) ? prev : [...prev, introAlumniId]));
    } catch (e: any) {
      setIntroError(e?.message || "Request failed — please try again.");
    } finally {
      setIntroBusy(false);
    }
  };

  const selectedIntroAlumni = filtered.find((a) => a.id === introAlumniId) ?? null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink">Alumni Connect</h2>
          <p className="text-[13px] text-ink-2">
            Career pathways &amp; mentorship live from the Lakehouse (
            <code className="font-mono text-xs text-accent-ink">workspace.campus_explorer.alumni_career_pathways</code>
            )
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Button variant="secondary" className="text-xs" onClick={() => downloadCsv(filtered)}>
            Export CSV
          </Button>
          <Button variant="primary" className="text-xs" onClick={openIntro}>
            Request intro
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-canvas p-4 shadow-card">
          <StatusPill tone="red">Lakehouse unavailable</StatusPill>
          <span className="text-[12.5px] text-ink-2">{error}</span>
        </div>
      )}

      {!payload && !error && (
        <div className="space-y-4">
          <Shimmer className="text-[14px]">Loading alumni pathways from Delta…</Shimmer>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] rounded-[12px] border border-line bg-inset shadow-card" />
            ))}
          </div>
        </div>
      )}

      {payload && (
        <>
          {/* stat strip */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              delay={0}
              tint="accent"
              icon={<Icon><path d="M22 9.5 12 4.5 2 9.5l10 5 10-5Z" /><path d="M6 11.8V16c3.2 2.6 8.8 2.6 12 0v-4.2" /></Icon>}
              value={String(payload.stats.pathways)}
              label="Pathways mapped"
            />
            <StatCard
              delay={60}
              tint="green"
              icon={<Icon><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M9 20.5v-4h6v4M8.5 8.5h2M13.5 8.5h2M8.5 12h2M13.5 12h2" /></Icon>}
              value={String(payload.stats.organizations)}
              label="Destination orgs"
            />
            <StatCard
              delay={120}
              tint="orange"
              icon={<Icon><path d="M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 21v-1.8a4 4 0 0 0-3-3.87M15.5 4.2a3.5 3.5 0 0 1 0 6.7" /></Icon>}
              value={String(payload.stats.openToMentorship)}
              label="Open to mentorship"
            />
            <StatCard
              delay={180}
              tint="purple"
              icon={<Icon><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></Icon>}
              value={String(payload.stats.domains.length)}
              label="Career domains"
            />
          </div>

          {/* filter + table */}
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl options={domainOptions} value={domainFilter} onChange={setDomainFilter} />
            <span className="text-[11.5px] font-medium text-ink-3 tabular-nums">
              {filtered.length} of {alumni.length} pathways
            </span>
          </div>

          <div className="rounded-[12px] border border-line bg-canvas p-1 shadow-card overflow-hidden">
            <RecordsTable rows={rows} />
          </div>

          {/* advice wall */}
          <div>
            <h3 className="mb-3 text-[14px] font-semibold text-ink">Pass-it-on advice</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {alumni.slice(0, 3).map((a, i) => (
                <AdviceCard key={a.id} alumni={a} delay={i * 70} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Request intro dialog */}
      {introOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-[14px] border border-line bg-canvas p-5 shadow-overlay space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-line-soft pb-3">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">Request an intro</h3>
                <p className="mt-0.5 text-[11.5px] text-ink-3">
                  The alumni office reviews requests and makes the email introduction.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIntroOpen(false)}
                aria-label="Close dialog"
                className="text-ink-3 transition-colors hover:text-ink"
              >
                ✕
              </button>
            </div>

            {introSuccessId ? (
              <div className="space-y-4 py-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-green-tint text-green">
                    <Icon size={15}><polyline points="20 6 9 17 4 12" /></Icon>
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">Request sent</p>
                    <p className="mt-0.5 text-[12px] text-ink-2 leading-relaxed">
                      Logged as <span className="font-mono text-accent-ink tabular-nums">{introSuccessId}</span> in{" "}
                      <code className="font-mono text-[11px] text-accent-ink">alumni_intro_requests</code>. You&apos;ll hear back from the alumni office by email.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end border-t border-line-soft pt-3">
                  <Button variant="primary" className="text-xs" onClick={() => setIntroOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label htmlFor="intro-alumni" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                    Alumnus
                  </label>
                  <select
                    id="intro-alumni"
                    value={introAlumniId}
                    onChange={(e) => setIntroAlumniId(e.target.value)}
                    className="h-8 w-full rounded-[8px] border border-line bg-field px-2 text-[12px] text-ink outline-none transition-colors duration-150 focus:border-line-strong"
                  >
                    {filtered.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName} · Class of {a.graduationYear}
                      </option>
                    ))}
                  </select>
                  {selectedIntroAlumni && (
                    <p className="mt-1.5 text-[11.5px] text-ink-3">
                      {selectedIntroAlumni.currentRole} · {selectedIntroAlumni.currentOrganization}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="intro-note" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                    Note to the alumni office <span className="text-ink-3">(optional)</span>
                  </label>
                  <textarea
                    id="intro-note"
                    rows={3}
                    maxLength={500}
                    value={introNote}
                    onChange={(e) => setIntroNote(e.target.value)}
                    placeholder="e.g., Seeking guidance on moving from systems into AI infrastructure roles…"
                    className="w-full resize-none rounded-[8px] border border-line bg-field p-2.5 text-[12.5px] text-ink placeholder:text-ink-3 outline-none transition-colors duration-150 focus:border-line-strong"
                  />
                </div>

                {introError && (
                  <div className="rounded-[8px] border border-red/30 bg-red-tint/20 px-3 py-2 text-[12px] text-red">
                    {introError}
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
                  <Button variant="ghost" className="text-xs" onClick={() => setIntroOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="text-xs" onClick={submitIntro} disabled={introBusy || !introAlumniId}>
                    {introBusy ? "Sending…" : requestedIds.includes(introAlumniId) ? "Send again" : "Send Request"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
