"use client";

import { useState } from "react";
import SidebarNav from "@/components/primitives/SidebarNav";
import KeyboardShortcutsModal from "@/components/shortcuts/KeyboardShortcutsModal";
import EventIcons from "@/components/events/EventIcons";
import { useTheme } from "@/lib/theme";

export default function AttendancePage() {
  const { isDark, toggleTheme } = useTheme();
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Interactive States
  const [isAlertDismissed, setIsAlertDismissed] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<"heatmap" | "trend">("heatmap");
  const [checkInEng, setCheckInEng] = useState<boolean>(false);
  const [remindCs, setRemindCs] = useState<boolean>(false);

  // Filter Chips State
  const [filterPresent, setFilterPresent] = useState<boolean>(true);
  const [filterLate, setFilterLate] = useState<boolean>(true);
  const [filterAbsent, setFilterAbsent] = useState<boolean>(true);
  const [filterScheduled, setFilterScheduled] = useState<boolean>(true);

  const handleResetFilters = () => {
    setFilterPresent(true);
    setFilterLate(true);
    setFilterAbsent(true);
    setFilterScheduled(true);
    setActiveView("heatmap");
  };

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      <SidebarNav
        fill
        className="hidden lg:flex"
        activeTitle="Attendance Tracker"
        activeNav="attendance"
        footerLabel="Campus Genie v1.0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          {/* Header */}
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-surface">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                <span className="text-accent">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
                    <path d="M8 2.5v4M16 2.5v4M3 10h18M9 15.5l2 2 4-4.5" />
                  </svg>
                </span>
                <span>Attendance Tracker</span>
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-line bg-inset px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-ink-3">
                SPRING · WEEK 7/14
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                title="Keyboard Shortcuts (⌘K)"
                className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-canvas text-ink-2 hover:bg-hover hover:text-ink transition-colors duration-100"
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

              <span className="flex size-6.5 items-center justify-center rounded-full border border-line bg-field text-[10px] font-semibold text-ink-2">
                AK
              </span>
            </div>
          </header>

          {/* Body content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-canvas">
            {/* ── risk alert (dismissible) ───────────────────── */}
            {!isAlertDismissed ? (
              <div className="relative flex items-center justify-between gap-3 flex-wrap rounded-[12px] border border-orange/35 bg-orange-tint/20 p-3.5 shadow-sm animate-fade-in">
                <button
                  type="button"
                  onClick={() => setIsAlertDismissed(true)}
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-[6px] text-ink-3 hover:bg-hover hover:text-ink transition-colors"
                  title="Dismiss warning"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>

                <div className="flex items-start gap-3 min-w-[260px] flex-1 pr-6">
                  <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border border-orange/40 bg-orange-tint text-orange">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-[13.5px] font-semibold text-ink">MATH 201 · Linear Algebra</b>
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-tint px-2 py-0.5 text-[10.5px] font-medium text-red">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                        At risk
                      </span>
                      <span className="text-[12px] text-ink-2">exam eligibility</span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-ink-2 leading-relaxed">
                      Attendance is <b className="text-red font-semibold tabular-nums">70%</b> — below the <b className="font-semibold text-ink">75%</b> cutoff. Attend <b className="text-ink tabular-nums">18 of the remaining 22</b> sessions to restore eligibility.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 w-40 shrink-0">
                  <div className="relative h-1.5 w-full rounded-full bg-line overflow-hidden">
                    <div className="absolute top-0 bottom-0 left-0 bg-red rounded-full" style={{ width: "70%" }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: "75%" }} />
                  </div>
                  <div className="flex justify-between text-[10.5px] font-medium tabular-nums">
                    <span className="text-red font-semibold">70% now</span>
                    <span className="text-ink-3">75% cutoff</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" className="inline-flex h-7.5 items-center gap-1.5 rounded-[8px] bg-accent px-3 text-[12px] font-medium text-white shadow-sm hover:brightness-105 transition-all">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>
                    Recovery plan
                  </button>
                  <button type="button" className="inline-flex h-7.5 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 text-[12px] font-medium text-ink-2 hover:bg-hover hover:text-ink transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
                    Remind me
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAlertDismissed(false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-3 hover:text-ink hover:bg-hover transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                MATH 201 warning hidden — restore
              </button>
            )}

            {/* ── stats strip ────────────────────────────────── */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" aria-label="Attendance summary">
              {/* Overall */}
              <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3 shadow-card">
                <div className="relative size-11 shrink-0 flex items-center justify-center">
                  <svg className="size-11 -rotate-90" viewBox="0 0 36 36">
                    <circle className="text-line" strokeWidth="3.6" stroke="currentColor" fill="none" cx="18" cy="18" r="15.92" />
                    <circle
                      className="text-accent"
                      strokeWidth="3.6"
                      strokeDasharray="100"
                      strokeDashoffset={checkInEng ? "14" : "14"}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      cx="18"
                      cy="18"
                      r="15.92"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[11.5px] font-semibold text-ink tabular-nums">
                    {checkInEng ? "86" : "86"}<small className="text-[8px] text-ink-3">%</small>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Overall</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <b className="text-[18px] font-semibold text-ink tabular-nums">{checkInEng ? "86%" : "86%"}</b>
                    <span className="text-[11.5px] text-ink-3 tabular-nums">{checkInEng ? "57 / 65" : "56 / 65"} sessions</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-3">
                    <span className="inline-flex items-center rounded-full bg-green-tint px-1.5 py-0.2 text-[10px] font-medium text-green tabular-nums">
                      +4.2 pts
                    </span>
                    vs winter term
                  </div>
                </div>
              </div>

              {/* Attended */}
              <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3 shadow-card">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-green-tint text-green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6L9 17l-5-5"/></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Attended</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <b className="text-[18px] font-semibold text-ink tabular-nums">{checkInEng ? "57" : "56"}</b>
                    <span className="text-[11.5px] text-ink-3 tabular-nums">of 65 to date</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-ink-3">
                    <span className="flex items-end gap-0.5 h-3.5">
                      <i className="w-1 rounded-sm bg-accent/70 h-[90%]" />
                      <i className="w-1 rounded-sm bg-accent/70 h-[90%]" />
                      <i className="w-1 rounded-sm bg-accent/70 h-[80%]" />
                      <i className="w-1 rounded-sm bg-accent/70 h-[90%]" />
                      <i className="w-1 rounded-sm bg-accent/70 h-[80%]" />
                      <i className="w-1 rounded-sm bg-accent/70 h-[80%]" />
                      <i className="w-1 rounded-sm bg-accent/70 h-[75%]" />
                    </span>
                    weekly rate
                  </div>
                </div>
              </div>

              {/* Streak */}
              <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3 shadow-card">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-accent-tint text-accent">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 4.5 13.5H11L9.5 22 18 10.5h-6.5L13 2Z"/></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Streak</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <b className="text-[18px] font-semibold text-ink tabular-nums">9</b>
                    <span className="text-[11.5px] text-ink-3">school days</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-3">
                    <span className="inline-flex items-center rounded-full bg-green-tint px-1.5 py-0.2 text-[10px] font-medium text-green tabular-nums">
                      best 21
                    </span>
                    since Mar 10
                  </div>
                </div>
              </div>

              {/* Missed */}
              <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3 shadow-card">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-red-tint text-red">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Missed</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <b className="text-[18px] font-semibold text-ink tabular-nums">9</b>
                    <span className="text-[11.5px] text-ink-3">sessions</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-3">
                    <span className="text-red font-medium tabular-nums">6 in MATH 201</span>
                  </div>
                </div>
              </div>

              {/* At risk */}
              <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3 shadow-card">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-orange-tint text-orange">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">At risk</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <b className="text-[18px] font-semibold text-orange tabular-nums">1</b>
                    <span className="text-[11.5px] text-ink-3">of 5 courses</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-accent hover:underline cursor-pointer">
                    MATH 201 · 70%
                  </div>
                </div>
              </div>
            </section>

            {/* ── today check-ins ────────────────────────────── */}
            <section className="rounded-[12px] border border-line bg-surface shadow-card overflow-hidden" aria-label="Today's check-ins">
              <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5 bg-surface">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-accent">
                    <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
                    <path d="M8 2.5v4M16 2.5v4M3 10h18M9 15.5l2 2 4-4.5" />
                  </svg>
                  <div>
                    <h2 className="text-[13.5px] font-semibold text-ink">Today · Wed, Mar 19</h2>
                    <span className="text-[11.5px] text-ink-3 font-mono tabular-nums">3 scheduled · {checkInEng ? "3" : "2"} tracked</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-[11px] font-medium text-green">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    {checkInEng ? "3 of 3 done" : "2 of 3 done"}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-line bg-inset px-2 py-0.5 text-[11px] font-medium text-ink-3">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 4.5 13.5H11L9.5 22 18 10.5h-6.5L13 2Z"/></svg>
                    9-day streak on the line
                  </span>
                </div>
              </div>

              <ul className="divide-y divide-line p-1">
                {/* MATH 201 */}
                <li className="flex items-center justify-between gap-3 p-2.5 rounded-[8px] hover:bg-hover transition-colors">
                  <span className="w-12 shrink-0 font-mono text-[12px] font-medium text-ink-2 tabular-nums">09:00</span>
                  <span className="flex size-7.5 shrink-0 items-center justify-center rounded-[8px] border border-line bg-inset text-[10px] font-semibold text-accent">
                    MA
                  </span>
                  <div className="flex-1 min-w-0">
                    <b className="block text-[13px] font-semibold text-ink truncate">MATH 201 · Linear Algebra</b>
                    <span className="text-[11.5px] text-ink-3">Hart 112 · 50 min</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-[10.5px] font-medium text-green">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      Attended
                    </span>
                    <button type="button" className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-green-tint px-2.5 text-[11.5px] font-medium text-green">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      Done
                    </button>
                  </div>
                </li>

                {/* ENG 105 */}
                <li className="flex items-center justify-between gap-3 p-2.5 rounded-[8px] hover:bg-hover transition-colors">
                  <span className="w-12 shrink-0 font-mono text-[12px] font-medium text-ink-2 tabular-nums">13:00</span>
                  <span className="flex size-7.5 shrink-0 items-center justify-center rounded-[8px] border border-line bg-inset text-[10px] font-semibold text-orange">
                    EN
                  </span>
                  <div className="flex-1 min-w-0">
                    <b className="block text-[13px] font-semibold text-ink truncate">ENG 105 · Composition</b>
                    <span className="text-[11.5px] text-ink-3">Olson 24 · 80 min</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!checkInEng ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint px-2 py-0.5 text-[10.5px] font-medium text-accent">
                          <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                          Next · in 25 min
                        </span>
                        <button
                          type="button"
                          onClick={() => setCheckInEng(true)}
                          className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-accent px-3 text-[11.5px] font-medium text-white shadow-sm hover:brightness-105 transition-all"
                        >
                          Check in
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-[10.5px] font-medium text-green">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                          Checked In
                        </span>
                        <button
                          type="button"
                          onClick={() => setCheckInEng(false)}
                          className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-green-tint px-2.5 text-[11.5px] font-medium text-green"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                          Done
                        </button>
                      </>
                    )}
                  </div>
                </li>

                {/* CS 210 */}
                <li className="flex items-center justify-between gap-3 p-2.5 rounded-[8px] hover:bg-hover transition-colors">
                  <span className="w-12 shrink-0 font-mono text-[12px] font-medium text-ink-2 tabular-nums">16:00</span>
                  <span className="flex size-7.5 shrink-0 items-center justify-center rounded-[8px] border border-line bg-inset text-[10px] font-semibold text-accent">
                    CS
                  </span>
                  <div className="flex-1 min-w-0">
                    <b className="block text-[13px] font-semibold text-ink truncate">CS 210 · Office hours</b>
                    <span className="text-[11.5px] text-ink-3">Kemper 210 · drop-in</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center rounded-full border border-line bg-inset px-2 py-0.5 text-[10.5px] font-medium text-ink-3">
                      Optional
                    </span>
                    <button
                      type="button"
                      onClick={() => setRemindCs(!remindCs)}
                      className={`inline-flex h-7 items-center gap-1 rounded-[7px] border border-line px-2.5 text-[11.5px] font-medium transition-colors ${
                        remindCs ? "bg-accent-tint text-accent border-accent/40" : "bg-surface text-ink-2 hover:bg-hover hover:text-ink"
                      }`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
                      {remindCs ? "Reminder set" : "Remind me"}
                    </button>
                  </div>
                </li>
              </ul>
            </section>

            {/* ── toolbar: view switch + state chips ─────────── */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 rounded-[8px] border border-line bg-field p-0.5 shadow-hairline">
                  <button
                    type="button"
                    onClick={() => setActiveView("heatmap")}
                    className={`flex items-center gap-1.5 rounded-[6px] px-3 text-[12px] font-medium transition-colors ${
                      activeView === "heatmap" ? "bg-surface text-ink shadow-hairline" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>
                    Heatmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("trend")}
                    className={`flex items-center gap-1.5 rounded-[6px] px-3 text-[12px] font-medium transition-colors ${
                      activeView === "trend" ? "bg-surface text-ink shadow-hairline" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-4"/></svg>
                    Weekly trend
                  </button>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1 text-[11.5px] text-ink-3">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>
                  live · attendance.delta
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterPresent(!filterPresent)}
                  className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors ${
                    filterPresent ? "border-accent/40 bg-accent-tint text-accent" : "border-line bg-surface text-ink-3"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  Present <b className="font-mono text-[10.5px]">49</b>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterLate(!filterLate)}
                  className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors ${
                    filterLate ? "border-orange/40 bg-orange-tint text-orange" : "border-line bg-surface text-ink-3"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
                  Late <b className="font-mono text-[10.5px]">6</b>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterAbsent(!filterAbsent)}
                  className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors ${
                    filterAbsent ? "border-red/40 bg-red-tint text-red" : "border-line bg-surface text-ink-3"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  Absent <b className="font-mono text-[10.5px]">9</b>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterScheduled(!filterScheduled)}
                  className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors ${
                    filterScheduled ? "border-line-strong bg-inset text-ink-2" : "border-line bg-surface text-ink-3"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>
                  Scheduled <b className="font-mono text-[10.5px]">74</b>
                </button>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex h-6.5 items-center gap-1 rounded-[6px] px-2 text-[11.5px] font-medium text-ink-3 hover:text-ink hover:bg-hover transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/></svg>
                  Reset
                </button>
              </div>
            </div>

            {/* ── hero: term heatmap + weekday pattern ───────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-3">
              {/* Term Heatmap Card */}
              <section className="rounded-[12px] border border-line bg-surface shadow-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-accent">
                      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>
                    </svg>
                    <div>
                      <h2 className="text-[13.5px] font-semibold text-ink">Term heatmap</h2>
                      <span className="text-[11.5px] text-ink-3 font-mono">Feb 3 – May 9 · weeks 1–14 · class days only</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-[10.5px] font-medium text-green">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 4.5 13.5H11L9.5 22 18 10.5h-6.5L13 2Z"/></svg>
                      9-day streak
                    </span>
                    <span className="hidden sm:inline-flex items-center rounded-full border border-line bg-inset px-2 py-0.5 text-[10.5px] font-medium text-ink-3">
                      This week 5/5
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto p-3.5">
                  <div className="grid grid-cols-[18px_auto] gap-x-2 gap-y-1 w-max">
                    <div className="col-start-2 grid grid-cols-14 gap-1 font-mono text-[9.5px] font-medium text-ink-3">
                      <span className="col-span-4">FEB</span>
                      <span className="col-span-5">MAR</span>
                      <span className="col-span-5">APR</span>
                    </div>
                    <div className="grid grid-rows-5 gap-1 font-mono text-[9px] font-medium text-ink-3">
                      <span className="flex items-center h-6">M</span>
                      <span className="flex items-center h-6">T</span>
                      <span className="flex items-center h-6">W</span>
                      <span className="flex items-center h-6">T</span>
                      <span className="flex items-center h-6">F</span>
                    </div>
                    <div className="grid grid-rows-5 grid-flow-col auto-cols-[24px] gap-1">
                      {/* W1 */}
                      <span title="Mon · Feb 3 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Tue · Feb 4 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Wed · Feb 5 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Thu · Feb 6 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Fri · Feb 7 — 1/2 · 50%" className={`size-6 rounded-[5px] bg-accent/40 transition-transform hover:scale-125 ${!filterLate ? "opacity-20" : ""}`} />
                      {/* W2 */}
                      <span title="Mon · Feb 10 — 1/2 · 50%" className={`size-6 rounded-[5px] bg-accent/40 transition-transform hover:scale-125 ${!filterLate ? "opacity-20" : ""}`} />
                      <span title="Tue · Feb 11 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Wed · Feb 12 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Thu · Feb 13 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Fri · Feb 14 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      {/* W3 */}
                      <span title="Mon · Feb 17 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Tue · Feb 18 — 1/2 · 50%" className={`size-6 rounded-[5px] bg-accent/40 transition-transform hover:scale-125 ${!filterLate ? "opacity-20" : ""}`} />
                      <span title="Wed · Feb 19 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Thu · Feb 20 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Fri · Feb 21 — 1/2 · 50%" className={`size-6 rounded-[5px] bg-accent/40 transition-transform hover:scale-125 ${!filterLate ? "opacity-20" : ""}`} />
                      {/* W4 */}
                      <span title="Mon · Feb 24 — 1/2 · 50%" className={`size-6 rounded-[5px] bg-accent/40 transition-transform hover:scale-125 ${!filterLate ? "opacity-20" : ""}`} />
                      <span title="Tue · Feb 25 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Wed · Feb 26 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Thu · Feb 27 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Fri · Feb 28 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      {/* W5 */}
                      <span title="Mon · Mar 3 — 1/2 · 50%" className={`size-6 rounded-[5px] bg-accent/40 transition-transform hover:scale-125 ${!filterLate ? "opacity-20" : ""}`} />
                      <span title="Tue · Mar 4 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Wed · Mar 5 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Thu · Mar 6 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Fri · Mar 7 — 1/2 · 50%" className={`size-6 rounded-[5px] bg-accent/40 transition-transform hover:scale-125 ${!filterLate ? "opacity-20" : ""}`} />
                      {/* W6 */}
                      <span title="Mon · Mar 10 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Tue · Mar 11 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Wed · Mar 12 — 0/2 · missed both" className={`size-6 rounded-[5px] bg-red/70 transition-transform hover:scale-125 ${!filterAbsent ? "opacity-20" : ""}`} />
                      <span title="Thu · Mar 13 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Fri · Mar 14 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      {/* W7 (Current) */}
                      <span title="Mon · Mar 17 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Tue · Mar 18 — 2/2 · 100%" className={`size-6 rounded-[5px] bg-accent/80 transition-transform hover:scale-125 ${!filterPresent ? "opacity-20" : ""}`} />
                      <span title="Wed · Mar 19 — today" className="size-6 rounded-[5px] bg-accent-tint border-2 border-accent transition-transform hover:scale-125 animate-pulse" />
                      <span title="Thu · Mar 20 — scheduled" className={`size-6 rounded-[5px] border border-line bg-transparent ${!filterScheduled ? "opacity-20" : ""}`} />
                      <span title="Fri · Mar 21 — scheduled" className={`size-6 rounded-[5px] border border-line bg-transparent ${!filterScheduled ? "opacity-20" : ""}`} />
                      {/* W8-14 (Scheduled) */}
                      {Array.from({ length: 35 }).map((_, idx) => (
                        <span key={idx} title="Scheduled" className={`size-6 rounded-[5px] border border-line/60 bg-transparent ${!filterScheduled ? "opacity-20" : ""}`} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[11.5px] text-ink-3">
                  <div className="flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green"><path d="M20 6L9 17l-5-5"/></svg>
                    <span><b className="text-ink-2 font-semibold tabular-nums">56</b> of 65 sessions recorded</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-accent/80" /> Full day</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-accent/40" /> Partial</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-red/70" /> Missed</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] border border-accent bg-accent-tint" /> Today</span>
                  </div>
                </div>
              </section>

              {/* Weekday Pattern Card */}
              <section className="rounded-[12px] border border-line bg-surface shadow-card overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-accent">
                      <path d="M18 20V10M12 20V4M6 20v-4"/>
                    </svg>
                    <div>
                      <h2 className="text-[13.5px] font-semibold text-ink">Weekday pattern</h2>
                      <span className="text-[11.5px] text-ink-3">attendance rate by day, to date</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-around gap-2 px-4 py-4 h-36">
                  {/* Mon */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-orange/70" style={{ height: "79%" }} title="Mon — 11/14 sessions (79%)" />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">MON</span>
                      <span className="font-mono text-[10px] text-orange tabular-nums">79%</span>
                    </div>
                  </div>

                  {/* Tue */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-accent/70" style={{ height: "93%" }} title="Tue — 13/14 sessions (93%)" />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">TUE</span>
                      <span className="font-mono text-[10px] text-ink-3 tabular-nums">93%</span>
                    </div>
                  </div>

                  {/* Wed */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-accent/70" style={{ height: "86%" }} title="Wed — 12/14 sessions (86%)" />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">WED</span>
                      <span className="font-mono text-[10px] text-ink-3 tabular-nums">86%</span>
                    </div>
                  </div>

                  {/* Thu */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-green/80" style={{ height: "100%" }} title="Thu — 12/12 sessions (100%)" />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">THU</span>
                      <span className="font-mono text-[10px] text-green tabular-nums">100%</span>
                    </div>
                  </div>

                  {/* Fri */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-orange/80" style={{ height: "75%" }} title="Fri — 9/12 sessions (75%)" />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">FRI</span>
                      <span className="font-mono text-[10px] text-orange tabular-nums">75%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[11px] text-ink-3">
                  <span className="truncate">Friday slump — 4 of 6 MATH absences</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-green font-medium">Best THU 100%</span>
                    <span className="text-orange font-medium">Worst FRI 75%</span>
                  </div>
                </div>
              </section>
            </div>

            {/* ── per-subject grids ──────────────────────────── */}
            <div className="pt-2">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[15px] font-semibold text-ink">By subject</h2>
                <span className="text-[11.5px] text-ink-3 font-mono">5 courses · 65 sessions to date · 74 scheduled</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* CS 210 */}
                <article className="flex flex-col justify-between rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border border-accent/30 bg-accent-tint text-[11px] font-semibold text-accent">
                          CS
                        </span>
                        <div>
                          <h3 className="text-[13.5px] font-semibold text-ink truncate">Data Structures &amp; Algorithms</h3>
                          <span className="text-[11.5px] text-ink-3">Tue + Thu · 10:30</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[16px] font-semibold text-ink tabular-nums">92%</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-1.5 py-0.2 text-[9.5px] font-medium text-green">On track</span>
                      </div>
                    </div>

                    {activeView === "heatmap" ? (
                      <div className="grid grid-rows-2 grid-flow-col auto-cols-[13px] gap-1 py-1 overflow-x-auto">
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-orange/80" title="Late 8 min" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs border border-line bg-transparent" title="Scheduled" />
                      </div>
                    ) : (
                      <div className="flex items-end gap-1 h-10 border-b border-line/50 pb-1">
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-red/70 rounded-xs h-1/2" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-3 text-[11.5px] text-ink-3">
                    <span className="text-ink-2 font-medium">Prof. Reyes</span>
                    <div className="flex items-center gap-2 font-mono font-medium">
                      <span className="text-green">✓ 11</span>
                      <span className="text-orange">⏱ 1</span>
                      <span className="text-red">✕ 1</span>
                    </div>
                  </div>
                </article>

                {/* MATH 201 */}
                <article className="flex flex-col justify-between rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border border-orange/30 bg-orange-tint text-[11px] font-semibold text-orange">
                          MA
                        </span>
                        <div>
                          <h3 className="text-[13.5px] font-semibold text-ink truncate">Linear Algebra</h3>
                          <span className="text-[11.5px] text-ink-3">Mon + Wed + Fri · 09:00</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[16px] font-semibold text-red tabular-nums">70%</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-tint px-1.5 py-0.2 text-[9.5px] font-medium text-red">At risk</span>
                      </div>
                    </div>

                    {activeView === "heatmap" ? (
                      <div className="grid grid-rows-3 grid-flow-col auto-cols-[13px] gap-1 py-1 overflow-x-auto">
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className="size-3.2 rounded-xs bg-orange/80" title="Late" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-orange/80" title="Late" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs border border-line bg-transparent" title="Scheduled" />
                      </div>
                    ) : (
                      <div className="flex items-end gap-1 h-10 border-b border-line/50 pb-1">
                        <i className="flex-1 bg-orange/70 rounded-xs h-2/3" />
                        <i className="flex-1 bg-orange/70 rounded-xs h-2/3" />
                        <i className="flex-1 bg-orange/70 rounded-xs h-2/3" />
                        <i className="flex-1 bg-orange/70 rounded-xs h-2/3" />
                        <i className="flex-1 bg-orange/70 rounded-xs h-2/3" />
                        <i className="flex-1 bg-orange/70 rounded-xs h-2/3" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-3 text-[11.5px] text-ink-3">
                    <span className="text-ink-2 font-medium">Dr. Okafor</span>
                    <div className="flex items-center gap-2 font-mono font-medium">
                      <span className="text-green">✓ 11</span>
                      <span className="text-orange">⏱ 2</span>
                      <span className="text-red">✕ 6</span>
                    </div>
                  </div>
                </article>

                {/* PHYS 211 */}
                <article className="flex flex-col justify-between rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border border-cyan-500/30 bg-cyan-500/10 text-[11px] font-semibold text-cyan-400">
                          PH
                        </span>
                        <div>
                          <h3 className="text-[13.5px] font-semibold text-ink truncate">Mechanics &amp; Waves</h3>
                          <span className="text-[11.5px] text-ink-3">Mon + Thu lab · 11:00</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[16px] font-semibold text-ink tabular-nums">92%</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-1.5 py-0.2 text-[9.5px] font-medium text-green">On track</span>
                      </div>
                    </div>

                    {activeView === "heatmap" ? (
                      <div className="grid grid-rows-2 grid-flow-col auto-cols-[13px] gap-1 py-1 overflow-x-auto">
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-orange/80" title="Late" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs border border-line bg-transparent" title="Scheduled" />
                      </div>
                    ) : (
                      <div className="flex items-end gap-1 h-10 border-b border-line/50 pb-1">
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-red/70 rounded-xs h-1/2" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-3 text-[11.5px] text-ink-3">
                    <span className="text-ink-2 font-medium">Prof. Lindqvist</span>
                    <div className="flex items-center gap-2 font-mono font-medium">
                      <span className="text-green">✓ 11</span>
                      <span className="text-orange">⏱ 1</span>
                      <span className="text-red">✕ 1</span>
                    </div>
                  </div>
                </article>

                {/* ENG 105 */}
                <article className="flex flex-col justify-between rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border border-pink-500/30 bg-pink-500/10 text-[11px] font-semibold text-pink-400">
                          EN
                        </span>
                        <div>
                          <h3 className="text-[13.5px] font-semibold text-ink truncate">Composition &amp; Rhetoric</h3>
                          <span className="text-[11.5px] text-ink-3">Wed · 13:00</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[16px] font-semibold text-ink tabular-nums">{checkInEng ? "86%" : "83%"}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-tint px-1.5 py-0.2 text-[9.5px] font-medium text-orange">
                          {checkInEng ? "Checked In" : "Check in today"}
                        </span>
                      </div>
                    </div>

                    {activeView === "heatmap" ? (
                      <div className="grid grid-rows-1 grid-flow-col auto-cols-[13px] gap-1 py-1 overflow-x-auto">
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-red/70" title="Absent" />
                        <span className={`size-3.2 rounded-xs ${checkInEng ? "bg-accent/80" : "border border-accent bg-accent-tint animate-pulse"}`} title="Today" />
                        <span className="size-3.2 rounded-xs border border-line bg-transparent" title="Scheduled" />
                      </div>
                    ) : (
                      <div className="flex items-end gap-1 h-10 border-b border-line/50 pb-1">
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-red/70 rounded-xs h-1/6" />
                        <i className={`flex-1 rounded-xs ${checkInEng ? "bg-accent/70 h-full" : "bg-accent-tint border border-accent h-1/2"}`} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-3 text-[11.5px] text-ink-3">
                    <span className="text-ink-2 font-medium">Prof. Marsh</span>
                    <div className="flex items-center gap-2 font-mono font-medium">
                      <span className="text-green">✓ {checkInEng ? "6" : "5"}</span>
                      <span className="text-orange">⏱ 0</span>
                      <span className="text-red">✕ {checkInEng ? "0" : "1"}</span>
                    </div>
                  </div>
                </article>

                {/* HIST 140 */}
                <article className="flex flex-col justify-between rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:-translate-y-0.5 transition-transform">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-400">
                          HI
                        </span>
                        <div>
                          <h3 className="text-[13.5px] font-semibold text-ink truncate">Modern European History</h3>
                          <span className="text-[11.5px] text-ink-3">Tue + Fri · 15:00</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[16px] font-semibold text-green tabular-nums">100%</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-1.5 py-0.2 text-[9.5px] font-medium text-green">Perfect</span>
                      </div>
                    </div>

                    {activeView === "heatmap" ? (
                      <div className="grid grid-rows-2 grid-flow-col auto-cols-[13px] gap-1 py-1 overflow-x-auto">
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-orange/80" title="Late" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-orange/80" title="Late" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs bg-accent/80" title="Present" />
                        <span className="size-3.2 rounded-xs border border-line bg-transparent" title="Scheduled" />
                      </div>
                    ) : (
                      <div className="flex items-end gap-1 h-10 border-b border-line/50 pb-1">
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                        <i className="flex-1 bg-accent/70 rounded-xs h-full" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-3 text-[11.5px] text-ink-3">
                    <span className="text-ink-2 font-medium">Dr. Park</span>
                    <div className="flex items-center gap-2 font-mono font-medium">
                      <span className="text-green">✓ 11</span>
                      <span className="text-orange">⏱ 2</span>
                      <span className="text-red">✕ 0</span>
                    </div>
                  </div>
                </article>
              </div>
            </div>

            {/* ── panel footer ───────────────────────────────── */}
            <footer className="flex items-center justify-between gap-2 flex-wrap rounded-[10px] border border-line bg-inset px-3.5 py-2 text-[11.5px] text-ink-3 font-mono">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>
                <code className="text-ink-2">attendance.delta</code>
                <span>· synced 4 min ago · badge scans verified</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Week <b>7</b> of 14 · <b>22</b> sessions remaining</span>
                <button type="button" className="text-accent hover:underline flex items-center gap-1 font-sans">
                  Export report
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            </footer>
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
