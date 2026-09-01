// Databricks Lakehouse SQL execution and utility functions
import { exec, execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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
export const DEFAULT_HOST = (process.env.DATABRICKS_HOST || "https://dbc-c69189ed-ede0.cloud.databricks.com").replace(/\/+$/, "");

/**
 * Locate the Databricks CLI binary on macOS, Linux, or custom paths
 */
export async function findDatabricksCli(): Promise<string | null> {
  if (process.env.DATABRICKS_CLI_PATH) return process.env.DATABRICKS_CLI_PATH;

  const candidates = [
    "/opt/homebrew/bin/databricks",
    "/usr/local/bin/databricks",
    `${process.env.HOME}/.local/bin/databricks`,
    `${process.env.HOME}/bin/databricks`,
    "databricks",
  ];

  for (const candidate of candidates) {
    try {
      const { stdout } = await execFileAsync(candidate, ["-v"], {
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
        },
      });
      if (stdout) return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Get Databricks access token from env or CLI OAuth
 */
export async function getDatabricksToken(): Promise<string | null> {
  if (process.env.DATABRICKS_TOKEN) return process.env.DATABRICKS_TOKEN;

  const cli = await findDatabricksCli();
  if (!cli) return null;

  try {
    const { stdout } = await execFileAsync(cli, ["auth", "token"], {
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
      },
    });
    const parsed = JSON.parse(stdout);
    return parsed.access_token || null;
  } catch (err: any) {
    console.warn("[Databricks Auth Token]", err?.message);
    return null;
  }
}

/**
 * Execute a SQL query on Databricks Lakehouse via direct REST API or CLI
 */
export async function executeLakehouseSql(
  statement: string,
  warehouseId: string = DEFAULT_WAREHOUSE_ID,
  maxWaitSeconds: number = 30
): Promise<LakehouseQueryResult> {
  const cleanStmt = statement.trim().replace(/;+$/, "");
  const payload = {
    warehouse_id: warehouseId,
    statement: cleanStmt,
    wait_timeout: `${Math.min(maxWaitSeconds, 30)}s`,
  };

  // 1. First try direct REST API with token (fastest, no subshell spawning)
  const token = await getDatabricksToken();
  if (token && DEFAULT_HOST) {
    try {
      const apiRes = await fetch(`${DEFAULT_HOST}/api/2.0/sql/statements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        const stmtId = data.statement_id;
        let state = data.status?.state;

        // Poll if pending/running
        let attempts = 0;
        let finalData = data;
        while ((state === "PENDING" || state === "RUNNING") && attempts < 10) {
          attempts++;
          await new Promise((r) => setTimeout(r, 1200));
          const pollRes = await fetch(`${DEFAULT_HOST}/api/2.0/sql/statements/${stmtId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (pollRes.ok) {
            finalData = await pollRes.json();
            state = finalData.status?.state;
            if (state === "SUCCEEDED") return parseStatementResult(finalData);
            if (state === "FAILED" || state === "CANCELED") {
              return {
                statementId: stmtId,
                state: "FAILED",
                error: finalData.status?.error?.message || `Execution ended with state: ${state}`,
              };
            }
          }
        }

        if (state === "SUCCEEDED") return parseStatementResult(finalData);
        return {
          statementId: stmtId,
          state: state || "FAILED",
          error: finalData.status?.error?.message || `Statement state: ${state}`,
        };
      }
    } catch (restErr: any) {
      console.warn("[Lakehouse REST API]", restErr.message);
    }
  }

  // 2. Fall back to Databricks CLI with full resolved binary path
  const cli = await findDatabricksCli();
  if (!cli) {
    return {
      state: "ERROR",
      error: "Databricks CLI or authentication token not found. Please install databricks CLI or set DATABRICKS_TOKEN.",
    };
  }

  try {
    const escapedPayload = JSON.stringify(payload).replace(/'/g, "'\\''");
    const { stdout, stderr } = await execAsync(
      `"${cli}" api post /api/2.0/sql/statements --json '${escapedPayload}'`,
      {
        maxBuffer: 1024 * 1024 * 10,
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
        },
      }
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
          `"${cli}" api get /api/2.0/sql/statements/${stmtId}`,
          {
            env: {
              ...process.env,
              PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
            },
          }
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
