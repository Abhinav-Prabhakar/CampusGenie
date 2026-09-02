import { NextRequest, NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { getCurrentUser } from "@/lib/appUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Submit a mentorship intro request for one alumnus. One pending request per student/alumnus pair. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const alumniId = String(body.alumniId ?? "").trim();
    const note = String(body.note ?? "").trim().slice(0, 500);
    if (!alumniId) {
      return NextResponse.json({ error: "alumniId is required" }, { status: 400 });
    }

    // Verify the alumnus exists so we never persist a dangling request.
    const lookup = await executeLakehouseSql(
      "SELECT alumni_id FROM workspace.campus_explorer.alumni_career_pathways WHERE alumni_id = :alumni_id",
      undefined,
      20,
      [{ name: "alumni_id", value: alumniId }]
    );
    if (lookup.state !== "SUCCEEDED" || !lookup.records?.length) {
      return NextResponse.json({ error: "Unknown alumnus" }, { status: 400 });
    }

    const existing = await executeLakehouseSql(
      `SELECT request_id FROM workspace.campus_explorer.alumni_intro_requests
       WHERE user_id = :user_id AND alumni_id = :alumni_id AND status = 'pending'`,
      undefined,
      20,
      [{ name: "user_id", value: user.userId }, { name: "alumni_id", value: alumniId }]
    );
    if (existing.state === "SUCCEEDED" && (existing.records?.length ?? 0) > 0) {
      return NextResponse.json({ error: "You already have a pending intro request with this alumnus." }, { status: 409 });
    }

    const requestId = `INT-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0")}`;
    const res = await executeLakehouseSql(
      `INSERT INTO workspace.campus_explorer.alumni_intro_requests (request_id, user_id, alumni_id, note, status, created_at)
       VALUES (:request_id, :user_id, :alumni_id, :note, 'pending', current_timestamp())`,
      undefined,
      20,
      [
        { name: "request_id", value: requestId },
        { name: "user_id", value: user.userId },
        { name: "alumni_id", value: alumniId },
        { name: "note", value: note },
      ]
    );

    if (res.state !== "SUCCEEDED") {
      console.error("[Alumni Intro POST] insert failed:", res.error);
      return NextResponse.json({ error: "Lakehouse write failed — please try again." }, { status: 500 });
    }

    return NextResponse.json({ requestId, status: "pending" });
  } catch (err: any) {
    console.error("[Alumni Intro POST]", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
