import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.DATABRICKS_APP_PORT || 8000);
const rawHost = (process.env.DATABRICKS_HOST || "").replace(/\/$/, "");
const host = rawHost && !/^https?:\/\//.test(rawHost) ? `https://${rawHost}` : rawHost;
const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;
const genieSpaceId = process.env.DATABRICKS_GENIE_SPACE_ID;
let cachedToken = { value: "", expiresAt: 0 };
app.use(express.json({ limit: "32kb" }));

async function token() {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const secret = process.env.DATABRICKS_CLIENT_SECRET;
  if (!host || !clientId || !secret) throw new Error("Databricks app authorization is unavailable");
  const response = await fetch(`${host}/oidc/v1/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials&scope=all-apis" });
  if (!response.ok) throw new Error(`Databricks OAuth failed (${response.status})`);
  const body = await response.json(); cachedToken = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000 }; return cachedToken.value;
}
async function dbFetch(apiPath, init = {}) {
  const response = await fetch(`${host}${apiPath}`, { ...init, headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`Databricks request failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  return response.json();
}
async function sql(statement) {
  let result = await dbFetch("/api/2.0/sql/statements", { method: "POST", body: JSON.stringify({ warehouse_id: warehouseId, statement, wait_timeout: "30s" }) });
  for (let i = 0; ["PENDING", "RUNNING"].includes(result.status?.state) && i < 20; i++) { await new Promise(r => setTimeout(r, 1000)); result = await dbFetch(`/api/2.0/sql/statements/${result.statement_id}`); }
  if (result.status?.state !== "SUCCEEDED") throw new Error(result.status?.error?.message || `SQL ended in ${result.status?.state}`);
  const columns = result.manifest?.schema?.columns?.map(c => c.name) || [];
  return (result.result?.data_array || []).map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}
const text = value => value == null ? "" : String(value);
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

app.get("/api/mobile", async (req, res) => {
  try {
    const resource = req.query.resource || "status";
    if (resource === "status") { await sql("SELECT current_timestamp()"); return res.json({ data: { connected: true, agent: "Genie", source: "Databricks Lakehouse" } }); }
    if (resource === "events") {
      const limit = Math.min(Math.max(number(req.query.limit) || 30, 1), 50);
      const rows = await sql(`SELECT event_id, title, category, host_organization, location, event_date, start_time, description FROM workspace.campus_explorer.campus_events WHERE visibility = 'public' ORDER BY event_date, start_time LIMIT ${limit}`);
      return res.json({ data: rows.map(row => ({ id: text(row.event_id), title: text(row.title), category: text(row.category), host: text(row.host_organization), location: text(row.location), date: text(row.event_date), time: text(row.start_time), description: text(row.description) })), meta: { count: rows.length, source: "Databricks", refreshedAt: new Date().toISOString() } });
    }
    if (resource === "sources") {
      const rows = await sql("SELECT source_id, name, category, description, status, chunk_count FROM workspace.campus_explorer.knowledge_sources ORDER BY updated_at DESC");
      return res.json({ data: rows.map(row => ({ id: text(row.source_id), name: text(row.name), category: text(row.category), description: text(row.description), status: text(row.status), chunks: number(row.chunk_count) })), meta: { count: rows.length, source: "Databricks", refreshedAt: new Date().toISOString() } });
    }
    if (resource === "attendance") {
      const rows = await sql("SELECT c.course_code, c.title, c.min_attendance_pct, SUM(CASE WHEN l.status IN ('PRESENT','LATE') THEN 1 ELSE 0 END) AS present_count, COUNT(l.log_id) AS total_count FROM workspace.campus_explorer.student_courses c LEFT JOIN workspace.campus_explorer.student_attendance_logs l ON c.course_id = l.course_id AND c.user_id = l.student_id GROUP BY c.course_code, c.title, c.min_attendance_pct ORDER BY c.course_code");
      return res.json({ data: rows.map(row => { const present = number(row.present_count), total = number(row.total_count); return { courseCode: text(row.course_code), title: text(row.title), present, total, percentage: total ? present / total * 100 : 0, minimum: number(row.min_attendance_pct) }; }), meta: { count: rows.length, source: "Databricks", refreshedAt: new Date().toISOString() } });
    }
    res.status(404).json({ error: "Unknown resource" });
  } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : "Databricks query failed" }); }
});

app.post("/api/mobile", async (req, res) => {
  try {
    const prompt = text(req.body?.prompt).trim();
    if (!prompt || prompt.length > 2000) return res.status(400).json({ error: "Enter a question up to 2,000 characters." });
    const started = await dbFetch(`/api/2.0/genie/spaces/${genieSpaceId}/start-conversation`, { method: "POST", body: JSON.stringify({ content: prompt, enable_visualization: false }) });
    let message = {};
    for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, i ? 1300 : 300)); message = await dbFetch(`/api/2.0/genie/spaces/${genieSpaceId}/conversations/${started.conversation_id}/messages/${started.message_id}`); if (["COMPLETED", "FAILED", "CANCELLED", "CANCELED"].includes(message.status)) break; }
    if (message.status !== "COMPLETED") throw new Error(`Genie ended in ${message.status || "TIMEOUT"}`);
    const answer = (message.attachments || []).find(a => a.text?.purpose?.includes("ANSWER"))?.text?.content || (message.attachments || []).find(a => a.text?.content)?.text?.content;
    if (!answer) throw new Error("Genie completed without an answer");
    res.json({ data: { content: answer, agent: "Genie" }, meta: { source: "Databricks Genie", refreshedAt: new Date().toISOString() } });
  } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : "Genie request failed" }); }
});

const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(root, "public"), { maxAge: "1h" }));
app.get("/{*path}", (_req, res) => res.sendFile(path.join(root, "public", "index.html")));
app.listen(port, "0.0.0.0", () => console.log(`Campus Genie is listening on ${port}`));
