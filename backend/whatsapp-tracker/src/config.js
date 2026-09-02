import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Try local .env in tracker folder
const localEnv = path.resolve(__dirname, "../.env");
if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
}

// 2. Also try root .env.local for fallback
const rootEnv = path.resolve(__dirname, "../../../.env.local");
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

export const CONFIG = {
  // LLM Config (Gemini / VoidAI)
  llmBaseUrl: (process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, ""),
  llmApiKey: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "",
  llmModel: process.env.LLM_MODEL || "gemini-3.6-flash",

  // Databricks Lakehouse Config
  databricksHost: (process.env.DATABRICKS_HOST || "https://dbc-c69189ed-ede0.cloud.databricks.com").replace(/\/+$/, ""),
  databricksToken: process.env.DATABRICKS_TOKEN || "",
  databricksWarehouseId: process.env.DATABRICKS_WAREHOUSE_ID || "25132a20d91813ef",

  // State storage
  statePath: path.resolve(__dirname, "../data/tracker-state.json"),
  sessionPath: path.resolve(__dirname, "../.wwebjs_auth"),
};

/**
 * Resolve Databricks token from environment variable or Databricks CLI OAuth
 */
export async function resolveDatabricksToken() {
  if (CONFIG.databricksToken) return CONFIG.databricksToken;

  const candidates = [
    "/opt/homebrew/bin/databricks",
    "/usr/local/bin/databricks",
    `${process.env.HOME}/.local/bin/databricks`,
    `${process.env.HOME}/bin/databricks`,
    "databricks",
  ];

  for (const candidate of candidates) {
    try {
      const { stdout } = await execFileAsync(candidate, ["auth", "token"], {
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
        },
      });
      if (stdout) {
        try {
          const parsed = JSON.parse(stdout);
          const token = parsed.access_token || parsed.token;
          if (token) {
            CONFIG.databricksToken = token;
            return token;
          }
        } catch {
          const token = stdout.trim();
          if (token) {
            CONFIG.databricksToken = token;
            return token;
          }
        }
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

export async function validateConfig() {
  const missing = [];
  if (!CONFIG.llmApiKey) missing.push("LLM_API_KEY / GEMINI_API_KEY");
  if (!CONFIG.databricksHost) missing.push("DATABRICKS_HOST");

  const token = await resolveDatabricksToken();
  if (!token) missing.push("DATABRICKS_TOKEN (or active Databricks CLI authentication)");

  return {
    valid: missing.length === 0,
    missing,
  };
}
