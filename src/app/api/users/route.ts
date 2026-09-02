import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, setUserRole, isValidRole } from "@/lib/appUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    if (!isValidRole(body.role)) {
      return NextResponse.json({ error: "role must be 'student' or 'admin'" }, { status: 400 });
    }

    const ok = await setUserRole(user.userId, body.role);
    if (!ok) {
      return NextResponse.json({ error: "Failed to persist role to Lakehouse" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: { ...user, role: body.role },
      message: `Access level updated to ${body.role} in Databricks Lakehouse.`,
    });
  } catch (err: any) {
    console.error("[Update User Role Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
