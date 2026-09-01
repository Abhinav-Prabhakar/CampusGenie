export type DatabricksConfig = {
  host: string;
  token: string;
  warehouseId: string;
  genieSpaceId: string;
  genieAgentName: string;
  catalog: string;
  schema: string;
};

export type DatabricksErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_CONFIG"
  | "AUTHENTICATION_FAILED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "TIMEOUT"
  | "QUERY_FAILED"
  | "INVALID_RESPONSE";

export class DatabricksError extends Error {
  public readonly code: DatabricksErrorCode;
  public readonly status: number;
  public readonly requestId?: string;

  constructor(
    code: DatabricksErrorCode,
    message: string,
    status = 503,
    requestId?: string,
  ) {
    super(message);
    this.name = "DatabricksError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

type Environment = Record<string, string | undefined>;

export type SqlStatementResponse = {
  statement_id?: string;
  status?: {
    state?: string;
    error?: { message?: string; error_code?: string };
  };
  manifest?: {
    schema?: { columns?: Array<{ name?: string; type_name?: string }> };
    total_row_count?: number;
    truncated?: boolean;
  };
  result?: {
    data_array?: Array<Array<string | null>>;
    next_chunk_index?: number;
    next_chunk_internal_link?: string;
  };
};

export type SqlQueryResult = {
  statementId: string;
  columns: string[];
  rows: Array<Array<string | null>>;
  records: Array<Record<string, string | null>>;
  rowCount: number;
  truncated: boolean;
};

const REQUIRED_ENV = [
  "DATABRICKS_HOST",
  "DATABRICKS_TOKEN",
  "DATABRICKS_WAREHOUSE_ID",
  "DATABRICKS_GENIE_SPACE_ID",
] as const;

export function getDatabricksConfig(env: Environment = process.env): DatabricksConfig {
  const missing = REQUIRED_ENV.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new DatabricksError(
      "NOT_CONFIGURED",
      `Databricks is not configured. Missing: ${missing.join(", ")}.`,
      503,
    );
  }

  let host: URL;
  try {
    host = new URL(env.DATABRICKS_HOST!.trim());
  } catch {
    throw new DatabricksError("INVALID_CONFIG", "DATABRICKS_HOST must be a valid URL.", 503);
  }
  if (host.protocol !== "https:") {
    throw new DatabricksError("INVALID_CONFIG", "DATABRICKS_HOST must use HTTPS.", 503);
  }

  const catalog = env.DATABRICKS_CATALOG?.trim() || "workspace";
  const schema = env.DATABRICKS_SCHEMA?.trim() || "campus_navigator";
  if (![catalog, schema].every((identifier) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier))) {
    throw new DatabricksError("INVALID_CONFIG", "Databricks catalog and schema names contain unsupported characters.", 503);
  }

  return {
    host: host.origin,
    token: env.DATABRICKS_TOKEN!.trim(),
    warehouseId: env.DATABRICKS_WAREHOUSE_ID!.trim(),
    genieSpaceId: env.DATABRICKS_GENIE_SPACE_ID!.trim(),
    genieAgentName: env.DATABRICKS_GENIE_AGENT_NAME?.trim() || "Campus Opportunity Navigator",
    catalog,
    schema,
  };
}

function publicMessageForStatus(status: number): { code: DatabricksErrorCode; message: string } {
  if (status === 401) return { code: "AUTHENTICATION_FAILED", message: "Databricks rejected the configured credentials." };
  if (status === 403) return { code: "PERMISSION_DENIED", message: "Databricks credentials do not have access to the requested resource." };
  if (status === 404) return { code: "NOT_FOUND", message: "The configured Databricks resource was not found." };
  if (status === 429) return { code: "RATE_LIMITED", message: "Databricks is rate limiting requests. Try again shortly." };
  return { code: "UPSTREAM_UNAVAILABLE", message: "Databricks is temporarily unavailable." };
}

function abortSignalWithTimeout(parent: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

export class DatabricksClient {
  public readonly config: DatabricksConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: DatabricksConfig,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async request<T>(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
    const { signal, cleanup } = abortSignalWithTimeout(init.signal || undefined, timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.host}${path}`, {
        ...init,
        signal,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
        cache: "no-store",
      });
      const requestId = response.headers.get("x-databricks-request-id") || undefined;
      if (!response.ok) {
        const safe = publicMessageForStatus(response.status);
        throw new DatabricksError(safe.code, safe.message, response.status, requestId);
      }
      try {
        return (await response.json()) as T;
      } catch {
        throw new DatabricksError("INVALID_RESPONSE", "Databricks returned an invalid response.", 502, requestId);
      }
    } catch (error) {
      if (error instanceof DatabricksError) throw error;
      if (signal.aborted) throw new DatabricksError("TIMEOUT", "Databricks did not respond before the request timed out.", 504);
      throw new DatabricksError("UPSTREAM_UNAVAILABLE", "Databricks could not be reached.", 503);
    } finally {
      cleanup();
    }
  }

  async executeSql(statement: string, signal?: AbortSignal): Promise<SqlQueryResult> {
    const trimmed = statement.trim().replace(/;+$/, "");
    if (!/^(SELECT|WITH|SHOW|DESCRIBE)\b/i.test(trimmed)) {
      throw new DatabricksError("PERMISSION_DENIED", "Only read-only SQL is allowed through the public application.", 403);
    }

    let response = await this.request<SqlStatementResponse>("/api/2.0/sql/statements", {
      method: "POST",
      signal,
      body: JSON.stringify({
        warehouse_id: this.config.warehouseId,
        statement: trimmed,
        wait_timeout: "25s",
        disposition: "INLINE",
        format: "JSON_ARRAY",
      }),
    });

    const statementId = response.statement_id;
    if (!statementId) throw new DatabricksError("INVALID_RESPONSE", "Databricks did not return a statement ID.", 502);

    for (let attempt = 0; ["PENDING", "RUNNING"].includes(response.status?.state || ""); attempt += 1) {
      if (attempt >= 20) throw new DatabricksError("TIMEOUT", "The Databricks SQL statement timed out.", 504);
      await new Promise((resolve) => setTimeout(resolve, 750));
      response = await this.request<SqlStatementResponse>(
        `/api/2.0/sql/statements/${encodeURIComponent(statementId)}`,
        { signal },
      );
    }

    if (response.status?.state !== "SUCCEEDED") {
      throw new DatabricksError("QUERY_FAILED", "Databricks could not complete the SQL query.", 502);
    }

    const columns = (response.manifest?.schema?.columns || []).map((column) => column.name || "column");
    const rows = response.result?.data_array || [];
    return {
      statementId,
      columns,
      rows,
      records: rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null]))),
      rowCount: response.manifest?.total_row_count ?? rows.length,
      truncated: Boolean(response.manifest?.truncated || response.result?.next_chunk_index !== undefined),
    };
  }
}

export function createDatabricksClient(
  env: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
): DatabricksClient {
  return new DatabricksClient(getDatabricksConfig(env), fetchImpl);
}

export function toPublicDatabricksError(error: unknown) {
  const safe = error instanceof DatabricksError
    ? error
    : new DatabricksError("UPSTREAM_UNAVAILABLE", "Databricks is unavailable.", 503);
  return {
    status: safe.status,
    body: {
      ok: false as const,
      error: { code: safe.code, message: safe.message, requestId: safe.requestId },
      source: "databricks" as const,
    },
  };
}
