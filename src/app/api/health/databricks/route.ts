import { NextResponse } from "next/server";
import { createDatabricksClient, toPublicDatabricksError } from "@/lib/databricks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = createDatabricksClient();
    const space = await client.request<{ title?: string }>(
      `/api/2.0/genie/spaces/${encodeURIComponent(client.config.genieSpaceId)}`,
      {},
      10_000,
    );
    return NextResponse.json({
      ok: true,
      status: "ready",
      agent: space.title || client.config.genieAgentName,
      warehouseConfigured: true,
      source: "databricks_live",
    });
  } catch (error) {
    const safe = toPublicDatabricksError(error);
    return NextResponse.json({
      ...safe.body,
      status: safe.body.error.code === "NOT_CONFIGURED" ? "not_configured" : "unavailable",
      warehouseConfigured: false,
    }, { status: safe.status });
  }
}
