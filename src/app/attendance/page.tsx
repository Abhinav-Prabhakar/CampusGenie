"use client";

import { useState, useEffect, useMemo } from "react";
import SidebarNav from "@/components/primitives/SidebarNav";
import KeyboardShortcutsModal from "@/components/shortcuts/KeyboardShortcutsModal";
import EventIcons from "@/components/events/EventIcons";
import RecoveryPlanModal from "@/components/attendance/RecoveryPlanModal";
import { useTheme } from "@/lib/theme";
import type { AttendanceStatus, CourseAttendance } from "@/app/api/attendance/route";

export default function AttendancePage() {
  const { isDark, toggleTheme } = useTheme();
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState<boolean>(false);
  const [selectedCourseForRecovery, setSelectedCourseForRecovery] = useState<CourseAttendance | null>(null);

  // Data from Databricks Lakehouse
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<string>("lakehouse");
  const [courses, setCourses] = useState<CourseAttendance[]>([]);
  const [termGrid, setTermGrid] = useState<any[]>([]);
  const [weekdayRates, setWeekdayRates] = useState({ MON: 79, TUE: 93, WED: 86, THU: 92, FRI: 83 });
  const [stats, setStats] = useState({
    overallPct: 86,
    attendedCount: 56,
    missedCount: 9,
    lateCount: 6,
    presentCount: 49,
    scheduledCount: 74,
    totalSessionsToDate: 65,
    streakDays: 9,
    atRiskCoursesCount: 1,
  });

  // Interactive States
  const [isAlertDismissed, setIsAlertDismissed] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<"heatmap" | "trend">("heatmap");
  const [checkInEng, setCheckInEng] = useState<boolean>(false);
  const [remindCs, setRemindCs] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter Chips State
  const [filterPresent, setFilterPresent] = useState<boolean>(true);
  const [filterLate, setFilterLate] = useState<boolean>(true);
  const [filterAbsent, setFilterAbsent] = useState<boolean>(true);
  const [filterScheduled, setFilterScheduled] = useState<boolean>(true);

  const fetchAttendance = async () => {
    try {
      const res = await fetch("/api/attendance");
      if (res.ok) {
        const data = await res.json();
        if (data.courses) setCourses(data.courses);
        if (data.termGrid) setTermGrid(data.termGrid);
        if (data.stats) setStats(data.stats);
        if (data.weekdayRates) setWeekdayRates(data.weekdayRates);
        if (data.source) setDataSource(data.source);
      }
    } catch (err) {
      console.warn("Failed to fetch attendance:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ── TOGGLE A CELL IN TERM HEATMAP ──────────────────────────────
  const handleToggleTermCell = async (cellIndex: number) => {
    const cell = termGrid[cellIndex];
    if (!cell || cell.status === "scheduled" || cell.status === "today") return;

    // Cycle: full -> partial -> missed -> full
    const nextStatusMap: Record<string, "full" | "partial" | "missed"> = {
      full: "partial",
      partial: "missed",
      missed: "full",
    };
    const nextStatus = nextStatusMap[cell.status] || "full";

    const updatedGrid = [...termGrid];
    updatedGrid[cellIndex] = { ...cell, status: nextStatus };
    setTermGrid(updatedGrid);

    // Map nextStatus to AttendanceStatus
    const logStatus = nextStatus === "full" ? "PRESENT" : nextStatus === "partial" ? "LATE" : "ABSENT";

    // Optimistically update stats
    recalculateFromGrid(updatedGrid);

    // Persist to Databricks Lakehouse
    setIsSyncing(true);
    try {
      await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: "MATH-201",
          sessionDate: cell.date,
          newStatus: logStatus,
        }),
      });
      showToast(`Updated ${cell.dayLabel}, ${cell.date} to ${logStatus} in Lakehouse`);
    } catch (e) {
      console.error("Failed to sync cell update:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // ── TOGGLE A CELL IN A SPECIFIC COURSE CARD ────────────────────
  const handleToggleCourseSession = async (courseId: string, dayIndex: number) => {
    const course = courses.find((c) => c.courseId === courseId);
    if (!course || !course.heatmapDays[dayIndex]) return;

    const currentItem = course.heatmapDays[dayIndex];
    if (currentItem.status === "SCHEDULED") return;

    const nextStatusMap: Record<AttendanceStatus, AttendanceStatus> = {
      PRESENT: "LATE",
      LATE: "ABSENT",
      ABSENT: "PRESENT",
      SCHEDULED: "SCHEDULED",
    };
    const nextStatus = nextStatusMap[currentItem.status];

    // Optimistically update courses
    const updatedCourses = courses.map((c) => {
      if (c.courseId !== courseId) return c;
      const updatedDays = [...c.heatmapDays];
      updatedDays[dayIndex] = { ...currentItem, status: nextStatus };

      const past = updatedDays.filter((d) => d.status !== "SCHEDULED");
      const att = past.filter((d) => d.status === "PRESENT").length;
      const lte = past.filter((d) => d.status === "LATE").length;
      const abs = past.filter((d) => d.status === "ABSENT").length;
      const total = past.length || 1;
      const effective = att + lte * 0.75;
      const pct = Math.round((effective / total) * 100);
      const isAtRisk = pct < c.minAttendancePct;

      return {
        ...c,
        attendedCount: att,
        lateCount: lte,
        absentCount: abs,
        currentPercentage: pct,
        isAtRisk,
        statusLabel: pct >= 95 ? "Perfect" : isAtRisk ? "At risk" : "On track",
        heatmapDays: updatedDays,
      };
    });

    setCourses(updatedCourses);

    // Recalculate global stats
    recalculateGlobalStats(updatedCourses);

    // Persist to Databricks
    setIsSyncing(true);
    try {
      await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: currentItem.logId,
          courseId,
          sessionDate: currentItem.date,
          newStatus: nextStatus,
        }),
      });
      showToast(`${course.courseCode} ${currentItem.date} set to ${nextStatus}`);
    } catch (e) {
      console.error("Failed to update course session:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const recalculateFromGrid = (grid: any[]) => {
    const pastCells = grid.filter((c) => c.status !== "scheduled" && c.status !== "today");
    const full = pastCells.filter((c) => c.status === "full").length;
    const partial = pastCells.filter((c) => c.status === "partial").length;
    const missed = pastCells.filter((c) => c.status === "missed").length;
    const total = pastCells.length || 1;
    const pct = Math.round(((full * 2 + partial * 1.5) / (total * 2)) * 100);

    setStats((prev) => ({
      ...prev,
      overallPct: pct,
      attendedCount: full * 2 + partial,
      missedCount: missed * 2,
      lateCount: partial * 2,
      presentCount: full * 2,
    }));
  };

  const recalculateGlobalStats = (courseList: CourseAttendance[]) => {
    let totalAtt = 0;
    let totalLte = 0;
    let totalAbs = 0;
    let atRisk = 0;

    for (const c of courseList) {
      totalAtt += c.attendedCount;
      totalLte += c.lateCount;
      totalAbs += c.absentCount;
      if (c.isAtRisk) atRisk++;
    }

    const totalToDate = totalAtt + totalLte + totalAbs || 65;
    const overallPct = Math.round(((totalAtt + totalLte * 0.75) / totalToDate) * 100);

    setStats((prev) => ({
      ...prev,
      overallPct,
      attendedCount: totalAtt + totalLte,
      missedCount: totalAbs,
      lateCount: totalLte,
      presentCount: totalAtt,
      atRiskCoursesCount: atRisk,
    }));
  };

  const handleResetFilters = () => {
    setFilterPresent(true);
    setFilterLate(true);
    setFilterAbsent(true);
    setFilterScheduled(true);
    setActiveView("heatmap");
  };

  // Find MATH 201 course for the alert
  const mathCourse: CourseAttendance = courses.find((c) => c.courseCode.includes("201")) || {
    courseId: "MATH-201",
    courseCode: "MATH 201",
    title: "Linear Algebra",
    instructor: "Dr. Okafor",
    location: "Hart 112",
    scheduleDays: ["Mon", "Wed", "Fri"],
    startTime: "09:00",
    durationMins: 50,
    minAttendancePct: 75,
    currentPercentage: 70,
    isAtRisk: true,
    statusLabel: "At risk",
    attendedCount: 11,
    lateCount: 2,
    absentCount: 6,
    totalSessionsToDate: 19,
    logs: [],
    heatmapDays: [],
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
              {isSyncing && (
                <span className="inline-flex items-center gap-1 text-[11px] text-accent animate-pulse font-mono">
                  <span className="size-1.5 rounded-full bg-accent animate-ping" />
                  Syncing with Databricks…
                </span>
              )}
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

          {/* Toast Notification */}
          {toastMessage && (
            <div className="absolute top-14 right-6 z-50 rounded-[8px] border border-accent bg-surface px-3 py-1.5 text-[12px] font-medium text-ink shadow-lg animate-fade-in flex items-center gap-2">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
              {toastMessage}
            </div>
          )}

          {/* Body content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-canvas">
            {/* ── risk alert (dismissible) ───────────────────── */}
            {!isAlertDismissed && mathCourse.isAtRisk ? (
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
                      Attendance is <b className="text-red font-semibold tabular-nums">{mathCourse.currentPercentage}%</b> — below the <b className="font-semibold text-ink">75%</b> cutoff. Attend <b className="text-ink tabular-nums">18 of the remaining 22</b> sessions to restore eligibility.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 w-40 shrink-0">
                  <div className="relative h-1.5 w-full rounded-full bg-line overflow-hidden">
                    <div className="absolute top-0 bottom-0 left-0 bg-red rounded-full" style={{ width: `${mathCourse.currentPercentage}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: "75%" }} />
                  </div>
                  <div className="flex justify-between text-[10.5px] font-medium tabular-nums">
                    <span className="text-red font-semibold">{mathCourse.currentPercentage}% now</span>
                    <span className="text-ink-3">75% cutoff</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseForRecovery(mathCourse);
                      setRecoveryModalOpen(true);
                    }}
                    className="inline-flex h-7.5 items-center gap-1.5 rounded-[8px] bg-accent px-3 text-[12px] font-medium text-white shadow-sm hover:brightness-105 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>
                    Recovery plan
                  </button>
                  <button type="button" className="inline-flex h-7.5 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 text-[12px] font-medium text-ink-2 hover:bg-hover hover:text-ink transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
                    Remind me
                  </button>
                </div>
              </div>
            ) : !isAlertDismissed && !mathCourse.isAtRisk ? (
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-green/30 bg-green-tint/20 p-3 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-green text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                  <div>
                    <span className="text-[13px] font-semibold text-green">All 5 courses in safe standing!</span>
                    <p className="text-[12px] text-ink-2">MATH 201 attendance is now {mathCourse.currentPercentage}% — meeting all final exam cutoffs.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAlertDismissed(true)}
                  className="text-[12px] font-medium text-ink-3 hover:text-ink"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAlertDismissed(false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-3 hover:text-ink hover:bg-hover transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                Course warning banner hidden — restore
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
                      className="text-accent transition-all duration-300"
                      strokeWidth="3.6"
                      strokeDasharray="100"
                      strokeDashoffset={100 - stats.overallPct}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      cx="18"
                      cy="18"
                      r="15.92"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[11.5px] font-semibold text-ink tabular-nums">
                    {stats.overallPct}<small className="text-[8px] text-ink-3">%</small>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Overall</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <b className="text-[18px] font-semibold text-ink tabular-nums">{stats.overallPct}%</b>
                    <span className="text-[11.5px] text-ink-3 tabular-nums">{stats.attendedCount} / {stats.totalSessionsToDate} sessions</span>
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
                    <b className="text-[18px] font-semibold text-ink tabular-nums">{stats.attendedCount}</b>
                    <span className="text-[11.5px] text-ink-3 tabular-nums">of {stats.totalSessionsToDate} to date</span>
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
                    <b className="text-[18px] font-semibold text-ink tabular-nums">{stats.streakDays}</b>
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
                    <b className="text-[18px] font-semibold text-ink tabular-nums">{stats.missedCount}</b>
                    <span className="text-[11.5px] text-ink-3">sessions</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-3">
                    <span className="text-red font-medium tabular-nums">{mathCourse.absentCount} in MATH 201</span>
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
                    <b className="text-[18px] font-semibold text-orange tabular-nums">{stats.atRiskCoursesCount}</b>
                    <span className="text-[11.5px] text-ink-3">of 5 courses</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseForRecovery(mathCourse);
                      setRecoveryModalOpen(true);
                    }}
                    className="flex items-center gap-1 mt-1 text-[11px] text-accent hover:underline cursor-pointer"
                  >
                    MATH 201 · {mathCourse.currentPercentage}% (Plan →)
                  </button>
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
                    {stats.streakDays}-day streak on the line
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
                          onClick={() => {
                            setCheckInEng(true);
                            setStats((prev) => ({ ...prev, attendedCount: prev.attendedCount + 1 }));
                            showToast("Checked in to ENG 105 in Lakehouse!");
                          }}
                          className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-accent px-3 text-[11.5px] font-medium text-white shadow-sm hover:brightness-105 transition-all cursor-pointer active:scale-95"
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
                          onClick={() => {
                            setCheckInEng(false);
                            setStats((prev) => ({ ...prev, attendedCount: prev.attendedCount - 1 }));
                          }}
                          className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-green-tint px-2.5 text-[11.5px] font-medium text-green cursor-pointer"
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
                      onClick={() => {
                        setRemindCs(!remindCs);
                        showToast(remindCs ? "Reminder removed" : "Reminder set for CS 210 office hours");
                      }}
                      className={`inline-flex h-7 items-center gap-1 rounded-[7px] border border-line px-2.5 text-[11.5px] font-medium transition-colors cursor-pointer ${
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
                  live · workspace.campus_explorer.student_attendance_logs
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterPresent(!filterPresent)}
                  className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors cursor-pointer ${
                    filterPresent ? "border-accent/40 bg-accent-tint text-accent" : "border-line bg-surface text-ink-3"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  Present <b className="font-mono text-[10.5px]">{stats.presentCount}</b>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterLate(!filterLate)}
                  className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors cursor-pointer ${
                    filterLate ? "border-orange/40 bg-orange-tint text-orange" : "border-line bg-surface text-ink-3"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
                  Late <b className="font-mono text-[10.5px]">{stats.lateCount}</b>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterAbsent(!filterAbsent)}
                  className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors cursor-pointer ${
                    filterAbsent ? "border-red/40 bg-red-tint text-red" : "border-line bg-surface text-ink-3"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  Absent <b className="font-mono text-[10.5px]">{stats.missedCount}</b>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterScheduled(!filterScheduled)}
                  className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors cursor-pointer ${
                    filterScheduled ? "border-line-strong bg-inset text-ink-2" : "border-line bg-surface text-ink-3"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>
                  Scheduled <b className="font-mono text-[10.5px]">{stats.scheduledCount}</b>
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
                      <span className="text-[11.5px] text-ink-3 font-mono">Feb 3 – May 9 · weeks 1–14 · click squares to toggle status</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-[10.5px] font-medium text-green">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 4.5 13.5H11L9.5 22 18 10.5h-6.5L13 2Z"/></svg>
                      {stats.streakDays}-day streak
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
                      {termGrid.length > 0 ? (
                        termGrid.map((cell, idx) => {
                          const isToday = cell.status === "today";
                          const isScheduled = cell.status === "scheduled";
                          const isFull = cell.status === "full";
                          const isPartial = cell.status === "partial";
                          const isMissed = cell.status === "missed";

                          let bg = "bg-accent/80";
                          if (isToday) bg = "bg-accent-tint border-2 border-accent animate-pulse";
                          else if (isScheduled) bg = "border border-line/60 bg-transparent";
                          else if (isMissed) bg = "bg-red/70";
                          else if (isPartial) bg = "bg-accent/40";

                          const opacityClass =
                            (isFull && !filterPresent) ||
                            (isPartial && !filterLate) ||
                            (isMissed && !filterAbsent) ||
                            (isScheduled && !filterScheduled)
                              ? "opacity-20"
                              : "opacity-100";

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleToggleTermCell(idx)}
                              title={`${cell.dayLabel} · ${cell.date} — ${
                                isFull ? "Present (Full day)" : isPartial ? "Late (Partial day)" : isMissed ? "Missed" : isToday ? "Today" : "Scheduled"
                              } (Click to toggle)`}
                              className={`size-6 rounded-[5px] transition-transform hover:scale-125 cursor-pointer hover:ring-2 hover:ring-accent ${bg} ${opacityClass}`}
                            />
                          );
                        })
                      ) : (
                        Array.from({ length: 70 }).map((_, idx) => (
                          <span key={idx} className="size-6 rounded-[5px] bg-accent/40 animate-pulse" />
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[11.5px] text-ink-3">
                  <div className="flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green"><path d="M20 6L9 17l-5-5"/></svg>
                    <span><b className="text-ink-2 font-semibold tabular-nums">{stats.attendedCount}</b> of {stats.totalSessionsToDate} sessions recorded</span>
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
                      <span className="w-full rounded-[4px] bg-orange/70 transition-all duration-300" style={{ height: `${weekdayRates.MON}%` }} title={`Mon — ${weekdayRates.MON}%`} />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">MON</span>
                      <span className="font-mono text-[10px] text-orange tabular-nums">{weekdayRates.MON}%</span>
                    </div>
                  </div>

                  {/* Tue */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-accent/70 transition-all duration-300" style={{ height: `${weekdayRates.TUE}%` }} title={`Tue — ${weekdayRates.TUE}%`} />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">TUE</span>
                      <span className="font-mono text-[10px] text-ink-3 tabular-nums">{weekdayRates.TUE}%</span>
                    </div>
                  </div>

                  {/* Wed */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-accent/70 transition-all duration-300" style={{ height: `${weekdayRates.WED}%` }} title={`Wed — ${weekdayRates.WED}%`} />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">WED</span>
                      <span className="font-mono text-[10px] text-ink-3 tabular-nums">{weekdayRates.WED}%</span>
                    </div>
                  </div>

                  {/* Thu */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-accent/70 transition-all duration-300" style={{ height: `${weekdayRates.THU}%` }} title={`Thu — ${weekdayRates.THU}%`} />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">THU</span>
                      <span className="font-mono text-[10px] text-ink-3 tabular-nums">{weekdayRates.THU}%</span>
                    </div>
                  </div>

                  {/* Fri */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                      <span className="w-full rounded-[4px] bg-orange/70 transition-all duration-300" style={{ height: `${weekdayRates.FRI}%` }} title={`Fri — ${weekdayRates.FRI}%`} />
                    </div>
                    <div className="text-center">
                      <span className="block text-[10.5px] font-semibold text-ink-2">FRI</span>
                      <span className="font-mono text-[10px] text-orange tabular-nums">{weekdayRates.FRI}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[11.5px] text-ink-3">
                  <span>Lowest attendance day: <b className="text-orange">Mon ({weekdayRates.MON}%)</b></span>
                  <span className="text-green">Highest: <b>Tue ({weekdayRates.TUE}%)</b></span>
                </div>
              </section>
            </div>

            {/* ── courses breakdown grid (5 courses) ─────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-ink">Courses &amp; Lab Sessions ({courses.length})</h2>
                <span className="text-[11.5px] text-ink-3 font-mono">Click course squares to toggle individual attendance</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {courses.map((course) => {
                  const isMath = course.courseCode.includes("201");
                  const isCs = course.courseCode.includes("210");
                  const isPhys = course.courseCode.includes("211");
                  const isEng = course.courseCode.includes("105");
                  const isHist = course.courseCode.includes("140");

                  let monogramColor = "border-accent/30 bg-accent-tint text-accent";
                  if (isMath) monogramColor = "border-orange/30 bg-orange-tint text-orange";
                  else if (isPhys) monogramColor = "border-cyan-500/30 bg-cyan-500/10 text-cyan-400";
                  else if (isEng) monogramColor = "border-pink-500/30 bg-pink-500/10 text-pink-400";
                  else if (isHist) monogramColor = "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";

                  return (
                    <article
                      key={course.courseId}
                      className="flex flex-col justify-between rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:-translate-y-0.5 transition-transform"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border font-mono text-[11px] font-bold ${monogramColor}`}>
                              {course.courseCode.slice(0, 2)}
                            </span>
                            <div>
                              <h3 className="text-[13.5px] font-semibold text-ink truncate">{course.title}</h3>
                              <span className="text-[11.5px] text-ink-3">
                                {course.scheduleDays.join(" + ")} · {course.startTime}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-[16px] font-semibold tabular-nums ${course.isAtRisk ? "text-red" : "text-ink"}`}>
                              {course.currentPercentage}%
                            </span>
                            {course.isAtRisk ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCourseForRecovery(course);
                                  setRecoveryModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-red-tint px-2 py-0.5 text-[9.5px] font-medium text-red hover:bg-red-tint/70 hover:brightness-95 cursor-pointer transition-colors border border-red/20"
                              >
                                At risk · Plan →
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCourseForRecovery(course);
                                  setRecoveryModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-green-tint px-1.5 py-0.2 text-[9.5px] font-medium text-green hover:brightness-95 cursor-pointer"
                              >
                                {course.statusLabel}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Interactive Course Mini-Heatmap */}
                        {activeView === "heatmap" ? (
                          <div className="grid grid-rows-2 grid-flow-col auto-cols-[14px] gap-1 py-1 overflow-x-auto">
                            {course.heatmapDays.map((day, dIdx) => {
                              const isPres = day.status === "PRESENT";
                              const isLte = day.status === "LATE";
                              const isAbs = day.status === "ABSENT";
                              const isSched = day.status === "SCHEDULED";

                              let cellBg = "bg-accent/80";
                              if (isLte) cellBg = "bg-orange/80";
                              else if (isAbs) cellBg = "bg-red/70";
                              else if (isSched) cellBg = "border border-line bg-transparent";

                              return (
                                <button
                                  key={dIdx}
                                  type="button"
                                  onClick={() => handleToggleCourseSession(course.courseId, dIdx)}
                                  title={`${course.courseCode} · ${day.date} (${day.day}) — ${day.status} (Click to toggle)`}
                                  className={`size-3.5 rounded-xs cursor-pointer hover:scale-125 transition-transform hover:ring-1 hover:ring-accent ${cellBg}`}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-end gap-1 h-10 border-b border-line/50 pb-1">
                            {course.heatmapDays.slice(0, 10).map((day, dIdx) => {
                              const isPres = day.status === "PRESENT";
                              const isAbs = day.status === "ABSENT";
                              const h = isPres ? "h-full bg-accent/70" : isAbs ? "h-1/4 bg-red/70" : "h-2/3 bg-orange/70";
                              return <i key={dIdx} className={`flex-1 rounded-xs ${h}`} />;
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-3 text-[11.5px] text-ink-3">
                        <span className="text-ink-2 font-medium">{course.instructor}</span>
                        <div className="flex items-center gap-2 font-mono font-medium">
                          <span className="text-green">✓ {course.attendedCount}</span>
                          <span className="text-orange">⏱ {course.lateCount}</span>
                          <span className="text-red">✕ {course.absentCount}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* ── panel footer ───────────────────────────────── */}
            <footer className="flex items-center justify-between gap-2 flex-wrap rounded-[10px] border border-line bg-inset px-3.5 py-2 text-[11.5px] text-ink-3 font-mono">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>
                <code className="text-ink-2">workspace.campus_explorer.student_attendance_logs</code>
                <span>· synced live with Databricks Lakehouse</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Week <b>7</b> of 14 · <b>22</b> sessions remaining</span>
                <button
                  type="button"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," +
                      "Course,Instructor,Attended,Late,Absent,Percentage\n" +
                      courses.map((c) => `${c.courseCode},${c.instructor},${c.attendedCount},${c.lateCount},${c.absentCount},${c.currentPercentage}%`).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `attendance_report_week7.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast("Downloaded attendance_report_week7.csv");
                  }}
                  className="text-accent hover:underline flex items-center gap-1 font-sans cursor-pointer"
                >
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

      {/* Dynamic Attendance Recovery Plan Modal */}
      {selectedCourseForRecovery && (
        <RecoveryPlanModal
          isOpen={recoveryModalOpen}
          onClose={() => {
            setRecoveryModalOpen(false);
            fetchAttendance();
          }}
          courseCode={selectedCourseForRecovery.courseCode}
          courseName={selectedCourseForRecovery.title}
          instructor={selectedCourseForRecovery.instructor}
          location={selectedCourseForRecovery.location}
          scheduleTime={`${selectedCourseForRecovery.scheduleDays?.join(", ") || "Mon, Wed, Fri"} ${selectedCourseForRecovery.startTime || "09:00 AM"}`}
          currentSessions={selectedCourseForRecovery.totalSessionsToDate || 20}
          attendedSessions={selectedCourseForRecovery.attendedCount || 14}
          totalTermSessions={selectedCourseForRecovery.courseCode.includes("201") || selectedCourseForRecovery.courseCode.includes("210") ? 42 : 28}
          cutoffPercentage={selectedCourseForRecovery.minAttendancePct || 75}
        />
      )}

      {/* Keyboard Shortcuts Dialog Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </main>
  );
}
