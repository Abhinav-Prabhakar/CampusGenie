// Databricks Lakehouse SQL execution and utility functions
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export type LakehouseQueryResult = {
  statementId?: string;
  state: "SUCCEEDED" | "FAILED" | "PENDING" | "RUNNING" | "ERROR";
  columns?: string[];
  rows?: any[][];
  records?: Record<string, any>[];
  rowCount?: number;
  error?: string;
};

export const DEFAULT_WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID || "25132a20d91813ef";

/**
 * Execute a SQL query on Databricks Lakehouse via Databricks CLI / SQL Statements API
 */
export async function executeLakehouseSql(
  statement: string,
  warehouseId: string = DEFAULT_WAREHOUSE_ID,
  maxWaitSeconds: number = 30
): Promise<LakehouseQueryResult> {
  const cleanStmt = statement.trim().replace(/;+$/, "");
  const payload = JSON.stringify({
    warehouse_id: warehouseId,
    statement: cleanStmt,
    wait_timeout: `${Math.min(maxWaitSeconds, 30)}s`,
  });

  try {
    const escapedPayload = payload.replace(/'/g, "'\\''");
    const { stdout, stderr } = await execAsync(
      `databricks api post /api/2.0/sql/statements --json '${escapedPayload}'`,
      { maxBuffer: 1024 * 1024 * 10 }
    );

    if (stderr && !stdout) {
      return {
        state: "FAILED",
        error: stderr,
      };
    }

    const data = JSON.parse(stdout);
    const stmtId = data.statement_id;
    let state = data.status?.state;

    // If still pending/running, poll for up to 10 iterations
    let attempts = 0;
    while ((state === "PENDING" || state === "RUNNING") && attempts < 10) {
      attempts++;
      await new Promise((r) => setTimeout(r, 1200));
      try {
        const { stdout: pollStdout } = await execAsync(
          `databricks api get /api/2.0/sql/statements/${stmtId}`
        );
        const pollData = JSON.parse(pollStdout);
        state = pollData.status?.state;
        if (state === "SUCCEEDED") {
          return parseStatementResult(pollData);
        } else if (state === "FAILED" || state === "CANCELED") {
          return {
            statementId: stmtId,
            state: "FAILED",
            error: pollData.status?.error?.message || `Execution ended with state: ${state}`,
          };
        }
      } catch (pollErr: any) {
        console.warn("[Lakehouse Poll Error]", pollErr.message);
      }
    }

    if (state === "SUCCEEDED") {
      return parseStatementResult(data);
    }

    return {
      statementId: stmtId,
      state: state || "FAILED",
      error: data.status?.error?.message || `Statement state: ${state}`,
    };
  } catch (err: any) {
    console.error("[Lakehouse SQL Exec Error]", err);
    return {
      state: "ERROR",
      error: err.message,
    };
  }
}

function parseStatementResult(data: any): LakehouseQueryResult {
  const columns = data.manifest?.schema?.columns?.map((c: any) => c.name) || [];
  const rows = data.result?.data_array || [];
  
  const records = rows.map((row: any[]) => {
    const rec: Record<string, any> = {};
    columns.forEach((colName: string, idx: number) => {
      let val = row[idx];
      // Attempt to parse JSON arrays or objects
      if (typeof val === "string" && (val.startsWith("[") || val.startsWith("{"))) {
        try {
          val = JSON.parse(val);
        } catch {
          // keep as string
        }
      }
      rec[colName] = val;
    });
    return rec;
  });

  return {
    statementId: data.statement_id,
    state: "SUCCEEDED",
    columns,
    rows,
    records,
    rowCount: data.manifest?.total_row_count ?? rows.length,
  };
}
