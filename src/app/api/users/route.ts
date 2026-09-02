import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  setUserRole,
  setUserCollege,
  setUserPhoneNumber,
  isValidRole,
  DEFAULT_COLLEGE,
} from "@/lib/appUsers";

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
    const wantsRole = body.role !== undefined;
    const rawCollege = typeof body.college === "string" ? body.college.trim().slice(0, 120) : undefined;
    const wantsCollege = rawCollege !== undefined && rawCollege.length > 0;
    // phoneNumber: string sets/updates it, null clears it.
    const wantsPhone = body.phoneNumber !== undefined && (body.phoneNumber === null || typeof body.phoneNumber === "string");
    const rawPhone = typeof body.phoneNumber === "string" ? body.phoneNumber.trim().slice(0, 24) : null;

    if (wantsRole && !isValidRole(body.role)) {
      return NextResponse.json({ error: "role must be 'student' or 'admin'" }, { status: 400 });
    }
    if (!wantsRole && !wantsCollege && !wantsPhone) {
      return NextResponse.json({ error: "nothing to update — send 'role', 'college', and/or 'phoneNumber'" }, { status: 400 });
    }

    let updated = { ...user, college: user.college || DEFAULT_COLLEGE };

    if (wantsRole) {
      const ok = await setUserRole(user.userId, body.role);
      if (!ok) {
        return NextResponse.json({ error: "Failed to persist role to Lakehouse" }, { status: 500 });
      }
      updated = { ...updated, role: body.role };
    }

    if (wantsCollege) {
      const ok = await setUserCollege(user.userId, rawCollege!);
      if (!ok) {
        return NextResponse.json({ error: "Failed to persist college to Lakehouse" }, { status: 500 });
      }
      updated = { ...updated, college: rawCollege! };
    }

    if (wantsPhone) {
      const ok = await setUserPhoneNumber(user.userId, rawPhone && rawPhone.length > 0 ? rawPhone : null);
      if (!ok) {
        return NextResponse.json({ error: "Failed to persist phone number to Lakehouse" }, { status: 500 });
      }
      updated = { ...updated, phoneNumber: rawPhone && rawPhone.length > 0 ? rawPhone : null };
    }

    const message = wantsPhone
      ? "Contact details updated in Databricks Lakehouse."
      : wantsCollege
        ? `College updated to ${rawCollege} in Databricks Lakehouse.`
        : `Access level updated to ${body.role} in Databricks Lakehouse.`;

    return NextResponse.json({
      success: true,
      user: updated,
      message,
    });
  } catch (err: any) {
    console.error("[Update User Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
