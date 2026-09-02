"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import SidebarNav from "@/components/primitives/SidebarNav";
import KeyboardShortcutsModal from "@/components/shortcuts/KeyboardShortcutsModal";
import EventIcons from "@/components/events/EventIcons";
import RecoveryPlanModal from "@/components/attendance/RecoveryPlanModal";
import { useTheme } from "@/lib/theme";
import { useCurrentUser, initialsFor } from "@/lib/useCurrentUser";
import type { AttendanceLog, AttendanceStatus, CourseAttendance, TermMeta, TodaySession } from "@/app/api/attendance/route";

/* ─────────────────────────────────────────────────────────
 * ATTENDANCE TRACKER — live from workspace.campus_explorer.
 * Client state is the flat log list; every view (courses,
 * stats, term heatmap, today schedule) derives from it with
 * the same math the API uses, so optimistic updates stay
 * truthful. Every mutation PUTs to the Lakehouse.
 * ───────────────────────────────────────────────────────── */

type AttendancePayload = {
  term: TermMeta;
  stats: {
    overallPct: number;
    attendedCount: number;
    missedCount: number;
    lateCount: number;
    presentCount: number;
    scheduledCount: number;
    totalSessionsToDate: number;
    streakDays: number;
    atRiskCoursesCount: number;
  };
  weekdayRates: { MON: number; TUE: number; WED: number; THU: number; FRI: number };
  courses: CourseAttendance[];
  termGrid: {
    date: string;
    week: number;
    dayLabel: string;
    status: "full" | "partial" | "missed" | "today" | "scheduled";
    presentCount: number;
    lateCount: number;
    absentCount: number;
    totalSessions: number;
  }[];
  todaySchedule: TodaySession[];
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_KEYS = ["MON", "TUE", "WED", "THU", "FRI"] as const;

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayNameOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

function nextStatus(s: AttendanceStatus): AttendanceStatus {
  if (s === "PRESENT") return "LATE";
  if (s === "LATE") return "ABSENT";
  if (s === "ABSENT") return "PRESENT";
  return "SCHEDULED";
}

/* Monogram tints — mid-lightness OKLCH hues derived like the records tags */
const COURSE_TINTS = [
  { color: "var(--accent)", bg: "var(--accent-tint)", border: "color-mix(in srgb, var(--accent) 30%, transparent)" },
  { color: "oklch(0.66 0.17 300)", bg: "oklch(0.66 0.17 300 / 0.14)", border: "oklch(0.66 0.17 300 / 0.26)" },
  { color: "oklch(0.72 0.10 221)", bg: "oklch(0.72 0.10 221 / 0.14)", border: "oklch(0.72 0.10 221 / 0.26)" },
  { color: "var(--green)", bg: "var(--green-tint)", border: "color-mix(in srgb, var(--green) 30%, transparent)" },
  { color: "var(--orange)", bg: "var(--orange-tint)", border: "color-mix(in srgb, var(--orange) 30%, transparent)" },
];

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export default function AttendancePage() {
  const { isDark, toggleTheme } = useTheme();
  const { user } = useCurrentUser();
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState<boolean>(false);
  const [selectedCourseForRecovery, setSelectedCourseForRecovery] = useState<CourseAttendance | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Source of truth: the flat list of this user's session logs
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [courseInfo, setCourseInfo] = useState<Omit<CourseAttendance, "logs" | "heatmapDays" | "totalSessionsToDate" | "scheduledCount" | "attendedCount" | "lateCount" | "absentCount" | "currentPercentage" | "isAtRisk" | "statusLabel">[]>([]);
  const [term, setTerm] = useState<TermMeta | null>(null);

  const todayStr = toISODate(new Date());

  // Filter chips + view state
  const [filterPresent, setFilterPresent] = useState<boolean>(true);
  const [filterLate, setFilterLate] = useState<boolean>(true);
  const [filterAbsent, setFilterAbsent] = useState<boolean>(true);
  const [filterScheduled, setFilterScheduled] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<"heatmap" | "trend">("heatmap");

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setFetchError(null);
      setLogs((data.courses as CourseAttendance[]).flatMap((c) => c.logs));
      setCourseInfo(
        (data.courses as CourseAttendance[]).map((c) => ({
          courseId: c.courseId,
          courseCode: c.courseCode,
          title: c.title,
          instructor: c.instructor,
          location: c.location,
          scheduleDays: c.scheduleDays,
          startTime: c.startTime,
          durationMins: c.durationMins,
          minAttendancePct: c.minAttendancePct,
        }))
      );
      setTerm(data.term);
    } catch (err: any) {
      setFetchError(err?.message || "Failed to load attendance");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2600);
  };

  /* ── persist a mutation; roll back to server truth on failure ── */
  const persist = useCallback(
    async (body: Record<string, unknown>, successMsg: string, optimistic: () => void) => {
      optimistic();
      setIsSyncing(true);
      try {
        const res = await fetch("/api/attendance", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        showToast(successMsg);
      } catch {
        showToast("Sync failed — restoring from Lakehouse");
        await fetchAttendance();
      } finally {
        setIsSyncing(false);
      }
    },
    [fetchAttendance]
  );

  /* ── derive every view from the log list ─────────────────────── */
  const view = useMemo(() => {
    const logsByCourse = new Map<string, AttendanceLog[]>();
    for (const l of logs) {
      if (!logsByCourse.has(l.courseId)) logsByCourse.set(l.courseId, []);
      logsByCourse.get(l.courseId)!.push(l);
    }

    const courses: CourseAttendance[] = courseInfo.map((c) => {
      const courseLogs = (logsByCourse.get(c.courseId) || []).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
      const pastLogs = courseLogs.filter((l) => l.status !== "SCHEDULED");
      const attended = pastLogs.filter((l) => l.status === "PRESENT").length;
      const late = pastLogs.filter((l) => l.status === "LATE").length;
      const absent = pastLogs.filter((l) => l.status === "ABSENT").length;
      const total = pastLogs.length || 1;
      const pct = total > 0 ? Math.round(((attended + late * 0.75) / total) * 100) : 0;
      return {
        ...c,
        totalSessionsToDate: pastLogs.length,
        scheduledCount: courseLogs.filter((l) => l.status === "SCHEDULED").length,
        attendedCount: attended,
        lateCount: late,
        absentCount: absent,
        currentPercentage: pct,
        isAtRisk: pct < c.minAttendancePct,
        statusLabel: pct >= 95 ? "Perfect" : pct < c.minAttendancePct ? "At risk" : "On track",
        logs: courseLogs,
        heatmapDays: courseLogs.map((l) => ({
          date: l.sessionDate,
          day: dayNameOf(l.sessionDate),
          status: l.status,
          logId: l.logId,
        })),
      };
    });

    const pastLogs = logs.filter((l) => l.status !== "SCHEDULED");
    const presentCount = pastLogs.filter((l) => l.status === "PRESENT").length;
    const lateCount = pastLogs.filter((l) => l.status === "LATE").length;
    const absentCount = pastLogs.filter((l) => l.status === "ABSENT").length;
    const totalToDate = pastLogs.length;
    const overallPct = totalToDate > 0 ? Math.round(((presentCount + lateCount * 0.75) / totalToDate) * 100) : 0;

    // Streak: most-recent consecutive school days without an absence
    const sorted = [...pastLogs].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
    let streak = 0;
    const seen = new Set<string>();
    for (const l of sorted) {
      if (!seen.has(l.sessionDate)) {
        seen.add(l.sessionDate);
        if (l.status === "ABSENT") break;
        streak++;
      }
    }

    // Weekday rates
    const weekday = Object.fromEntries(WEEKDAY_KEYS.map((k) => [k, { total: 0, attended: 0 }])) as Record<
      (typeof WEEKDAY_KEYS)[number],
      { total: number; attended: number }
    >;
    for (const l of pastLogs) {
      const key = dayNameOf(l.sessionDate).toUpperCase() as (typeof WEEKDAY_KEYS)[number];
      if (weekday[key]) {
        weekday[key].total++;
        if (l.status === "PRESENT" || l.status === "LATE") weekday[key].attended++;
      }
    }
    const weekdayRates = Object.fromEntries(
      WEEKDAY_KEYS.map((k) => [k, weekday[k].total ? Math.round((weekday[k].attended / weekday[k].total) * 100) : 0])
    ) as AttendancePayload["weekdayRates"];

    // Term heatmap grid
    const termGrid: AttendancePayload["termGrid"] = [];
    if (term) {
      const [sy, sm, sd] = term.startDate.split("-").map(Number);
      const termStart = new Date(sy, sm - 1, sd);
      for (let w = 1; w <= term.weeksTotal; w++) {
        for (let d = 0; d < 5; d++) {
          const cellDate = new Date(termStart);
          cellDate.setDate(termStart.getDate() + (w - 1) * 7 + d);
          const dateStr = toISODate(cellDate);
          const dayLogs = logs.filter((l) => l.sessionDate === dateStr);
          const pres = dayLogs.filter((l) => l.status === "PRESENT").length;
          const lte = dayLogs.filter((l) => l.status === "LATE").length;
          const abs = dayLogs.filter((l) => l.status === "ABSENT").length;
          let status: "full" | "partial" | "missed" | "today" | "scheduled" = "scheduled";
          if (dateStr === todayStr) status = "today";
          else if (dateStr < todayStr && dayLogs.length > 0) {
            if (pres === 0 && lte === 0 && abs > 0) status = "missed";
            else if (abs > 0 || lte > 0) status = "partial";
            else status = "full";
          }
          termGrid.push({
            date: dateStr,
            week: w,
            dayLabel: DAY_NAMES[cellDate.getDay()],
            status,
            presentCount: pres,
            lateCount: lte,
            absentCount: abs,
            totalSessions: dayLogs.length,
          });
        }
      }
    }

    // Today's real schedule
    const todayDay = DAY_NAMES[new Date().getDay()];
    const todaySchedule: (TodaySession & { courseIndex: number })[] = courseInfo
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.scheduleDays.includes(todayDay))
      .map(({ c, i }) => {
        const log = logs.find((l) => l.courseId === c.courseId && l.sessionDate === todayStr);
        return {
          courseId: c.courseId,
          courseCode: c.courseCode,
          title: c.title,
          startTime: c.startTime,
          durationMins: c.durationMins,
          room: c.location,
          logId: log?.logId ?? null,
          status: log?.status ?? "SCHEDULED",
          courseIndex: i,
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      courses,
      stats: {
        overallPct,
        attendedCount: presentCount + lateCount,
        missedCount: absentCount,
        lateCount,
        presentCount,
        scheduledCount: logs.filter((l) => l.status === "SCHEDULED").length,
        totalSessionsToDate: totalToDate,
        streakDays: streak,
        atRiskCoursesCount: courses.filter((c) => c.isAtRisk).length,
      },
      weekdayRates,
      termGrid,
      todaySchedule,
    };
  }, [logs, courseInfo, term, todayStr]);

  const { courses, stats, weekdayRates, termGrid, todaySchedule } = view;

  /* ── interactions (all persist to the Lakehouse) ─────────────── */

  // Course card cell: cycle this single session's status
  const handleToggleCourseSession = (course: CourseAttendance, dayIndex: number) => {
    const item = course.heatmapDays[dayIndex];
    if (!item || item.status === "SCHEDULED") return;
    const next = nextStatus(item.status);
    persist(
      { logId: item.logId, newStatus: next },
      `${course.courseCode} · ${item.date} set to ${next}`,
      () =>
        setLogs((prev) => prev.map((l) => (l.logId === item.logId ? { ...l, status: next } : l)))
    );
  };

  // Term heatmap cell: advance every session that day one step
  const handleAdvanceDay = (cell: AttendancePayload["termGrid"][number]) => {
    if (cell.status === "scheduled" || cell.status === "today" || cell.totalSessions === 0) return;
    persist(
      { advanceDate: cell.date },
      `Advanced ${cell.totalSessions} session${cell.totalSessions === 1 ? "" : "s"} on ${cell.date}`,
      () =>
        setLogs((prev) =>
          prev.map((l) =>
            l.sessionDate === cell.date && l.status !== "SCHEDULED" ? { ...l, status: nextStatus(l.status) } : l
          )
        )
    );
  };

  // Today check-in: mark PRESENT (or undo back to SCHEDULED)
  const handleCheckIn = (session: TodaySession, status: AttendanceStatus) => {
    persist(
      { courseId: session.courseId, sessionDate: todayStr, newStatus: status },
      status === "PRESENT"
        ? `Checked in to ${session.courseCode} — recorded in the Lakehouse`
        : `${session.courseCode} reset to scheduled`,
      () => {
        setLogs((prev) => {
          if (session.logId) {
            return prev.map((l) => (l.logId === session.logId ? { ...l, status } : l));
          }
          return [
            ...prev,
            {
              logId: `LOG-local-${session.courseId}-${todayStr.replace(/-/g, "")}`,
              studentId: user?.userId ?? "local",
              courseId: session.courseId,
              sessionDate: todayStr,
              status,
            },
          ];
        });
      }
    );
  };

  /* ── derived bits for copy ────────────────────────────────────── */
  const atRiskCourses = useMemo(
    () => [...courses].filter((c) => c.isAtRisk).sort((a, b) => a.currentPercentage - b.currentPercentage),
    [courses]
  );
  const alertCourse = atRiskCourses[0] ?? null;

  // Sessions needed to clear the cutoff: (eff + p) / (n + p) >= cutoff
  const recoveryMath = useMemo(() => {
    if (!alertCourse) return null;
    const cutoff = alertCourse.minAttendancePct / 100;
    const eff = alertCourse.attendedCount + alertCourse.lateCount * 0.75;
    const n = alertCourse.totalSessionsToDate;
    const needed = Math.max(0, Math.ceil((cutoff * n - eff) / (1 - cutoff)));
    return { needed, remaining: alertCourse.scheduledCount };
  }, [alertCourse]);

  const worstCourse = useMemo(
    () => [...courses].sort((a, b) => b.absentCount - a.absentCount)[0] ?? null,
    [courses]
  );

  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const todayDone = todaySchedule.filter((s) => s.status !== "SCHEDULED").length;

  // Month segments across the heatmap (JUL · AUG · SEP …)
  const monthSegments = useMemo(() => {
    const segs: { label: string; span: number }[] = [];
    for (const cell of termGrid) {
      const label = new Date(cell.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" }).toUpperCase();
      const last = segs[segs.length - 1];
      if (last && last.label === label) last.span++;
      else segs.push({ label, span: 1 });
    }
    return segs;
  }, [termGrid]);

  const lowestDay = WEEKDAY_KEYS.reduce((a, b) => (weekdayRates[a] <= weekdayRates[b] ? a : b), "MON" as (typeof WEEKDAY_KEYS)[number]);
  const highestDay = WEEKDAY_KEYS.reduce((a, b) => (weekdayRates[a] >= weekdayRates[b] ? a : b), "MON" as (typeof WEEKDAY_KEYS)[number]);
  const worstDayLabel = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri" }[lowestDay];
  const bestDayLabel = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri" }[highestDay];

  const handleResetFilters = () => {
    setFilterPresent(true);
    setFilterLate(true);
    setFilterAbsent(true);
    setFilterScheduled(true);
  };

  const handleExportCsv = () => {
    const header = "Course,Title,Instructor,Attended,Late,Absent,Scheduled,To Date,Percentage";
    const lines = courses.map((c) =>
      [c.courseCode, c.title, c.instructor, c.attendedCount, c.lateCount, c.absentCount, c.scheduledCount, c.totalSessionsToDate, `${c.currentPercentage}%`]
        .map((v) => {
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    );
    const blob = new Blob([`${header}\n${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance-${term?.startDate ?? todayStr}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Attendance report downloaded");
  };

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      <SidebarNav
        fill
        className="hidden lg:flex"
        activeTitle="Attendance Tracker"
        activeNav="attendance"
        footerLabel="Profile"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          {/* Header */}
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-canvas">
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
              {term && (
                <span className="hidden sm:inline-flex items-center rounded-full border border-line bg-inset px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-ink-3 tabular-nums">
                  {term.label} · WEEK {term.weekNumber}/{term.weeksTotal}
                </span>
              )}
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
                className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-surface text-ink-2 hover:bg-hover hover:text-ink transition-colors duration-100"
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

              <span
                title={user?.fullName ?? "Student"}
                className="flex size-6.5 items-center justify-center rounded-full border border-line bg-field text-[10px] font-semibold text-ink-2"
              >
                {initialsFor(user)}
              </span>
            </div>
          </header>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="absolute top-14 right-6 z-50 rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink shadow-overlay animate-fade-in flex items-center gap-2">
              <span className="size-2 rounded-full bg-green" />
              {toastMessage}
            </div>
          )}

          {/* Body content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-canvas">
            {fetchError && (
              <div className="flex items-center gap-2 rounded-[12px] border border-red/30 bg-red-tint/20 p-3.5 text-[12.5px] text-red">
                <span className="font-semibold">Couldn&apos;t load attendance:</span>
                <span>{fetchError}</span>
                <button type="button" onClick={fetchAttendance} className="ml-auto text-[12px] font-medium underline hover:no-underline">
                  Retry
                </button>
              </div>
            )}

            {/* ── risk alert (real at-risk course) ───────────── */}
            {alertCourse && recoveryMath ? (
              <div className="relative flex items-center justify-between gap-3 flex-wrap rounded-[12px] border border-orange/35 bg-orange-tint/20 p-3.5 shadow-sm animate-fade-in">
                <div className="flex items-start gap-3 min-w-[260px] flex-1 pr-6">
                  <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border border-orange/40 bg-orange-tint text-orange">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-[13.5px] font-semibold text-ink">{alertCourse.courseCode} · {alertCourse.title}</b>
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-tint px-2 py-0.5 text-[10.5px] font-medium text-red">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                        At risk
                      </span>
                      <span className="text-[12px] text-ink-2">exam eligibility</span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-ink-2 leading-relaxed">
                      Attendance is <b className="text-red font-semibold tabular-nums">{alertCourse.currentPercentage}%</b> — below the{" "}
                      <b className="font-semibold text-ink tabular-nums">{alertCourse.minAttendancePct}%</b> cutoff.{" "}
                      {recoveryMath.remaining > 0 ? (
                        <>
                          Attend <b className="text-ink tabular-nums">{Math.min(recoveryMath.needed, recoveryMath.remaining)} of the remaining {recoveryMath.remaining}</b> sessions to restore eligibility.
                        </>
                      ) : (
                        <>No sessions remain this term — talk to your instructor about eligibility.</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 w-40 shrink-0">
                  <div className="relative h-1.5 w-full rounded-full bg-hover overflow-hidden">
                    <div className="absolute top-0 bottom-0 left-0 bg-red rounded-full" style={{ width: `${Math.min(100, alertCourse.currentPercentage)}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: `${alertCourse.minAttendancePct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10.5px] font-medium tabular-nums">
                    <span className="text-red font-semibold">{alertCourse.currentPercentage}% now</span>
                    <span className="text-ink-3">{alertCourse.minAttendancePct}% cutoff</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseForRecovery(alertCourse);
                      setRecoveryModalOpen(true);
                    }}
                    className="inline-flex h-7.5 items-center gap-1.5 rounded-[8px] bg-accent px-3 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-accent-ink active:scale-[0.98] cursor-pointer"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>
                    Recovery plan
                  </button>
                </div>
              </div>
            ) : !fetchError && !isLoading && courses.length > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-green/30 bg-green-tint/20 p-3 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-green text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                  <div>
                    <span className="text-[13px] font-semibold text-green">All {courses.length} courses in safe standing!</span>
                    <p className="text-[12px] text-ink-2">Every course is meeting its {stats.overallPct >= 75 ? "final exam attendance cutoff" : "attendance threshold so far"}.</p>
                  </div>
                </div>
              </div>
            ) : null}

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
                    <span>lates count ¾ attendance</span>
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
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-3">
                    <span className="text-orange tabular-nums">{stats.lateCount} late</span>
                    <span>· counted at ¾ credit</span>
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
                    <span>no absence since</span>
                    <span className="tabular-nums">{term ? new Date(term.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
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
                    {worstCourse && worstCourse.absentCount > 0 ? (
                      <span className="truncate">
                        <span className="text-red font-medium tabular-nums">{worstCourse.absentCount}</span> in {worstCourse.courseCode}
                      </span>
                    ) : (
                      <span>nothing missed yet</span>
                    )}
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
                    <b className={`text-[18px] font-semibold tabular-nums ${stats.atRiskCoursesCount > 0 ? "text-orange" : "text-ink"}`}>{stats.atRiskCoursesCount}</b>
                    <span className="text-[11.5px] text-ink-3">of {courses.length} courses</span>
                  </div>
                  {alertCourse ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourseForRecovery(alertCourse);
                        setRecoveryModalOpen(true);
                      }}
                      className="flex items-center gap-1 mt-1 text-[11px] text-accent hover:underline cursor-pointer truncate"
                    >
                      {alertCourse.courseCode} · {alertCourse.currentPercentage}% (Plan →)
                    </button>
                  ) : (
                    <span className="block mt-1 text-[11px] text-ink-3">all clear</span>
                  )}
                </div>
              </div>
            </section>

            {/* ── today check-ins (real schedule from the Lakehouse) ── */}
            <section className="rounded-[12px] border border-line bg-surface shadow-card overflow-hidden" aria-label="Today's check-ins">
              <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5 bg-surface">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-accent">
                    <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
                    <path d="M8 2.5v4M16 2.5v4M3 10h18M9 15.5l2 2 4-4.5" />
                  </svg>
                  <div>
                    <h2 className="text-[13.5px] font-semibold text-ink">Today · {todayLabel}</h2>
                    <span className="text-[11.5px] text-ink-3 font-mono tabular-nums">
                      {todaySchedule.length} scheduled · {todayDone} tracked
                    </span>
                  </div>
                </div>
                {todaySchedule.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-[11px] font-medium text-green tabular-nums">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    {todayDone} of {todaySchedule.length} done
                  </span>
                )}
              </div>

              {todaySchedule.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                  <span className="flex size-9 items-center justify-center rounded-[9px] bg-inset text-ink-3 shadow-hairline">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>
                  </span>
                  <p className="text-[12.5px] font-medium text-ink-2">No classes scheduled today</p>
                  <p className="text-[11.5px] text-ink-3">Sessions from your enrolled courses will appear here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line p-1">
                  {todaySchedule.map((session) => {
                    const tint = COURSE_TINTS[session.courseIndex % COURSE_TINTS.length];
                    const [h, m] = session.startTime.split(":").map(Number);
                    const startMins = h * 60 + m;
                    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
                    const delta = startMins - nowMins;
                    const relative =
                      session.status !== "SCHEDULED"
                        ? null
                        : delta > 0
                          ? `in ${delta} min`
                          : delta + session.durationMins > 0
                            ? "happening now"
                            : "started";
                    const isNext = session.status === "SCHEDULED" && todaySchedule.filter((s) => s.status === "SCHEDULED")[0]?.courseId === session.courseId;

                    return (
                      <li key={session.courseId} className="flex items-center justify-between gap-3 p-2.5 rounded-[8px] hover:bg-hover transition-colors">
                        <span className="w-12 shrink-0 font-mono text-[12px] font-medium text-ink-2 tabular-nums">{fmtTime(session.startTime)}</span>
                        <span
                          className="flex size-7.5 shrink-0 items-center justify-center rounded-[8px] border text-[10px] font-semibold"
                          style={{ color: tint.color, background: tint.bg, borderColor: tint.border }}
                        >
                          {session.courseCode.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <b className="block text-[13px] font-semibold text-ink truncate">{session.courseCode} · {session.title}</b>
                          <span className="text-[11.5px] text-ink-3">{session.room} · {session.durationMins} min</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {session.status === "SCHEDULED" ? (
                            <>
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                                isNext ? "bg-accent-tint text-accent" : "border border-line bg-inset text-ink-3"
                              }`}>
                                {isNext && <span className="size-1.5 rounded-full bg-accent animate-pulse" />}
                                {isNext && relative ? `Next · ${relative}` : relative ?? "Scheduled"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCheckIn(session, "PRESENT")}
                                disabled={isSyncing}
                                className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-accent px-3 text-[11.5px] font-medium text-white shadow-sm transition-colors hover:bg-accent-ink active:scale-95 disabled:opacity-50 cursor-pointer"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                                Check in
                              </button>
                            </>
                          ) : (
                            <>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                                session.status === "PRESENT" ? "bg-green-tint text-green" : session.status === "LATE" ? "bg-orange-tint text-orange" : "bg-red-tint text-red"
                              }`}>
                                {session.status === "PRESENT" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
                                {session.status === "PRESENT" ? "Checked in" : session.status === "LATE" ? "Marked late" : "Absent"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCheckIn(session, "SCHEDULED")}
                                disabled={isSyncing}
                                title="Undo check-in"
                                className="inline-flex h-7 items-center rounded-[7px] border border-line bg-surface px-2.5 text-[11.5px] font-medium text-ink-3 transition-colors hover:bg-hover hover:text-ink disabled:opacity-50 cursor-pointer"
                              >
                                Undo
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                      <span className="text-[11.5px] text-ink-3 font-mono tabular-nums">
                        {term ? `${new Date(term.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(term.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · weeks 1–${term.weeksTotal}` : "…"}
                        {" · click a day to advance its sessions"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-[10.5px] font-medium text-green tabular-nums">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 4.5 13.5H11L9.5 22 18 10.5h-6.5L13 2Z"/></svg>
                      {stats.streakDays}-day streak
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto p-3.5">
                  <div className="grid grid-cols-[18px_auto] gap-x-2 gap-y-1 w-max">
                    {/* month segments, computed from the real term window */}
                    <div className="col-start-2 flex gap-1 font-mono text-[9.5px] font-medium text-ink-3">
                      {monthSegments.map((seg, i) => (
                        <span
                          key={i}
                          className="text-center"
                          style={{ width: seg.span * 24 + (seg.span - 1) * 4 }}
                        >
                          {seg.label}
                        </span>
                      ))}
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

                          let bg = "border border-line/60 bg-transparent";
                          if (isToday) bg = "bg-accent-tint border-2 border-accent";
                          else if (isMissed) bg = "bg-red/70";
                          else if (isPartial) bg = "bg-accent/40";
                          else if (isFull) bg = "bg-accent/80";

                          const opacityClass =
                            (isFull && !filterPresent) ||
                            (isPartial && !filterLate) ||
                            (isMissed && !filterAbsent) ||
                            (isScheduled && !filterScheduled)
                              ? "opacity-20"
                              : "opacity-100";

                          const interactive = !isToday && !isScheduled && cell.totalSessions > 0;
                          const tooltip = interactive
                            ? `${cell.dayLabel}, ${cell.date} — ${cell.totalSessions} session${cell.totalSessions === 1 ? "" : "s"}: ${cell.presentCount} present, ${cell.lateCount} late, ${cell.absentCount} absent (click to advance)`
                            : isToday
                              ? "Today"
                              : isScheduled
                                ? `${cell.dayLabel}, ${cell.date} — no sessions recorded`
                                : cell.dayLabel;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleAdvanceDay(cell)}
                              disabled={!interactive}
                              title={tooltip}
                              className={`size-6 rounded-[5px] transition-transform ${interactive ? "cursor-pointer hover:scale-125 hover:ring-2 hover:ring-accent" : "cursor-default"} ${bg} ${opacityClass}`}
                            />
                          );
                        })
                      ) : (
                        Array.from({ length: 70 }).map((_, idx) => (
                          <span key={idx} className="size-6 rounded-[5px] bg-inset animate-pulse" />
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
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-accent/80" /> All present</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-accent/40" /> Mixed</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-red/70" /> All missed</span>
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
                  {WEEKDAY_KEYS.map((key) => {
                    const rate = weekdayRates[key];
                    const low = rate < 80;
                    return (
                      <div key={key} className="flex flex-col items-center gap-2 flex-1">
                        <div className="relative w-full max-w-[36px] h-24 flex items-end rounded-[6px] bg-inset p-0.5">
                          <span
                            className={`w-full rounded-[4px] transition-all duration-300 ${low ? "bg-orange/70" : "bg-accent/70"}`}
                            style={{ height: `${Math.max(rate, 2)}%` }}
                            title={`${key} — ${rate}%`}
                          />
                        </div>
                        <div className="text-center">
                          <span className="block text-[10.5px] font-semibold text-ink-2">{key}</span>
                          <span className={`font-mono text-[10px] tabular-nums ${low ? "text-orange" : "text-ink-3"}`}>{rate}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[11.5px] text-ink-3">
                  <span>Lowest attendance day: <b className="text-orange">{worstDayLabel} ({weekdayRates[lowestDay]}%)</b></span>
                  <span className="text-green">Highest: <b>{bestDayLabel} ({weekdayRates[highestDay]}%)</b></span>
                </div>
              </section>
            </div>

            {/* ── courses breakdown grid ─────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-ink">Courses &amp; Lab Sessions ({courses.length})</h2>
                <span className="text-[11.5px] text-ink-3 font-mono">Click course squares to cycle Present → Late → Absent</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {courses.map((course, courseIdx) => {
                  const tint = COURSE_TINTS[courseIdx % COURSE_TINTS.length];

                  return (
                    <article
                      key={course.courseId}
                      className="flex flex-col justify-between rounded-[12px] border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-line-strong"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex size-8.5 shrink-0 items-center justify-center rounded-[9px] border font-mono text-[11px] font-bold"
                              style={{ color: tint.color, background: tint.bg, borderColor: tint.border }}
                            >
                              {course.courseCode.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <h3 className="text-[13.5px] font-semibold text-ink truncate">{course.title}</h3>
                              <span className="text-[11.5px] text-ink-3">
                                {course.scheduleDays.join(" + ")} · {fmtTime(course.startTime)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-[16px] font-semibold tabular-nums ${course.isAtRisk ? "text-red" : "text-ink"}`}>
                              {course.currentPercentage}%
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourseForRecovery(course);
                                setRecoveryModalOpen(true);
                              }}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-medium cursor-pointer transition-colors ${
                                course.isAtRisk
                                  ? "bg-red-tint text-red border border-red/20 hover:brightness-95"
                                  : "bg-green-tint text-green hover:brightness-95"
                              }`}
                            >
                              {course.isAtRisk ? `At risk · min ${course.minAttendancePct}%` : course.statusLabel}
                            </button>
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

                              let cellBg = "border border-line bg-transparent";
                              if (isPres) cellBg = "bg-accent/80";
                              else if (isLte) cellBg = "bg-orange/80";
                              else if (isAbs) cellBg = "bg-red/70";

                              const opacityClass =
                                (isPres && !filterPresent) ||
                                (isLte && !filterLate) ||
                                (isAbs && !filterAbsent) ||
                                (isSched && !filterScheduled)
                                  ? "opacity-20"
                                  : "opacity-100";

                              return (
                                <button
                                  key={dIdx}
                                  type="button"
                                  onClick={() => handleToggleCourseSession(course, dIdx)}
                                  disabled={isSched}
                                  title={`${course.courseCode} · ${day.date} (${day.day}) — ${day.status}${isSched ? "" : " (click to cycle)"}`}
                                  className={`size-3.5 rounded-xs transition-transform ${isSched ? "cursor-default" : "cursor-pointer hover:scale-125 hover:ring-1 hover:ring-accent"} ${cellBg} ${opacityClass}`}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-end gap-1 h-10 border-b border-line/50 pb-1">
                            {course.heatmapDays.filter((d) => d.status !== "SCHEDULED").slice(-10).map((day, dIdx) => {
                              const h = day.status === "PRESENT" ? "h-full bg-accent/70" : day.status === "ABSENT" ? "h-1/4 bg-red/70" : "h-2/3 bg-orange/70";
                              return <i key={dIdx} className={`flex-1 rounded-xs ${h}`} />;
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-3 text-[11.5px] text-ink-3">
                        <span className="text-ink-2 font-medium truncate">{course.instructor}</span>
                        <div className="flex items-center gap-2 font-mono font-medium tabular-nums shrink-0">
                          <span className="text-green">✓ {course.attendedCount}</span>
                          <span className="text-orange">⏱ {course.lateCount}</span>
                          <span className="text-red">✕ {course.absentCount}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {!isLoading && courses.length === 0 && !fetchError && (
                <div className="rounded-[12px] border border-line bg-surface p-8 text-center shadow-card">
                  <p className="text-[13px] font-medium text-ink-2">No enrolled courses found</p>
                  <p className="mt-1 text-[11.5px] text-ink-3">Courses are seeded per account on first visit to this page.</p>
                </div>
              )}
            </div>

            {/* ── panel footer ───────────────────────────────── */}
            <footer className="flex items-center justify-between gap-2 flex-wrap rounded-[10px] border border-line bg-inset px-3.5 py-2 text-[11.5px] text-ink-3 font-mono">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>
                <code className="text-ink-2">workspace.campus_explorer.student_attendance_logs</code>
                <span>· synced live with Databricks Lakehouse</span>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  Week <b className="tabular-nums">{term?.weekNumber ?? "—"}</b> of <b className="tabular-nums">{term?.weeksTotal ?? "—"}</b> ·{" "}
                  <b className="tabular-nums">{stats.scheduledCount}</b> sessions remaining
                </span>
                <button
                  type="button"
                  onClick={handleExportCsv}
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
          scheduleTime={`${selectedCourseForRecovery.scheduleDays?.join(", ") || "Mon, Wed, Fri"} · ${fmtTime(selectedCourseForRecovery.startTime || "09:00")}`}
          currentSessions={selectedCourseForRecovery.totalSessionsToDate}
          attendedSessions={selectedCourseForRecovery.attendedCount}
          totalTermSessions={selectedCourseForRecovery.totalSessionsToDate + selectedCourseForRecovery.scheduledCount}
          cutoffPercentage={selectedCourseForRecovery.minAttendancePct}
        />
      )}

      {/* Keyboard Shortcuts Dialog Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        onOpen={() => setShortcutsOpen(true)}
      />
    </main>
  );
}
