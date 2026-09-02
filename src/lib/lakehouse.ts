// Databricks Lakehouse SQL execution and utility functions
import { execFile } from "child_process";
import { promisify } from "util";

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

export type LakehouseSqlParameter = {
  name: string;
  value: string | number | boolean | null;
  type?: string;
};

type DatabricksStatementParameter = {
  name: string;
  value: string | null;
  type?: string;
};

const PARAMETER_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const PARAMETER_TYPE = /^(?:STRING|BOOLEAN|BYTE|SHORT|INT|INTEGER|LONG|BIGINT|FLOAT|DOUBLE|DATE|TIMESTAMP|DECIMAL\(\d{1,2},\d{1,2}\))$/i;

export function buildStatementPayload(
  statement: string,
  warehouseId: string,
  maxWaitSeconds: number,
  parameters: LakehouseSqlParameter[] = []
) {
  const names = new Set<string>();
  const normalizedParameters: DatabricksStatementParameter[] = parameters.map((parameter) => {
    if (!PARAMETER_NAME.test(parameter.name)) {
      throw new Error(`Invalid Databricks SQL parameter name: ${parameter.name}`);
    }
    if (names.has(parameter.name)) {
      throw new Error(`Duplicate Databricks SQL parameter: ${parameter.name}`);
    }
    names.add(parameter.name);
    if (parameter.type && !PARAMETER_TYPE.test(parameter.type)) {
      throw new Error(`Invalid Databricks SQL parameter type: ${parameter.type}`);
    }
    return {
      name: parameter.name,
      value: parameter.value === null ? null : String(parameter.value),
      ...(parameter.type ? { type: parameter.type.toUpperCase() } : {}),
    };
  });

  return {
    warehouse_id: warehouseId,
    statement: statement.trim().replace(/;+$/, ""),
    wait_timeout: `${Math.min(Math.max(maxWaitSeconds, 0), 30)}s`,
    ...(normalizedParameters.length > 0 ? { parameters: normalizedParameters } : {}),
  };
}

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
  maxWaitSeconds: number = 30,
  parameters: LakehouseSqlParameter[] = []
): Promise<LakehouseQueryResult> {
  const payload = buildStatementPayload(statement, warehouseId, maxWaitSeconds, parameters);

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
    const { stdout, stderr } = await execFileAsync(
      cli,
      ["api", "post", "/api/2.0/sql/statements", "--json", JSON.stringify(payload)],
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
        const { stdout: pollStdout } = await execFileAsync(
          cli,
          ["api", "get", `/api/2.0/sql/statements/${stmtId}`],
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
