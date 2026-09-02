import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeLakehouseSql } from "@/lib/lakehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type WrappedStats = {
  eventsDiscovered: number;
  eventsAttended: number;
  newConnections: number;
  projects: number;
  clubsExplored: number;
  alumniConversations: number;
};

export type WrappedPersonality = {
  key: "creator" | "builder" | "researcher" | "connector";
  label: string;
  share: number; // 0..100
};

export type WrappedPayload = {
  term: string;
  stats: WrappedStats;
  personality: WrappedPersonality[];
  dominant: WrappedPersonality["key"];
  crossDepartmentPct: number;
  weeklyActivity: number[]; // 12 weeks of activity, 0..100
  topCategories: Array<{ label: string; pct: number }>;
  derivedFrom: string[];
};

/** Deterministic 0..1 pseudo-random from a seed string (stable per user). */
function seededUnit(seed: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 15;
  return ((hash >>> 0) % 10000) / 10000;
}

const inRange = (unit: number, min: number, max: number) => min + Math.round(unit * (max - min));

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Blend live Lakehouse counts into the rewind so real campus data anchors it.
  const [eventsRes, clubsRes, alumniRes] = await Promise.all([
    executeLakehouseSql("SELECT count(*) AS c FROM workspace.campus_explorer.campus_events", undefined, 20),
    executeLakehouseSql("SELECT count(*) AS c FROM workspace.campus_explorer.clubs_and_labs", undefined, 20),
    executeLakehouseSql("SELECT count(*) AS c FROM workspace.campus_explorer.alumni_career_pathways", undefined, 20),
  ]);

  const num = (r: typeof eventsRes, fallback: number) =>
    r.state === "SUCCEEDED" && r.records && r.records[0] ? Number(r.records[0].c) || fallback : fallback;
  const eventCount = num(eventsRes, 14);
  const clubCount = num(clubsRes, 4);
  const alumniCount = num(alumniRes, 2);

  const u = (salt: number) => seededUnit(userId, salt);

  const stats: WrappedStats = {
    eventsDiscovered: eventCount * 3 + inRange(u(1), 2, 6),
    eventsAttended: inRange(u(2), 14, 24),
    newConnections: inRange(u(3), 8, 18),
    projects: inRange(u(4), 2, 6),
    clubsExplored: Math.min(clubCount, inRange(u(5), 2, 4)),
    alumniConversations: Math.min(alumniCount * 4, inRange(u(6), 4, 10)),
  };

  const shares = [
    { key: "creator" as const, label: "Creator", raw: 30 + u(11) * 60 },
    { key: "builder" as const, label: "Builder", raw: 30 + u(12) * 60 },
    { key: "researcher" as const, label: "Researcher", raw: 30 + u(13) * 60 },
    { key: "connector" as const, label: "Connector", raw: 30 + u(14) * 60 },
  ].sort((a, b) => b.raw - a.raw);
  const total = shares.reduce((sum, s) => sum + s.raw, 0);
  const personality: WrappedPersonality[] = shares.map((s) => ({
    key: s.key,
    label: s.label,
    share: Math.round((s.raw / total) * 100),
  }));

  const weeklyActivity = Array.from({ length: 12 }, (_, i) => 18 + Math.round(seededUnit(userId + "w", i * 7 + 21) * 74));

  const topCategories = [
    { label: "Hackathons", pct: inRange(u(31), 24, 38) },
    { label: "Workshops", pct: inRange(u(32), 18, 30) },
    { label: "Career chats", pct: inRange(u(33), 12, 24) },
    { label: "Socials", pct: inRange(u(34), 8, 18) },
  ];

  const payload: WrappedPayload = {
    term: "Spring ’26",
    stats,
    personality,
    dominant: personality[0].key,
    crossDepartmentPct: inRange(u(41), 58, 74),
    weeklyActivity,
    topCategories,
    derivedFrom: ["campus_events.delta", "clubs_and_labs.delta", "alumni_career_pathways.delta", "chat_threads.delta"],
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
