import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  setUserCollege,
  setUserPhoneNumber,
  DEFAULT_COLLEGE,
} from "@/lib/appUsers";
import { parseSelfProfileUpdate } from "@/lib/userProfileUpdate";

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

    const parsed = parseSelfProfileUpdate(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { college: rawCollege, phoneNumber: rawPhone } = parsed.update;
    const wantsCollege = rawCollege !== undefined;
    const wantsPhone = rawPhone !== undefined;

    let updated = { ...user, college: user.college || DEFAULT_COLLEGE };

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
      : `College updated to ${rawCollege} in Databricks Lakehouse.`;

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
