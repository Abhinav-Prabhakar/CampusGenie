"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Clock3,
  Database,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { CORE_QUESTION, type NavigatorResponse, type Opportunity } from "@/lib/opportunities";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type HealthState = {
  loading: boolean;
  ready: boolean;
  label: string;
  agent?: string;
};

const FOLLOW_UP = "Keep the AI focus, but show only free opportunities and prefer open recruitment over one-time events.";

function formatDate(value: string | null): string {
  if (!value) return "Time not returned";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatFreshness(value: string | null | undefined): string {
  if (!value) return "Not returned by query";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function downloadCalendar(opportunity: Opportunity) {
  const start = opportunity.startsAt ? new Date(opportunity.startsAt) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const end = validStart ? new Date(validStart.getTime() + 60 * 60 * 1000) : null;
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Campus Genie//Opportunity Navigator//EN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(opportunity.id)}@campus-genie`,
    `DTSTAMP:${stamp(new Date())}`,
    validStart ? `DTSTART:${stamp(validStart)}` : "",
    end ? `DTEND:${stamp(end)}` : "",
    `SUMMARY:${escapeIcs(opportunity.title)}`,
    opportunity.location ? `LOCATION:${escapeIcs(opportunity.location)}` : "",
    `DESCRIPTION:${escapeIcs(`Source: ${opportunity.sourceTables.join(", ") || "Not returned"}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const url = URL.createObjectURL(new Blob([lines], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${opportunity.id.toLowerCase()}-campus-opportunity.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CampusOpportunityNavigator() {
  const [prompt, setPrompt] = useState(CORE_QUESTION);
  const [response, setResponse] = useState<NavigatorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("Ready for your question");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [hasRefined, setHasRefined] = useState(false);
  const [pendingCalendar, setPendingCalendar] = useState<Opportunity | null>(null);
  const [calendarExported, setCalendarExported] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>({ loading: true, ready: false, label: "Checking Databricks" });

  useEffect(() => {
    fetch("/api/health/databricks", { cache: "no-store" })
      .then(async (result) => ({ ok: result.ok, body: await result.json() }))
      .then(({ ok, body }) => setHealth({
        loading: false,
        ready: ok && body.status === "ready",
        label: ok && body.status === "ready" ? "Databricks ready" : body.error?.message || "Databricks unavailable",
        agent: body.agent,
      }))
      .catch(() => setHealth({ loading: false, ready: false, label: "Databricks unavailable" }));
  }, []);

  const dataMode = useMemo(() => {
    if (health.loading) return { tone: "text-ink-3", dot: "bg-ink-3", label: "Checking live connection" };
    if (health.ready) return { tone: "text-green", dot: "bg-green", label: "Live Databricks" };
    return { tone: "text-red", dot: "bg-red", label: "Live data unavailable" };
  }, [health]);

  async function submitQuestion(nextPrompt: string, refinement = false) {
    const cleanPrompt = nextPrompt.trim();
    if (!cleanPrompt || isLoading) return;
    setIsLoading(true);
    setResponse(null);
    setPendingCalendar(null);
    setCalendarExported(null);
    setProgress("Contacting Genie Agent");
    const progressTimer = window.setTimeout(() => setProgress("Checking governed tables"), 900);
    try {
      const result = await fetch("/api/navigator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt, conversationId: refinement ? conversationId : undefined }),
      });
      setProgress("Matching eligibility");
      const body = await result.json() as NavigatorResponse;
      setResponse(body);
      if (body.conversationId) setConversationId(body.conversationId);
      if (refinement) setHasRefined(true);
    } catch {
      setResponse({
        ok: false,
        status: "unavailable",
        answer: "Campus Genie could not reach the server. No recommendation was generated.",
        opportunities: [],
        error: { code: "NETWORK_ERROR", message: "Check the connection and try again." },
      });
    } finally {
      window.clearTimeout(progressTimer);
      setIsLoading(false);
      setProgress("Ready for your question");
    }
  }

  return (
    <main className="min-h-[100dvh] bg-canvas text-ink selection:bg-accent-tint">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <div className="flex size-8 items-center justify-center rounded-[9px] bg-accent text-white shadow-sm" aria-hidden="true">
            <Sparkles size={16} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold">Campus Genie</p>
            <p className="truncate text-[10.5px] text-ink-3">Opportunity Navigator · BMSCE</p>
          </div>
          <div className={`ml-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium ${dataMode.tone}`} title={health.label}>
            <span className={`size-1.5 rounded-full ${dataMode.dot}`} />
            <span>{dataMode.label}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:py-8">
        <section className="min-w-0 space-y-5">
          <div className="border-b border-line pb-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-ink-3">
              <span>Third-year CSE</span><span aria-hidden="true">/</span><span>AI interests</span><span aria-hidden="true">/</span><span>Bengaluru</span>
            </div>
            <h1 className="max-w-3xl text-balance text-[clamp(28px,5vw,48px)] font-semibold leading-[1.04] tracking-[-0.04em]">
              Find one opportunity worth your Friday.
            </h1>
            <p className="mt-3 max-w-2xl text-pretty text-[14px] leading-6 text-ink-2">
              Ask with your time, budget, interests, eligibility, and travel limit. Genie checks governed campus data and shows the evidence behind every result.
            </p>
          </div>

          <form
            onSubmit={(event) => { event.preventDefault(); submitQuestion(prompt); }}
            className="rounded-[14px] border border-line-strong bg-surface p-3 shadow-card focus-within:ring-2 focus-within:ring-accent/40"
          >
            <label htmlFor="navigator-question" className="sr-only">Campus opportunity question</label>
            <textarea
              id="navigator-question"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              maxLength={1200}
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-1 py-1 text-[14px] leading-6 text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
              placeholder="Describe the opportunity you need…"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-3">
              <div className="flex items-center gap-2 text-[11px] text-ink-3" role="status" aria-live="polite">
                <Database size={13} />
                <span>{isLoading ? progress : "Databricks Genie Agent is the only answer path"}</span>
              </div>
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-accent px-4 text-[12.5px] font-semibold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <Search size={14} />
                {isLoading ? "Checking opportunities" : "Ask Genie"}
              </button>
            </div>
          </form>

          {!response && !isLoading && (
            <div className="grid gap-2 sm:grid-cols-2">
              {[CORE_QUESTION, "Find active AI clubs or research labs with open recruitment and under 5 hours per week."].map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => { setPrompt(question); submitQuestion(question); }}
                  className="rounded-[11px] border border-line bg-surface p-3 text-left text-[12.5px] leading-5 text-ink-2 hover:border-line-strong hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-3 border-y border-line py-5" role="status" aria-live="polite">
              <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
              <div>
                <p className="text-[13px] font-medium">{progress}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-3">No internal reasoning or tool logs are shown.</p>
              </div>
            </div>
          )}

          {response && (
            <div className="space-y-5" aria-live="polite">
              <section className={`rounded-[12px] border p-4 ${response.status === "unavailable" ? "border-red/35 bg-red-tint" : response.status === "no_results" || response.status === "out_of_scope" ? "border-orange/35 bg-orange-tint" : "border-line bg-surface"}`}>
                <div className="mb-2 flex items-center gap-2">
                  {response.ok ? <ShieldCheck size={15} className="text-green" /> : <X size={15} className="text-red" />}
                  <h2 className="text-[13px] font-semibold">{response.status === "unavailable" ? "Databricks unavailable" : response.status === "no_results" ? "No matching rows" : response.status === "out_of_scope" ? "Outside navigator scope" : "Genie answer"}</h2>
                </div>
                <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-ink-2">{response.answer}</p>
                {response.error && <p className="mt-3 text-[11.5px] text-red">{response.error.message}</p>}
              </section>

              {response.opportunities.length > 0 && (
                <section aria-labelledby="recommended-opportunities">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 id="recommended-opportunities" className="text-[14px] font-semibold">Recommended opportunities</h2>
                    <span className="text-[11px] text-ink-3">{response.opportunities.length} rendered from Genie rows</span>
                  </div>
                  <div className="space-y-3">
                    {response.opportunities.map((opportunity, index) => (
                      <article key={`${opportunity.id}-${index}`} className="rounded-[13px] border border-line bg-surface p-4 shadow-card">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10.5px] font-semibold text-accent-ink">{index === 0 ? "Top result" : opportunity.type}</span>
                              {opportunity.synthetic && <span className="rounded-full bg-orange-tint px-2 py-0.5 text-[10.5px] font-semibold text-orange">Synthetic dataset</span>}
                              <span className="text-[10.5px] text-ink-3">{opportunity.id}</span>
                            </div>
                            <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.02em]">{opportunity.title}</h3>
                            {opportunity.host && <p className="mt-1 text-[12px] text-ink-3">Hosted by {opportunity.host}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPendingCalendar(opportunity)}
                            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-line-strong bg-canvas px-3 text-[11.5px] font-semibold hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <CalendarPlus size={13} /> Prepare calendar export
                          </button>
                        </div>

                        <dl className="mt-4 grid gap-2 border-y border-line-soft py-3 text-[11.5px] sm:grid-cols-2">
                          <div className="flex gap-2"><Clock3 size={14} className="mt-0.5 shrink-0 text-ink-3" /><div><dt className="text-ink-3">Date & time</dt><dd className="mt-0.5 text-ink">{formatDate(opportunity.startsAt)}{opportunity.schedule ? ` · ${opportunity.schedule}` : ""}</dd></div></div>
                          <div className="flex gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-ink-3" /><div><dt className="text-ink-3">Location & travel</dt><dd className="mt-0.5 text-ink">{opportunity.location || "Location not returned"}{opportunity.commuteMinutes !== null ? ` · ${opportunity.commuteMinutes} min` : " · commute not returned"}</dd></div></div>
                          <div><dt className="text-ink-3">Fee</dt><dd className="mt-0.5 text-ink">{opportunity.feeInr === null ? "Not returned" : opportunity.feeInr === 0 ? "Free" : `₹${opportunity.feeInr}`}</dd></div>
                          <div><dt className="text-ink-3">Eligibility / recruitment</dt><dd className="mt-0.5 text-ink">{[opportunity.eligibility, opportunity.recruitmentStatus].filter(Boolean).join(" · ") || "Not returned"}</dd></div>
                        </dl>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Why it matches</p>
                            {opportunity.whyMatch.length > 0 ? (
                              <ul className="mt-2 space-y-1.5 text-[11.5px] text-ink-2">
                                {opportunity.whyMatch.map((reason) => <li key={reason} className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-green" />{reason}</li>)}
                              </ul>
                            ) : <p className="mt-2 text-[11.5px] text-orange">Constraint fields were not fully returned.</p>}
                          </div>
                          <div className="text-[11.5px] text-ink-2">
                            <p><span className="text-ink-3">Match confidence:</span> {opportunity.matchExplanation}</p>
                            <p className="mt-2"><span className="text-ink-3">Source:</span> {opportunity.sourceTables.join(", ") || "Not returned"}</p>
                            <p className="mt-1"><span className="text-ink-3">Last updated:</span> {formatFreshness(opportunity.lastUpdated)}</p>
                            {opportunity.sourceUrl && <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-accent-ink hover:underline">Open source record <ExternalLink size={11} /></a>}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {response.ok && response.status !== "out_of_scope" && !hasRefined && (
                <section className="border-t border-line pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-[13px] font-semibold">Refine once</h2>
                      <p className="mt-1 text-[11.5px] text-ink-3">Keep the same Genie conversation and tighten one trade-off.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPrompt(FOLLOW_UP); submitQuestion(FOLLOW_UP, true); }}
                      className="rounded-[9px] border border-line bg-surface px-3 py-2 text-left text-[11.5px] leading-5 text-ink-2 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {FOLLOW_UP}
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label="Evidence and product scope">
          <section className="rounded-[12px] border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-accent-ink" />
              <h2 className="text-[12.5px] font-semibold">Evidence</h2>
            </div>
            <dl className="mt-3 space-y-3 text-[11.5px]">
              <div><dt className="text-ink-3">Genie Agent used</dt><dd className="mt-0.5 text-ink">{response?.evidence?.agentName || health.agent || "Campus Opportunity Navigator"}</dd></div>
              <div><dt className="text-ink-3">Governed tables used</dt><dd className="mt-0.5 text-ink">{response?.evidence?.tables.length ? response.evidence.tables.join(", ") : "No completed query yet"}</dd></div>
              <div className="grid grid-cols-2 gap-3"><div><dt className="text-ink-3">Rows returned</dt><dd className="mt-0.5 text-ink">{response?.evidence?.rowsReturned ?? "—"}</dd></div><div><dt className="text-ink-3">Freshness</dt><dd className="mt-0.5 text-ink">{formatFreshness(response?.evidence?.freshness)}</dd></div></div>
            </dl>
            {response?.evidence?.sql.length ? (
              <details className="mt-3 border-t border-line-soft pt-3">
                <summary className="cursor-pointer text-[11.5px] font-medium text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Generated SQL</summary>
                <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-[8px] bg-inset p-2.5 text-[10.5px] leading-5 text-ink-2">{response.evidence.sql.join("\n\n")}</pre>
              </details>
            ) : null}
          </section>

          <section className="border-y border-line py-4 text-[11.5px] text-ink-2">
            <h2 className="text-[12px] font-semibold text-ink">What this product does</h2>
            <p className="mt-2 leading-5">Compares campus and Bengaluru opportunities for one student profile. It does not answer general questions or silently fall back to another model.</p>
          </section>

          <section className="text-[10.5px] leading-5 text-ink-3">
            <p>Live records may be synthetic for hackathon demonstration. Each returned row is labeled when the dataset says it is synthetic.</p>
          </section>
        </aside>
      </div>

      {pendingCalendar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="calendar-confirmation-title">
          <div className="w-full max-w-md rounded-[14px] border border-line-strong bg-canvas p-5 shadow-overlay">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-accent-ink">Approval required</p>
                <h2 id="calendar-confirmation-title" className="mt-1 text-[16px] font-semibold">Export this opportunity?</h2>
              </div>
              <button type="button" onClick={() => setPendingCalendar(null)} className="flex size-8 items-center justify-center rounded-[8px] text-ink-3 hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Cancel calendar export"><X size={15} /></button>
            </div>
            <div className="mt-4 rounded-[10px] border border-line bg-surface p-3">
              <p className="text-[13px] font-medium">{pendingCalendar.title}</p>
              <p className="mt-1 text-[11.5px] text-ink-3">{formatDate(pendingCalendar.startsAt)} · {pendingCalendar.location || "Location not returned"}</p>
            </div>
            <p className="mt-3 text-[11.5px] leading-5 text-ink-2">This downloads an `.ics` file. It does not RSVP, write to Databricks, or modify your calendar automatically.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingCalendar(null)} className="h-9 rounded-[8px] border border-line px-3 text-[12px] font-medium hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Cancel</button>
              <button type="button" onClick={() => { downloadCalendar(pendingCalendar); setCalendarExported(pendingCalendar.id); setPendingCalendar(null); }} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-accent px-3 text-[12px] font-semibold text-white hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Check size={14} />Confirm calendar export</button>
            </div>
          </div>
        </div>
      )}

      {calendarExported && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-line bg-surface px-3 py-2 text-[11.5px] text-ink shadow-overlay" role="status">
          Calendar file downloaded for {calendarExported}.
        </div>
      )}
    </main>
  );
}
