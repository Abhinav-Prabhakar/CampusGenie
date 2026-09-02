import { NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AwardRecord = {
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

export type AwardsPayload = {
  events: Array<{ id: string; title: string; category: string; winners: number }>;
  awards: AwardRecord[];
};

export async function GET() {
  const result = await executeLakehouseSql(
    "SELECT * FROM workspace.campus_explorer.event_awards ORDER BY event_id ASC, position ASC",
    undefined,
    50
  );

  if (result.state !== "SUCCEEDED" || !result.records) {
    return NextResponse.json(
      { error: result.error || `Lakehouse query failed with state: ${result.state}` },
      { status: 500 }
    );
  }

  const awards: AwardRecord[] = result.records.map((r: Record<string, unknown>) => ({
    id: String(r.award_id ?? ""),
    eventId: String(r.event_id ?? ""),
    eventTitle: String(r.event_title ?? ""),
    position: (Number(r.position) === 2 || Number(r.position) === 3 ? Number(r.position) : 1) as 1 | 2 | 3,
    winnerName: String(r.winner_name ?? ""),
    winnerStudentId: String(r.winner_student_id ?? ""),
    teamName: String(r.team_name ?? "—"),
    projectTitle: String(r.project_title ?? ""),
    prize: String(r.prize ?? ""),
    category: String(r.category ?? ""),
    awardedAt: r.awarded_at ? String(r.awarded_at) : "",
  }));

  const byEvent = new Map<string, AwardsPayload["events"][number]>();
  for (const award of awards) {
    const existing = byEvent.get(award.eventId);
    if (existing) {
      existing.winners += 1;
    } else {
      byEvent.set(award.eventId, { id: award.eventId, title: award.eventTitle, category: award.category, winners: 1 });
    }
  }

  const payload: AwardsPayload = {
    events: Array.from(byEvent.values()),
    awards,
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
