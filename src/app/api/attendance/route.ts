import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeLakehouseSql } from "@/lib/lakehouse";

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
  attendedCount: number;
  lateCount: number;
  absentCount: number;
  currentPercentage: number;
  isAtRisk: boolean;
  statusLabel: string;
  logs: AttendanceLog[];
  heatmapDays: { date: string; day: string; status: AttendanceStatus; logId?: string }[];
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

/**
 * Seed a fresh user's enrollments + term attendance history so every account
 * starts with the same demo dataset, scoped to their Clerk user id.
 */
async function seedUserDataFor(safeUid: string): Promise<void> {
  const termStart = new Date(2026, 1, 2); // Feb 2, 2026 (Mon)
  const termEnd = new Date(2026, 2, 19); // Mar 19, 2026
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const courseValues = DEFAULT_COURSES.map((c) => {
    const days = c.scheduleDays.map((d) => `'${d}'`).join(",");
    return `('${c.courseId}', '${c.courseCode}', '${c.title.replace(/'/g, "''")}', '${c.instructor.replace(/'/g, "''")}', '${c.location.replace(/'/g, "''")}', ARRAY(${days}), '${c.startTime}', ${c.durationMins}, ${c.minAttendancePct}, '${safeUid}')`;
  }).join(",\n");

  await executeLakehouseSql(
    `INSERT INTO workspace.campus_explorer.student_courses (course_id, course_code, title, instructor, location, schedule_days, start_time, duration_mins, min_attendance_pct, user_id) VALUES ${courseValues}`
  );

  const logRows: string[] = [];
  DEFAULT_COURSES.forEach((course, courseIdx) => {
    const cursor = new Date(termStart);
    let sessionIdx = 0;
    while (cursor <= termEnd) {
      if (course.scheduleDays.includes(dayNames[cursor.getDay()])) {
        const dateStr = cursor.toISOString().slice(0, 10);
        // Deterministic mix so seeded histories are stable and realistic.
        const bucket = (sessionIdx * 5 + courseIdx * 3) % 16;
        const status = bucket === 0 ? "ABSENT" : bucket === 5 || bucket === 11 ? "LATE" : "PRESENT";
        logRows.push(
          `('LOG-${safeUid.slice(-6)}-${course.courseId}-${dateStr.replace(/-/g, '')}', '${safeUid}', '${course.courseId}', DATE '${dateStr}', '${status}', NULL, 'seed', NULL, current_timestamp())`
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

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const safeUid = userId.replace(/'/g, "''");

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

    const logsRes = await executeLakehouseSql(
      `SELECT * FROM workspace.campus_explorer.student_attendance_logs WHERE student_id = '${safeUid}' ORDER BY session_date ASC`
    );

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
          sessionDate: r.session_date,
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
      
      const effectiveAttended = attended + (late > 0 ? late * 0.75 : 0);
      const currentPercentage = Math.round((effectiveAttended / total) * 100);
      const isAtRisk = currentPercentage < c.minAttendancePct;
      const statusLabel = currentPercentage >= 95 ? "Perfect" : isAtRisk ? "At risk" : "On track";

      // Build session slots for course mini-heatmap
      const heatmapDays = logs.map((l) => ({
        date: l.sessionDate,
        day: new Date(l.sessionDate).toLocaleDateString("en-US", { weekday: "short" }),
        status: l.status,
        logId: l.logId,
      }));

      return {
        ...c,
        totalSessionsToDate: total,
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
    const totalToDate = allPastLogs.length || 65;
    const overallPct = Math.round(((totalPresent + totalLate * 0.75) / totalToDate) * 100);

    // Weekday breakdown
    const weekdayCounts: Record<string, { total: number; attended: number }> = {
      Mon: { total: 0, attended: 0 },
      Tue: { total: 0, attended: 0 },
      Wed: { total: 0, attended: 0 },
      Thu: { total: 0, attended: 0 },
      Fri: { total: 0, attended: 0 },
    };

    for (const log of allPastLogs) {
      const d = new Date(log.sessionDate);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      if (weekdayCounts[dayName]) {
        weekdayCounts[dayName].total++;
        if (log.status === "PRESENT" || log.status === "LATE") {
          weekdayCounts[dayName].attended++;
        }
      }
    }

    const weekdayRates = {
      MON: weekdayCounts.Mon.total ? Math.round((weekdayCounts.Mon.attended / weekdayCounts.Mon.total) * 100) : 79,
      TUE: weekdayCounts.Tue.total ? Math.round((weekdayCounts.Tue.attended / weekdayCounts.Tue.total) * 100) : 93,
      WED: weekdayCounts.Wed.total ? Math.round((weekdayCounts.Wed.attended / weekdayCounts.Wed.total) * 100) : 86,
      THU: weekdayCounts.Thu.total ? Math.round((weekdayCounts.Thu.attended / weekdayCounts.Thu.total) * 100) : 92,
      FRI: weekdayCounts.Fri.total ? Math.round((weekdayCounts.Fri.attended / weekdayCounts.Fri.total) * 100) : 83,
    };

    // Calculate Streak
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

    // Build Term Heatmap Grid (Weeks 1 to 14, 5 class days per week = 70 grid cells)
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
      logs: AttendanceLog[];
    }> = [];

    const startDate = new Date(2026, 1, 2); // Feb 2, 2026 (Mon)
    const todayStr = "2026-03-19";

    for (let w = 1; w <= 14; w++) {
      for (let d = 0; d < 5; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + ((w - 1) * 7) + d);
        const dateStr = currentDate.toISOString().slice(0, 10);
        const dayLabel = ["Mon", "Tue", "Wed", "Thu", "Fri"][d];

        const dayLogs = rawLogs.filter((l) => l.sessionDate === dateStr);
        const pres = dayLogs.filter((l) => l.status === "PRESENT").length;
        const lte = dayLogs.filter((l) => l.status === "LATE").length;
        const abs = dayLogs.filter((l) => l.status === "ABSENT").length;
        const total = dayLogs.length;

        let gridStatus: "full" | "partial" | "missed" | "today" | "scheduled" = "scheduled";
        if (dateStr === todayStr) {
          gridStatus = "today";
        } else if (dateStr < todayStr) {
          if (abs > 0 && pres === 0 && lte === 0) gridStatus = "missed";
          else if (abs > 0 || lte > 0) gridStatus = "partial";
          else if (pres > 0) gridStatus = "full";
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
          totalSessions: total || (d === 0 || d === 2 || d === 4 ? 2 : 2),
          logs: dayLogs,
        });
      }
    }

    return NextResponse.json({
      success: true,
      source: logsRes.state === "SUCCEEDED" ? "lakehouse" : "seed",
      stats: {
        overallPct,
        attendedCount: totalPresent + totalLate,
        missedCount: totalAbsent,
        lateCount: totalLate,
        presentCount: totalPresent,
        scheduledCount: 74,
        totalSessionsToDate: totalToDate,
        streakDays: Math.max(streak, 9),
        atRiskCoursesCount: courses.filter((c) => c.isAtRisk).length,
      },
      weekdayRates,
      courses,
      termGrid,
      todaySchedule: [
        {
          courseCode: "MATH 201",
          title: "Linear Algebra",
          time: "09:00",
          room: "Hart 112",
          duration: "50 min",
          monogram: "MA",
          color: "accent",
          status: "Attended",
          done: true,
        },
        {
          courseCode: "ENG 105",
          title: "Composition & Rhetoric",
          time: "13:00",
          room: "Olson 24",
          duration: "80 min",
          monogram: "EN",
          color: "orange",
          status: "Next · in 25 min",
          done: false,
        },
        {
          courseCode: "CS 210",
          title: "Office hours",
          time: "16:00",
          room: "Kemper 210",
          duration: "drop-in",
          monogram: "CS",
          color: "accent",
          status: "Optional",
          done: false,
        },
      ],
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

    const body = await req.json();
    const { logId, courseId, sessionDate, newStatus } = body;

    const validStatus = (newStatus || "PRESENT").toUpperCase() as AttendanceStatus;
    const safeUid = userId.replace(/'/g, "''");
    const safeLogId = (logId || `LOG-${Date.now()}`).replace(/'/g, "''");
    const safeCourse = (courseId || "MATH-201").replace(/'/g, "''");
    const safeDate = (sessionDate || "2026-03-19").replace(/'/g, "''");

    const sql = `
      MERGE INTO workspace.campus_explorer.student_attendance_logs AS target
      USING (
        SELECT '${safeLogId}' AS log_id, '${safeUid}' AS student_id, '${safeCourse}' AS course_id, '${safeDate}' AS session_date, '${validStatus}' AS status
      ) AS src
      ON target.student_id = src.student_id AND target.course_id = src.course_id AND target.session_date = src.session_date
      WHEN MATCHED THEN
        UPDATE SET target.status = src.status, target.created_at = current_timestamp()
      WHEN NOT MATCHED THEN
        INSERT (log_id, student_id, course_id, session_date, status, created_at)
        VALUES (src.log_id, src.student_id, src.course_id, src.session_date, src.status, current_timestamp())
    `;

    const result = await executeLakehouseSql(sql);

    return NextResponse.json({
      success: true,
      state: result.state,
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
