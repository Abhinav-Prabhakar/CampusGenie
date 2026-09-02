import { NextRequest, NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { streamGenieConversation } from "@/lib/genie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedOrigins = new Set(["https://localhost", "http://localhost", "capacitor://localhost"]);
function headers(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  return { "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://localhost", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin", "Cache-Control": "no-store" };
}
function json(request: NextRequest, body: unknown, status = 200) { return NextResponse.json(body, { status, headers: headers(request) }); }
function text(value: unknown) { return value == null ? "" : String(value); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
type MobileEvent = { id: string; title: string; category: string; host: string; location: string; date: string; time: string; description: string; capacity: number; registered: number; foodProvided: boolean; isVirtual: boolean };
function publicEvents(rows: Record<string, unknown>[]): MobileEvent[] {
  return rows.map(row => ({
    id: text(row.event_id), title: text(row.title), category: text(row.category), host: text(row.host_organization),
    location: text(row.location), date: text(row.event_date), time: text(row.start_time), description: text(row.description),
    capacity: number(row.capacity), registered: number(row.registered_count), foodProvided: Boolean(row.food_provided), isVirtual: Boolean(row.is_virtual),
  }));
}
async function getPublicEvents(limit = 30): Promise<MobileEvent[]> {
  const result = await executeLakehouseSql(`SELECT event_id, title, category, host_organization, location, event_date, start_time, description, capacity, registered_count, food_provided, is_virtual FROM workspace.campus_explorer.campus_events WHERE visibility = 'public' ORDER BY event_date, start_time LIMIT ${limit}`);
  if (result.state !== "SUCCEEDED") throw new Error(result.error || "Events query failed");
  return publicEvents(result.records || []);
}

export function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: headers(request) }); }

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource") || "status";
  try {
    if (resource === "status") {
      const result = await executeLakehouseSql("SELECT current_timestamp() AS checked_at");
      if (result.state !== "SUCCEEDED") throw new Error(result.error || "Databricks is unavailable");
      return json(request, { data: { connected: true, agent: "Genie", source: "Databricks Lakehouse" } });
    }
    if (resource === "events") {
      const limit = Math.min(Math.max(number(request.nextUrl.searchParams.get("limit")) || 30, 1), 50);
      const events = await getPublicEvents(limit);
      return json(request, { data: events, meta: { count: events.length, source: "Databricks", refreshedAt: new Date().toISOString() } });
    }
    if (resource === "sources") {
      const result = await executeLakehouseSql("SELECT source_id, name, category, description, status, chunk_count FROM workspace.campus_explorer.knowledge_sources ORDER BY updated_at DESC");
      if (result.state !== "SUCCEEDED") throw new Error(result.error || "Sources query failed");
      return json(request, { data: (result.records || []).map(row => ({ id: text(row.source_id), name: text(row.name), category: text(row.category), description: text(row.description), status: text(row.status), chunks: number(row.chunk_count) })), meta: { count: result.rowCount, source: "Databricks", refreshedAt: new Date().toISOString() } });
    }
    if (resource === "attendance") {
      const result = await executeLakehouseSql(`SELECT c.course_code, c.title, c.min_attendance_pct, SUM(CASE WHEN l.status IN ('PRESENT','LATE') THEN 1 ELSE 0 END) AS present_count, COUNT(l.log_id) AS total_count FROM workspace.campus_explorer.student_courses c LEFT JOIN workspace.campus_explorer.student_attendance_logs l ON c.course_id = l.course_id AND c.user_id = l.student_id GROUP BY c.course_code, c.title, c.min_attendance_pct ORDER BY c.course_code`);
      if (result.state !== "SUCCEEDED") throw new Error(result.error || "Attendance query failed");
      return json(request, { data: (result.records || []).map(row => { const present = number(row.present_count); const total = number(row.total_count); return { courseCode: text(row.course_code), title: text(row.title), present, total, percentage: total ? present / total * 100 : 0, minimum: number(row.min_attendance_pct) }; }), meta: { count: result.rowCount, source: "Databricks", refreshedAt: new Date().toISOString() } });
    }
    return json(request, { error: "Unknown mobile resource" }, 404);
  } catch (error) { return json(request, { error: error instanceof Error ? error.message : "Databricks request failed" }, 503); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = text(body.prompt).trim();
    if (!prompt || prompt.length > 2000) return json(request, { error: "Enter a question up to 2,000 characters." }, 400);
    let content = "";
    const eventIds = new Set<string>();
    await streamGenieConversation(prompt, request.signal, event => {
      const value = event as { choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }> };
      content += value.choices?.[0]?.delta?.content || "";
      for (const toolCall of value.choices?.[0]?.delta?.tool_calls || []) {
        if (toolCall.function?.name !== "show_events_grid") continue;
        try {
          const parsed = JSON.parse(toolCall.function.arguments || "{}");
          for (const id of parsed.eventIds || []) eventIds.add(text(id));
        } catch { /* Ignore malformed streamed tool arguments. */ }
      }
    });
    if (!content.trim()) throw new Error("Genie completed without returning an answer.");
    const events = eventIds.size ? (await getPublicEvents(50)).filter(event => eventIds.has(event.id)) : [];
    return json(request, { data: { content: content.trim(), eventIds: [...eventIds], events, agent: "Genie" }, meta: { source: "Databricks Genie", refreshedAt: new Date().toISOString() } });
  } catch (error) { return json(request, { error: error instanceof Error ? error.message : "Genie request failed" }, 503); }
}
