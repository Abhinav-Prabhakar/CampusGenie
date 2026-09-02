import { NextRequest, NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { getCurrentUser, requireAdminUser } from "@/lib/appUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Academic & Coursework",
  "Campus Facilities & Maintenance",
  "Hostel & Residential Life",
  "Dining & Cafeteria Services",
  "Administration & Registrar",
  "IT, Lab & Library Resources",
  "Safety, Security & Accessibility",
  "Other / General Grievance",
] as const;

const URGENCIES = ["low", "medium", "high", "urgent"] as const;

type Urgency = (typeof URGENCIES)[number];

export type ComplaintRecord = {
  complaintId: string;
  title: string;
  category: string;
  location: string;
  urgency: Urgency;
  description: string;
  isAnonymous: boolean;
  status: string;
  createdAt: string | null;
  reporter: string | null; // resolved name/email for admins; null when anonymous
};

function sqlString(value: string | null | undefined): string {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function complaintId(): string {
  return `CMP-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0")}`;
}

function mapComplaint(r: Record<string, unknown>): ComplaintRecord {
  const first = typeof r.first_name === "string" ? r.first_name : null;
  const last = typeof r.last_name === "string" ? r.last_name : null;
  const email = typeof r.email === "string" ? r.email : null;
  const reporter = [first, last].filter(Boolean).join(" ") || email || null;
  return {
    complaintId: String(r.complaint_id ?? ""),
    title: String(r.title ?? ""),
    category: String(r.category ?? ""),
    location: String(r.location ?? ""),
    urgency: (URGENCIES as readonly string[]).includes(String(r.urgency)) ? (r.urgency as Urgency) : "medium",
    description: String(r.description ?? ""),
    isAnonymous: Boolean(r.is_anonymous),
    status: String(r.status ?? "open"),
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    reporter: r.is_anonymous ? null : reporter,
  };
}

/** Submit a grievance. Signed-out visitors may submit, but only anonymously. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const title = String(body.title ?? "").trim();
    const category = String(body.category ?? "").trim();
    const location = String(body.location ?? "").trim() || "General campus location";
    const urgency = String(body.urgency ?? "medium").trim();
    const description = String(body.description ?? "").trim();
    const isAnonymous = Boolean(body.isAnonymous);

    const errors: Record<string, string> = {};
    if (title.length < 5 || title.length > 100) errors.title = "Title must be 5-100 characters.";
    if (!(CATEGORIES as readonly string[]).includes(category)) errors.category = "Pick a valid category.";
    if (description.length < 15 || description.length > 500) errors.description = "Description must be 15-500 characters.";
    if (!(URGENCIES as readonly string[]).includes(urgency)) errors.urgency = "Pick a valid urgency level.";
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const user = await getCurrentUser().catch(() => null);
    const userId = !isAnonymous && user ? user.userId : null;
    const id = complaintId();

    const res = await executeLakehouseSql(
      `INSERT INTO workspace.campus_explorer.complaints (complaint_id, user_id, title, category, location, urgency, description, is_anonymous, status, created_at)
       VALUES (${sqlString(id)}, ${sqlString(userId)}, ${sqlString(title)}, ${sqlString(category)}, ${sqlString(location)}, ${sqlString(urgency)}, ${sqlString(description)}, ${isAnonymous}, 'open', current_timestamp())`,
      undefined,
      20
    );

    if (res.state !== "SUCCEEDED") {
      console.error("[Complaints POST] insert failed:", res.error);
      return NextResponse.json({ error: "Lakehouse write failed — please try again." }, { status: 500 });
    }

    return NextResponse.json({
      complaint: {
        complaintId: id,
        title,
        category,
        location,
        urgency,
        description,
        isAnonymous,
        status: "open",
        createdAt: new Date().toISOString(),
        reporter: null,
      } satisfies ComplaintRecord,
    });
  } catch (err: any) {
    console.error("[Complaints POST]", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}

/** Admin listing of every grievance with reporter identity (unless anonymous). */
export async function GET() {
  try {
    const guard = await requireAdminUser();
    if (guard.error) {
      return NextResponse.json({ error: guard.error.message }, { status: guard.error.status });
    }

    const res = await executeLakehouseSql(
      `SELECT c.*, u.first_name, u.last_name, u.email
       FROM workspace.campus_explorer.complaints c
       LEFT JOIN workspace.campus_explorer.app_users u ON c.user_id = u.user_id
       ORDER BY c.created_at DESC`,
      undefined,
      20
    );

    if (res.state !== "SUCCEEDED" || !Array.isArray(res.records)) {
      return NextResponse.json({ error: res.error || "Lakehouse query failed" }, { status: 500 });
    }

    return NextResponse.json(
      { complaints: res.records.map(mapComplaint) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: any) {
    console.error("[Complaints GET]", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
