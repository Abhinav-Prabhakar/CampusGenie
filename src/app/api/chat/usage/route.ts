import { NextRequest, NextResponse } from "next/server";
import { getClientIdFromHeaders, getRateLimitUsage } from "@/lib/rateLimiter";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only view of the caller's chat quota (RPM/RPD) as tracked by the
 * in-memory rate limiter. Does not consume quota.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const clientId = userId || getClientIdFromHeaders(req.headers);
  const usage = await getRateLimitUsage(clientId, { scope: "chat" });
  return NextResponse.json(
    { usage },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
