import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const runtime = "nodejs";

const WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID || "25132a20d91813ef";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing SQL query parameter" }, { status: 400 });
    }

    const payload = JSON.stringify({
      warehouse_id: WAREHOUSE_ID,
      statement: query,
      wait_timeout: "25s",
    });

    const { stdout, stderr } = await execAsync(
      `databricks api post /api/2.0/sql/statements --json '${payload.replace(/'/g, "'\\''")}'`
    );

    if (stderr && !stdout) {
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    const initial = JSON.parse(stdout);
    const statementId = initial.statement_id;
    let state = initial.status?.state;

    // Poll if still executing
    let finalResult = initial;
    let attempts = 0;
    while (state === "PENDING" || state === "RUNNING") {
      if (attempts > 12) break;
      await new Promise((r) => setTimeout(r, 1500));
      attempts++;

      const checkRes = await execAsync(`databricks api get /api/2.0/sql/statements/${statementId}`);
      if (checkRes.stdout) {
        finalResult = JSON.parse(checkRes.stdout);
        state = finalResult.status?.state;
      }
    }

    return NextResponse.json({
      statementId,
      state: finalResult.status?.state,
      columns: finalResult.manifest?.schema?.columns || [],
      rows: finalResult.result?.data_array || [],
      rowCount: finalResult.manifest?.total_row_count || 0,
      warehouseId: WAREHOUSE_ID,
    });
  } catch (err: any) {
    console.error("[Lakehouse API Error]", err);
    return NextResponse.json({ error: err?.message || "Failed to execute Lakehouse query" }, { status: 500 });
  }
}
