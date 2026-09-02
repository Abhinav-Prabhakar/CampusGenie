import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeLakehouseSql, type LakehouseSqlParameter } from "@/lib/lakehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "SCHEDULED";

export type AttendanceLog = {
  logId: string;
  studentId: string;
  courseId: string;
  sessionDate: string;
  status: AttendanceStatus;
  checkInTime?: string | null;
  verificationMethod?: string;
  notes?: string;
};

export type CourseAttendance = {
  courseId: string;
  courseCode: string;
  title: string;
  instructor: string;
  location: string;
  scheduleDays: string[];
  startTime: string;
  durationMins: number;
  minAttendancePct: number;
  totalSessionsToDate: number;
  scheduledCount: number;
  attendedCount: number;
  lateCount: number;
  absentCount: number;
  currentPercentage: number;
  isAtRisk: boolean;
  statusLabel: string;
  logs: AttendanceLog[];
  heatmapDays: { date: string; day: string; status: AttendanceStatus; logId?: string }[];
};

export type TodaySession = {
  courseId: string;
  courseCode: string;
  title: string;
  startTime: string;
  durationMins: number;
  room: string;
  logId: string | null;
  status: AttendanceStatus;
};

export type TermMeta = {
  startDate: string;
  endDate: string;
  weekNumber: number;
  weeksTotal: number;
  label: string;
};

// Fallback seed courses if table is empty
const DEFAULT_COURSES = [
  {
    courseId: "MATH-201",
    courseCode: "MATH 201",
    title: "Linear Algebra",
    instructor: "Dr. Okafor",
    location: "Hart 112",
    scheduleDays: ["Mon", "Wed", "Fri"],
    startTime: "09:00",
    durationMins: 50,
    minAttendancePct: 75,
  },
  {
    courseId: "CS-210",
    courseCode: "CS 210",
    title: "Data Structures & Algorithms",
    instructor: "Prof. Reyes",
    location: "Kemper 210",
    scheduleDays: ["Tue", "Thu"],
    startTime: "10:00",
    durationMins: 60,
    minAttendancePct: 75,
  },
  {
    courseId: "PHYS-211",
    courseCode: "PHYS 211",
    title: "Mechanics & Waves",
    instructor: "Prof. Lindqvist",
    location: "Physics 105",
    scheduleDays: ["Mon", "Wed"],
    startTime: "11:00",
    durationMins: 60,
    minAttendancePct: 75,
  },
  {
    courseId: "ENG-105",
    courseCode: "ENG 105",
    title: "Composition & Rhetoric",
    instructor: "Prof. Marsh",
    location: "Olson 24",
    scheduleDays: ["Tue", "Thu"],
    startTime: "14:00",
    durationMins: 50,
    minAttendancePct: 75,
  },
  {
    courseId: "HIST-140",
    courseCode: "HIST 140",
    title: "Modern European History",
    instructor: "Dr. Park",
    location: "Wellman 201",
    scheduleDays: ["Fri"],
    startTime: "14:00",
    durationMins: 60,
    minAttendancePct: 75,
  },
];

