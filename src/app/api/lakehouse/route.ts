import { NextRequest, NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { requireAdminUser } from "@/lib/appUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Raw arbitrary SQL execution — admin only.
    const guard = await requireAdminUser();
    if (guard.error) {
      return NextResponse.json({ error: guard.error.message }, { status: guard.error.status });
    }

    const { query, warehouseId } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing SQL query parameter" }, { status: 400 });
    }

    const result = await executeLakehouseSql(query, warehouseId);

    if (result.state === "FAILED" || result.state === "ERROR") {
      return NextResponse.json({ error: result.error || "Query failed", result }, { status: 500 });
    }

    return NextResponse.json({
      statementId: result.statementId,
      state: result.state,
      columns: result.columns || [],
      rows: result.rows || [],
      records: result.records || [],
      rowCount: result.rowCount || 0,
    });
  } catch (err: any) {
    console.error("[Lakehouse API Error]", err);
    return NextResponse.json({ error: err?.message || "Failed to execute Lakehouse query" }, { status: 500 });
  }
}
