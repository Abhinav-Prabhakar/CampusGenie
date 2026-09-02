import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRetry } from "@/lib/llm";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, getClientIdFromHeaders } from "@/lib/rateLimiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type RecoveryMilestone = {
  label: string;
  targetAttendancePct: number;
  remainingSessionsNeeded: number;
  maxAllowedAbsences: number;
  status: "MINIMUM" | "SAFE" | "OPTIMAL";
  description: string;
};

export type RecoveryActionItem = {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  category: "alarms" | "appeal" | "office_hours" | "buddy" | "study";
  actionButtonLabel: string;
  actionDoneLabel: string;
  details?: string;
};

export type DynamicRecoveryPlan = {
  courseCode: string;
  courseName: string;
  instructor: string;
  location: string;
  scheduleTime: string;
  currentSessions: number;
  attendedSessions: number;
  totalTermSessions: number;
  cutoffPercentage: number;
  currentPercentage: number;
  remainingSessions: number;
  minRemainingToAttend: number;
  allowedAbsences: number;
  projectedMaxPct: number;
  riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "SAFE";
  executiveSummary: string;
  milestones: RecoveryMilestone[];
  actionItems: RecoveryActionItem[];
  instructorStrategy: {
    officeHoursSlot: string;
    talkingPoints: string[];
    makeupPolicyNote: string;
  };
  generatedBy: "llm" | "deterministic";
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const rateLimit = await checkRateLimit(userId || getClientIdFromHeaders(req.headers), {
      scope: "attendance-recovery",
      rpm: 5,
      rpd: 50,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many recovery-plan requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds || 60) } }
      );
    }
    const body = await req.json();
    const courseCode = body.courseCode || "MATH 201";
    const courseName = body.courseName || "Linear Algebra";
    const instructor = body.instructor || "Dr. Okafor";
    const location = body.location || "Hart 112";
    const scheduleTime = body.scheduleTime || "Mon, Wed, Fri 09:00 AM";
    const currentSessions = Number(body.currentSessions) || 20;
    const attendedSessions = Number(body.attendedSessions) || 14;
    const totalTermSessions = Number(body.totalTermSessions) || 42;
    const cutoffPercentage = Number(body.cutoffPercentage) || 75;

    // Mathematical calculations
    const remainingSessions = Math.max(1, totalTermSessions - currentSessions);
    const currentPercentage = Math.round((attendedSessions / currentSessions) * 100);
    const targetTotalAttended = Math.ceil(totalTermSessions * (cutoffPercentage / 100));
    const minRemainingToAttend = Math.max(0, Math.min(remainingSessions, targetTotalAttended - attendedSessions));
    const allowedAbsences = Math.max(0, remainingSessions - minRemainingToAttend);
    const projectedMaxPct = Math.round(((attendedSessions + remainingSessions) / totalTermSessions) * 100);

    const isAtRisk = currentPercentage < cutoffPercentage;
    const riskLevel: DynamicRecoveryPlan["riskLevel"] =
      currentPercentage < 65 ? "CRITICAL" : currentPercentage < 75 ? "HIGH" : currentPercentage < 80 ? "MODERATE" : "SAFE";

    // Build Default Deterministic Milestones
    const milestones: RecoveryMilestone[] = [
      {
        label: "Minimum Exam Pass",
        targetAttendancePct: Math.round(((attendedSessions + minRemainingToAttend) / totalTermSessions) * 100 * 10) / 10,
        remainingSessionsNeeded: minRemainingToAttend,
        maxAllowedAbsences: allowedAbsences,
        status: "MINIMUM",
        description: `Attend ${minRemainingToAttend} of the next ${remainingSessions} sessions to clear the ${cutoffPercentage}% final cutoff.`,
      },
      {
        label: "Safe Buffer Zone",
        targetAttendancePct: Math.min(100, Math.round(((attendedSessions + Math.min(remainingSessions, minRemainingToAttend + 2)) / totalTermSessions) * 100 * 10) / 10),
        remainingSessionsNeeded: Math.min(remainingSessions, minRemainingToAttend + 2),
        maxAllowedAbsences: Math.max(0, allowedAbsences - 2),
        status: "SAFE",
        description: `Attend ${Math.min(remainingSessions, minRemainingToAttend + 2)} sessions to establish a safety cushion against unexpected sick days.`,
      },
      {
        label: "Optimal Performance",
        targetAttendancePct: projectedMaxPct,
        remainingSessionsNeeded: remainingSessions,
        maxAllowedAbsences: 0,
        status: "OPTIMAL",
        description: `Attend all ${remainingSessions} remaining sessions to graduate with maximum participation marks (${projectedMaxPct}%).`,
      },
    ];

    // Default Action Items
    const defaultActions: RecoveryActionItem[] = [
      {
        id: "act-1",
        stepNumber: 1,
        title: `Automate Push Alarms for ${scheduleTime}`,
        description: `30-minute early wake-up and transit notifications for ${courseCode} in ${location}.`,
        category: "alarms",
        actionButtonLabel: "Enable Calendar Alarms",
        actionDoneLabel: "✓ Alarms Scheduled",
      },
      {
        id: "act-2",
        stepNumber: 2,
        title: "Submit Absence Appeal / Medical Note",
        description: "Submit documentation for up to 2 past missed sessions to immediately restore +4.8% attendance credit.",
        category: "appeal",
        actionButtonLabel: "Attach Verification Note",
        actionDoneLabel: "✓ Note Submitted",
      },
      {
        id: "act-3",
        stepNumber: 3,
        title: `Book 1-on-1 Office Hours with ${instructor}`,
        description: "Review missed problem sets and confirm class participation makeup policies.",
        category: "office_hours",
        actionButtonLabel: "Book Office Hours Slot",
        actionDoneLabel: "✓ Slot Confirmed",
      },
      {
        id: "act-4",
        stepNumber: 4,
        title: "Peer Roll-Call Check-in Partner",
        description: `Pair with a classmate in ${location} for morning seat reservations and lecture notes exchange.`,
        category: "buddy",
        actionButtonLabel: "Connect with Partner",
        actionDoneLabel: "✓ Partner Connected",
      },
    ];

    const dynamicPlan: DynamicRecoveryPlan = {
      courseCode,
      courseName,
      instructor,
      location,
      scheduleTime,
      currentSessions,
      attendedSessions,
      totalTermSessions,
      cutoffPercentage,
      currentPercentage,
      remainingSessions,
      minRemainingToAttend,
      allowedAbsences,
      projectedMaxPct,
      riskLevel,
      executiveSummary: `Current attendance is ${currentPercentage}% (${attendedSessions}/${currentSessions} sessions). You must attend at least ${minRemainingToAttend} of the remaining ${remainingSessions} lectures to clear the ${cutoffPercentage}% exam eligibility threshold.`,
      milestones,
      actionItems: defaultActions,
      instructorStrategy: {
        officeHoursSlot: "Tuesdays 14:00 - 15:30",
        talkingPoints: [
          `Acknowledge the current ${currentPercentage}% attendance deficit proactively.`,
          "Request permission to submit homework solutions for missed lecture dates.",
          "Confirm required attendance count for final exam admission voucher.",
        ],
        makeupPolicyNote: "Department allows up to 2 excused medical/official absences with Dean of Students approval.",
      },
      generatedBy: "deterministic",
    };

    // Try calling LLM in JSON mode for custom personalized recommendations
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.DATABRICKS_TOKEN;
    const endpoint = process.env.LLM_BASE_URL
      ? `${process.env.LLM_BASE_URL.replace(/\/+$/, "")}/chat/completions`
      : "https://api.openai.com/v1/chat/completions";
    const model = process.env.LLM_MODEL || "gpt-4o";

    if (apiKey) {
      try {
        const systemPrompt = `You are the AI Academic Recovery Advisor at Databricks University.
Generate a tailored, realistic, student-focused attendance and study recovery plan in JSON format.
Always output pure valid JSON matching the schema.`;

        const userPrompt = `Generate a recovery plan for:
Course: ${courseCode} (${courseName})
Instructor: ${instructor}
Location: ${location}
Schedule: ${scheduleTime}
Current Status: ${attendedSessions}/${currentSessions} sessions attended (${currentPercentage}%). Cutoff is ${cutoffPercentage}%.
Remaining Sessions: ${remainingSessions}.
Required Minimum: ${minRemainingToAttend} of ${remainingSessions} to attend.

Provide a JSON response with:
{
  "executiveSummary": "...",
  "riskLevel": "${riskLevel}",
  "actionItems": [
    {
      "id": "act-1",
      "stepNumber": 1,
      "title": "...",
      "description": "...",
      "category": "alarms",
      "actionButtonLabel": "...",
      "actionDoneLabel": "..."
    },
    ... (4 steps)
  ],
  "instructorStrategy": {
    "officeHoursSlot": "...",
    "talkingPoints": ["...", "...", "..."],
    "makeupPolicyNote": "..."
  }
}`;

        const res = await fetchWithAutoRetry(
          endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.3,
            }),
          },
          1,
          500
        );

        if (res.ok) {
          const data = await res.json();
          const rawContent = data.choices?.[0]?.message?.content;
          if (rawContent) {
            const parsed = JSON.parse(rawContent);
            if (parsed.executiveSummary) dynamicPlan.executiveSummary = parsed.executiveSummary;
            if (Array.isArray(parsed.actionItems) && parsed.actionItems.length >= 3) {
              dynamicPlan.actionItems = parsed.actionItems;
            }
            if (parsed.instructorStrategy) {
              dynamicPlan.instructorStrategy = parsed.instructorStrategy;
            }
            dynamicPlan.generatedBy = "llm";
          }
        }
      } catch (llmErr) {
        console.warn("[LLM Recovery Plan Fallback]", llmErr);
      }
    }

    return NextResponse.json({
      success: true,
      plan: dynamicPlan,
    });
  } catch (err: any) {
    console.error("[Recovery Plan API Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