const TERM_WEEKS = 14;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local-date formatting — never toISOString(), which shifts TZs a day off. */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function mondayOf(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function seasonLabel(termStart: Date): string {
  const m = termStart.getMonth();
  const season = m <= 4 ? "SPRING" : m <= 7 ? "SUMMER" : "FALL";
  return `${season} ${termStart.getFullYear()}`;
}

/**
 * Seed this user's per-term attendance history around *today*: seven weeks of
 * recorded sessions behind, the rest of the 14-week term as SCHEDULED, so the
 * tracker always opens mid-term with real check-ins available.
 */
async function seedLogsFor(uid: string, courses: typeof DEFAULT_COURSES, termStart: Date, todayStr: string): Promise<void> {
  const logRows: string[] = [];
  courses.forEach((course, courseIdx) => {
    const cursor = new Date(termStart);
    const termEnd = addDays(termStart, TERM_WEEKS * 7 - 3);
    let sessionIdx = 0;
    while (cursor <= termEnd) {
      if (course.scheduleDays.includes(DAY_NAMES[cursor.getDay()])) {
        const dateStr = toISODate(cursor);
        // Deterministic mix so seeded histories are stable and realistic.
        const bucket = (sessionIdx * 5 + courseIdx * 3) % 16;
        const status =
          dateStr >= todayStr
            ? "SCHEDULED"
            : bucket === 0
              ? "ABSENT"
              : bucket === 5 || bucket === 11
                ? "LATE"
                : "PRESENT";
        logRows.push(
          `('LOG-${uid.slice(-6)}-${course.courseId}-${dateStr.replace(/-/g, '')}', '${uid}', '${course.courseId}', DATE '${dateStr}', '${status}', NULL, 'seed', NULL, current_timestamp())`
        );
        sessionIdx++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  if (logRows.length > 0) {
    await executeLakehouseSql(
      `INSERT INTO workspace.campus_explorer.student_attendance_logs (log_id, student_id, course_id, session_date, status, check_in_time, verification_method, notes, created_at) VALUES ${logRows.join(",\n")}`
    );
  }
}

/**
 * Seed a fresh user's enrollments + term attendance history so every account
 * starts with the same demo dataset, scoped to their Clerk user id.
 */
async function seedUserDataFor(safeUid: string): Promise<void> {
  const todayStr = toISODate(new Date());
  const termStart = addDays(mondayOf(new Date()), -7 * 7);

  const courseValues = DEFAULT_COURSES.map((c) => {
    const days = c.scheduleDays.map((d) => `'${d}'`).join(",");
    return `('${c.courseId}', '${c.courseCode}', '${c.title.replace(/'/g, "''")}', '${c.instructor.replace(/'/g, "''")}', '${c.location.replace(/'/g, "''")}', ARRAY(${days}), '${c.startTime}', ${c.durationMins}, ${c.minAttendancePct}, '${safeUid}')`;
  }).join(",\n");

  await executeLakehouseSql(
    `INSERT INTO workspace.campus_explorer.student_courses (course_id, course_code, title, instructor, location, schedule_days, start_time, duration_mins, min_attendance_pct, user_id) VALUES ${courseValues}`
  );

  await seedLogsFor(safeUid, DEFAULT_COURSES, termStart, todayStr);
}

/** Cycle a status forward: PRESENT → LATE → ABSENT → PRESENT. */
function nextStatus(s: AttendanceStatus): AttendanceStatus {
  if (s === "PRESENT") return "LATE";
  if (s === "LATE") return "ABSENT";
  if (s === "ABSENT") return "PRESENT";
  return "SCHEDULED";
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const safeUid = userId.replace(/'/g, "''");
    const todayStr = toISODate(new Date());

    // 1. Fetch this user's courses (seeding on first visit) and logs
    let coursesRes = await executeLakehouseSql(
      `SELECT * FROM workspace.campus_explorer.student_courses WHERE user_id = '${safeUid}'`
    );

    if (coursesRes.state === "SUCCEEDED" && (!coursesRes.records || coursesRes.records.length === 0)) {
      await seedUserDataFor(safeUid);
      coursesRes = await executeLakehouseSql(
        `SELECT * FROM workspace.campus_explorer.student_courses WHERE user_id = '${safeUid}'`
      );
    }

    let logsRes = await executeLakehouseSql(
      `SELECT * FROM workspace.campus_explorer.student_attendance_logs WHERE student_id = '${safeUid}' ORDER BY session_date ASC`
    );

    // The seeded term is anchored at first-seed time. If it has fully elapsed
    // (or a user has courses but no logs yet), roll a fresh term around today.
    const logRecords = logsRes.state === "SUCCEEDED" && Array.isArray(logsRes.records) ? logsRes.records : [];
    const dates = logRecords.map((r: any) => String(r.session_date).slice(0, 10)).sort();
    const termStale = dates.length === 0 || (dates.length > 0 && dates[dates.length - 1] < todayStr);
    if (termStale) {
      await executeLakehouseSql(
        `DELETE FROM workspace.campus_explorer.student_attendance_logs WHERE student_id = '${safeUid}'`
      );
      const termStart = addDays(mondayOf(new Date()), -7 * 7);
      await seedLogsFor(safeUid, DEFAULT_COURSES, termStart, todayStr);
      logsRes = await executeLakehouseSql(
        `SELECT * FROM workspace.campus_explorer.student_attendance_logs WHERE student_id = '${safeUid}' ORDER BY session_date ASC`
      );
    }

    const rawCourses = coursesRes.state === "SUCCEEDED" && coursesRes.records && coursesRes.records.length > 0
      ? coursesRes.records.map((r: any) => ({
          courseId: r.course_id,
          courseCode: r.course_code,
          title: r.title,
          instructor: r.instructor,
          location: r.location,
          scheduleDays: Array.isArray(r.schedule_days) ? r.schedule_days : JSON.parse(r.schedule_days || "[]"),
          startTime: r.start_time,
          durationMins: Number(r.duration_mins) || 50,
          minAttendancePct: Number(r.min_attendance_pct) || 75,
        }))
      : DEFAULT_COURSES;

    const rawLogs: AttendanceLog[] = logsRes.state === "SUCCEEDED" && logsRes.records
      ? logsRes.records.map((r: any) => ({
          logId: r.log_id,
          studentId: r.student_id,
          courseId: r.course_id,
          sessionDate: String(r.session_date).slice(0, 10),
          status: (r.status?.toUpperCase() || "SCHEDULED") as AttendanceStatus,
          checkInTime: r.check_in_time,
          verificationMethod: r.verification_method,
          notes: r.notes,
        }))
      : [];

    // Group logs by courseId
    const logsByCourse = new Map<string, AttendanceLog[]>();
    for (const log of rawLogs) {
      if (!logsByCourse.has(log.courseId)) logsByCourse.set(log.courseId, []);
      logsByCourse.get(log.courseId)!.push(log);
    }

    // Compute Course Stats
    const courses: CourseAttendance[] = rawCourses.map((c) => {
      const logs = logsByCourse.get(c.courseId) || [];
      const pastLogs = logs.filter((l) => l.status !== "SCHEDULED");
      const attended = pastLogs.filter((l) => l.status === "PRESENT").length;
      const late = pastLogs.filter((l) => l.status === "LATE").length;
      const absent = pastLogs.filter((l) => l.status === "ABSENT").length;
      const total = pastLogs.length || 1;

      const effectiveAttended = attended + late * 0.75;
      const currentPercentage = Math.round((effectiveAttended / total) * 100);
      const isAtRisk = currentPercentage < c.minAttendancePct;
      const statusLabel = currentPercentage >= 95 ? "Perfect" : isAtRisk ? "At risk" : "On track";

      // Build session slots for course mini-heatmap
      const heatmapDays = logs.map((l) => ({
        date: l.sessionDate,
        day: DAY_NAMES[parseISODate(l.sessionDate).getDay()],
        status: l.status,
        logId: l.logId,
      }));

      return {
        ...c,
        totalSessionsToDate: total,
        scheduledCount: logs.filter((l) => l.status === "SCHEDULED").length,
        attendedCount: attended,
        lateCount: late,
        absentCount: absent,
        currentPercentage,
        isAtRisk,
        statusLabel,
        logs,
        heatmapDays,
      };
    });

    // Compute Global Metrics
    const allPastLogs = rawLogs.filter((l) => l.status !== "SCHEDULED");
    const totalPresent = allPastLogs.filter((l) => l.status === "PRESENT").length;
    const totalLate = allPastLogs.filter((l) => l.status === "LATE").length;
    const totalAbsent = allPastLogs.filter((l) => l.status === "ABSENT").length;
    const totalToDate = allPastLogs.length;
    const overallPct = totalToDate > 0 ? Math.round(((totalPresent + totalLate * 0.75) / totalToDate) * 100) : 0;

    // Weekday breakdown
    const weekdayCounts: Record<string, { total: number; attended: number }> = {
      Mon: { total: 0, attended: 0 },
      Tue: { total: 0, attended: 0 },
      Wed: { total: 0, attended: 0 },
      Thu: { total: 0, attended: 0 },
      Fri: { total: 0, attended: 0 },
    };

    for (const log of allPastLogs) {
      const dayName = DAY_NAMES[parseISODate(log.sessionDate).getDay()];
      if (weekdayCounts[dayName]) {
        weekdayCounts[dayName].total++;
        if (log.status === "PRESENT" || log.status === "LATE") {
          weekdayCounts[dayName].attended++;
        }
      }
    }

    const weekdayRates = {
      MON: weekdayCounts.Mon.total ? Math.round((weekdayCounts.Mon.attended / weekdayCounts.Mon.total) * 100) : 0,
      TUE: weekdayCounts.Tue.total ? Math.round((weekdayCounts.Tue.attended / weekdayCounts.Tue.total) * 100) : 0,
      WED: weekdayCounts.Wed.total ? Math.round((weekdayCounts.Wed.attended / weekdayCounts.Wed.total) * 100) : 0,
      THU: weekdayCounts.Thu.total ? Math.round((weekdayCounts.Thu.attended / weekdayCounts.Thu.total) * 100) : 0,
      FRI: weekdayCounts.Fri.total ? Math.round((weekdayCounts.Fri.attended / weekdayCounts.Fri.total) * 100) : 0,
    };

    // Calculate Streak: consecutive most-recent school days with no absence
    const sortedLogs = [...allPastLogs].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
    let streak = 0;
    const seenDates = new Set<string>();
    for (const log of sortedLogs) {
      if (!seenDates.has(log.sessionDate)) {
        seenDates.add(log.sessionDate);
        if (log.status === "ABSENT") break;
        streak++;
      }
    }

    // Term window is anchored at the user's earliest log (stable across visits)
    const termStart = dates.length > 0 ? parseISODate(dates[0]) : addDays(mondayOf(new Date()), -7 * 7);
    const termEnd = addDays(termStart, TERM_WEEKS * 7 - 3); // last Friday of week 14
    const daysIntoTerm = Math.floor((parseISODate(todayStr).getTime() - termStart.getTime()) / 86400000);
    const weekNumber = Math.min(TERM_WEEKS, Math.max(1, Math.floor(daysIntoTerm / 7) + 1));
    const term: TermMeta = {
      startDate: toISODate(termStart),
      endDate: toISODate(termEnd),
      weekNumber,
      weeksTotal: TERM_WEEKS,
      label: seasonLabel(termStart),
    };

    // Build Term Heatmap Grid (14 weeks × 5 class days)
    const termGrid: Array<{
      date: string;
      week: number;
      dayIndex: number;
      dayLabel: string;
      status: "full" | "partial" | "missed" | "today" | "scheduled";
      presentCount: number;
      lateCount: number;
      absentCount: number;
      totalSessions: number;
    }> = [];

    for (let w = 1; w <= TERM_WEEKS; w++) {
      for (let d = 0; d < 5; d++) {
        const currentDate = addDays(termStart, (w - 1) * 7 + d);
        const dateStr = toISODate(currentDate);
        const dayLabel = ["Mon", "Tue", "Wed", "Thu", "Fri"][d];

        const dayLogs = rawLogs.filter((l) => l.sessionDate === dateStr);
        const pres = dayLogs.filter((l) => l.status === "PRESENT").length;
        const lte = dayLogs.filter((l) => l.status === "LATE").length;
        const abs = dayLogs.filter((l) => l.status === "ABSENT").length;
        const total = dayLogs.length;

        let gridStatus: "full" | "partial" | "missed" | "today" | "scheduled" = "scheduled";
        if (dateStr === todayStr) {
          gridStatus = "today";
        } else if (dateStr < todayStr && total > 0) {
          if (pres === 0 && lte === 0 && abs > 0) gridStatus = "missed";
          else if (abs > 0 || lte > 0) gridStatus = "partial";
          else gridStatus = "full";
        }

        termGrid.push({
          date: dateStr,
          week: w,
          dayIndex: d,
          dayLabel,
          status: gridStatus,
          presentCount: pres,
          lateCount: lte,
          absentCount: abs,
          totalSessions: total,
        });
      }
    }

    // Today's real schedule: courses meeting today + their live log status
    const todayDayName = DAY_NAMES[parseISODate(todayStr).getDay()];
    const todaySchedule: TodaySession[] = rawCourses
      .filter((c) => c.scheduleDays.includes(todayDayName))
      .map((c) => {
        const log = rawLogs.find((l) => l.courseId === c.courseId && l.sessionDate === todayStr);
        return {
          courseId: c.courseId,
          courseCode: c.courseCode,
          title: c.title,
          startTime: c.startTime,
          durationMins: c.durationMins,
          room: c.location,
          logId: log?.logId ?? null,
          status: log?.status ?? "SCHEDULED",
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return NextResponse.json({
      success: true,
      source: "lakehouse",
      term,
      stats: {
        overallPct,
        attendedCount: totalPresent + totalLate,
        missedCount: totalAbsent,
        lateCount: totalLate,
        presentCount: totalPresent,
        scheduledCount: rawLogs.filter((l) => l.status === "SCHEDULED").length,
        totalSessionsToDate: totalToDate,
        streakDays: streak,
        atRiskCoursesCount: courses.filter((c) => c.isAtRisk).length,
      },
      weekdayRates,
      courses,
      termGrid,
      todaySchedule,
    });
  } catch (err: any) {
    console.error("[Attendance API Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const safeUid = userId.replace(/'/g, "''");

    const body = await req.json();
    const { logId, courseId, sessionDate, newStatus, advanceDate } = body;

    // Day-advance mode: cycle every session on that date one step forward.
    if (advanceDate) {
      const safeDate = String(advanceDate).replace(/'/g, "''");
      const sql = `
        MERGE INTO workspace.campus_explorer.student_attendance_logs AS t
        USING (
          SELECT log_id,
                 CASE status
                   WHEN 'PRESENT' THEN 'LATE'
                   WHEN 'LATE' THEN 'ABSENT'
                   WHEN 'ABSENT' THEN 'PRESENT'
                   ELSE status
                 END AS next_status
          FROM workspace.campus_explorer.student_attendance_logs
          WHERE student_id = '${safeUid}' AND session_date = '${safeDate}' AND status != 'SCHEDULED'
        ) AS src
        ON t.log_id = src.log_id
        WHEN MATCHED THEN UPDATE SET t.status = src.next_status, t.created_at = current_timestamp()
      `;
      const result = await executeLakehouseSql(sql);
      if (result.state !== "SUCCEEDED") {
        return NextResponse.json({ success: false, error: result.error || "Update failed" }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        advancedDate: safeDate,
        message: `Advanced all sessions on ${safeDate}.`,
      });
    }

    const validStatus = String(newStatus || "PRESENT").toUpperCase() as AttendanceStatus;
    if (!["PRESENT", "LATE", "ABSENT", "SCHEDULED"].includes(validStatus)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }
    if (!logId && !(courseId && sessionDate)) {
      return NextResponse.json(
        { success: false, error: "Provide logId, or courseId + sessionDate" },
        { status: 400 }
      );
    }

    const safeLogId = logId ? String(logId).replace(/'/g, "''") : `LOG-${safeUid.slice(-6)}-${String(courseId).replace(/[^A-Za-z0-9-]/g, "")}-${String(sessionDate).replace(/-/g, "")}`;
    const safeCourse = String(courseId || "").replace(/'/g, "''");
    const safeDate = String(sessionDate || "").replace(/'/g, "''");

    const sql = `
      MERGE INTO workspace.campus_explorer.student_attendance_logs AS target
      USING (
        SELECT '${safeLogId}' AS log_id, '${safeUid}' AS student_id, '${safeCourse}' AS course_id, DATE '${safeDate}' AS session_date, '${validStatus}' AS status
      ) AS src
      ON target.student_id = src.student_id AND target.course_id = src.course_id AND target.session_date = src.session_date
      WHEN MATCHED THEN
        UPDATE SET target.status = src.status, target.created_at = current_timestamp()
      WHEN NOT MATCHED THEN
        INSERT (log_id, student_id, course_id, session_date, status, created_at)
        VALUES (src.log_id, src.student_id, src.course_id, src.session_date, src.status, current_timestamp())
    `;

    const result = await executeLakehouseSql(sql);
    if (result.state !== "SUCCEEDED") {
      return NextResponse.json({ success: false, error: result.error || "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: {
        logId: safeLogId,
        courseId: safeCourse,
        sessionDate: safeDate,
        status: validStatus,
      },
      message: `Session record updated to ${validStatus} in Databricks Lakehouse.`,
    });
  } catch (err: any) {
    console.error("[Update Attendance Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
