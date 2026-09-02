import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeLakehouseSql } from "@/lib/lakehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type TeammateProfile = {
  id: string;
  name: string;
  year: string;
  major: string;
  college: string;
  seeking: "hackathon" | "project" | "study";
  bio: string;
  skills: string[];
  availabilityNote: string;
  commitmentNote: string;
  stats: { collaboration: number; availability: number; skillDepth: number; consistency: number };
  contactHint: string;
};

function sqlString(value: string | null | undefined): string {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function mapRow(r: Record<string, unknown>): TeammateProfile {
  const skills: string[] = Array.isArray(r.skills) ? r.skills.map(String) : [];
  return {
    id: String(r.profile_id ?? ""),
    name: String(r.name ?? "Student"),
    year: String(r.year ?? ""),
    major: String(r.major ?? ""),
    college: String(r.college ?? ""),
    seeking: (r.seeking === "project" || r.seeking === "study" ? r.seeking : "hackathon") as TeammateProfile["seeking"],
    bio: String(r.bio ?? ""),
    skills,
    availabilityNote: String(r.availability_note ?? ""),
    commitmentNote: String(r.commitment_note ?? ""),
    stats: {
      collaboration: Number(r.collaboration) || 50,
      availability: Number(r.availability) || 50,
      skillDepth: Number(r.skill_depth) || 50,
      consistency: Number(r.consistency) || 50,
    },
    contactHint: String(r.contact_hint ?? ""),
  };
}

/** Deterministic mutual-match flag so a liked profile "matches back" stably. */
function isMutualMatch(userId: string, profileId: string): boolean {
  let hash = 0;
  const key = userId + profileId;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 5 < 3; // ~60% of likes become mutual matches
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const [profilesRes, swipesRes] = await Promise.all([
    executeLakehouseSql("SELECT * FROM workspace.campus_explorer.teammate_profiles ORDER BY profile_id ASC", undefined, 50),
    executeLakehouseSql(
      `SELECT profile_id FROM workspace.campus_explorer.teammate_swipes WHERE user_id = ${sqlString(userId)}`,
      undefined,
      50
    ),
  ]);

  if (profilesRes.state !== "SUCCEEDED" || !profilesRes.records) {
    return NextResponse.json(
      { error: profilesRes.error || `Lakehouse query failed with state: ${profilesRes.state}` },
      { status: 500 }
    );
  }

  const swiped = new Set(
    swipesRes.state === "SUCCEEDED" && swipesRes.records ? swipesRes.records.map((r) => String(r.profile_id)) : []
  );
  const profiles = profilesRes.records.map(mapRow);
  const queue = profiles.filter((p) => !swiped.has(p.id));
  const liked = profiles.filter((p) => swiped.has(p.id)).length;

  return NextResponse.json(
    { queue, total: profiles.length, reviewed: swiped.size, liked },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const profileId = String(body.profileId ?? "");
    const action = body.action === "pass" ? "pass" : "like";
    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const merge = await executeLakehouseSql(`
      MERGE INTO workspace.campus_explorer.teammate_swipes AS target
      USING (SELECT ${sqlString(userId)} AS user_id, ${sqlString(profileId)} AS profile_id, ${sqlString(action)} AS action) AS src
      ON target.user_id = src.user_id AND target.profile_id = src.profile_id
      WHEN MATCHED THEN UPDATE SET target.action = src.action, target.created_at = current_timestamp()
      WHEN NOT MATCHED THEN INSERT (user_id, profile_id, action, created_at)
        VALUES (src.user_id, src.profile_id, src.action, current_timestamp())
    `);

    if (merge.state !== "SUCCEEDED") {
      return NextResponse.json({ error: merge.error || "Failed to save swipe" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      matched: action === "like" && isMutualMatch(userId, profileId),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Teammates API Error]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const result = await executeLakehouseSql(
    `DELETE FROM workspace.campus_explorer.teammate_swipes WHERE user_id = ${sqlString(userId)}`
  );

  return NextResponse.json({
    success: true,
    state: result.state,
    message: "Swipe history cleared — the deck deals again.",
  });
}
