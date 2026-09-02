import { NextRequest, NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { requireAdminUser } from "@/lib/appUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type EventRecord = {
  id: string;
  cat: "meeting" | "hackathon" | "career" | "workshop" | "social" | "sports";
  catLabel: string;
  catIcon: string;
  title: string;
  subhead?: string;
  pill?: { text: string; tone: "live" | "today" | "scarce" | "going" | "quiet" | "full" };
  month: string;
  day: string;
  dow: string;
  date?: string;
  time: string;
  duration?: string;
  loc: string;
  isVirtual?: boolean;
  registered: number | "Open";
  capacity?: number;
  host: string;
  hostCode: string;
  flags: { food?: boolean; virtual?: boolean; going?: boolean };
  when: "today" | "week" | "weekend" | "future";
  description?: string;
  status?: string;
  visibility?: string;
  isFeatured?: boolean;
  whatsappUrl?: string;
};

function mapRowToEvent(r: Record<string, any>): EventRecord {
  const cat = (r.category || "meeting").toLowerCase() as EventRecord["cat"];
  const catLabels: Record<string, string> = {
    meeting: "Meeting",
    hackathon: "Hackathon",
    career: "Career",
    workshop: "Workshop",
    social: "Social",
    sports: "Sports",
  };
  const catIcons: Record<string, string> = {
    meeting: "i-msg",
    hackathon: "i-code",
    career: "i-brief",
    workshop: "i-wrench",
    social: "i-music",
    sports: "i-ball",
  };

  const registered = Number(r.registered_count) || 0;
  const capacity = Number(r.capacity) || 100;
  const isVirtual = Boolean(r.is_virtual);
  const foodProvided = Boolean(r.food_provided);
  const isFeatured = Boolean(r.is_featured);
  const status = r.status || "live";
  const visibility = r.visibility || "public";

  let pill: EventRecord["pill"] = undefined;
  if (status === "live") {
    if (capacity && registered >= capacity) {
      pill = { text: "Full", tone: "full" };
    } else if (capacity && capacity - registered <= 3 && capacity - registered > 0) {
      pill = { text: `${capacity - registered} left`, tone: "scarce" };
    } else if (isVirtual) {
      pill = { text: "Virtual", tone: "quiet" };
    } else {
      pill = { text: "Live", tone: "live" };
    }
  } else if (status === "draft") {
    pill = { text: "Draft", tone: "quiet" };
  } else if (status === "ended") {
    pill = { text: "Ended", tone: "quiet" };
  }

  let month = "APR";
  let day = "12";
  let dow = "SAT";
  let when: EventRecord["when"] = "week";

  if (r.event_date) {
    try {
      const d = new Date(r.event_date);
      month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
      day = String(d.getDate()).padStart(2, "0");
      dow = d.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
      
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        when = "weekend";
      } else if (day === "09") {
        when = "today";
      } else {
        when = "week";
      }
    } catch {
      // keep defaults
    }
  }

  return {
    id: r.event_id || `e-${Date.now()}`,
    title: r.title || "Untitled Campus Event",
    cat,
    catLabel: catLabels[cat] || "Event",
    catIcon: catIcons[cat] || "i-msg",
    month,
    day,
    dow,
    date: r.event_date ? String(r.event_date) : undefined,
    time: r.start_time || "6:00 PM",
    duration: r.duration || "1h",
    loc: r.location || "Campus Hub",
    isVirtual,
    registered,
    capacity,
    host: r.host_organization || "Campus Club",
    hostCode: r.host_code || (r.host_organization ? r.host_organization.slice(0, 2).toUpperCase() : "CC"),
    flags: {
      food: foodProvided,
      virtual: isVirtual,
    },
    when,
    description: r.description,
    status,
    visibility,
    isFeatured,
    whatsappUrl: r.whatsapp_url || undefined,
  };
}

export async function GET() {
  const result = await executeLakehouseSql(
    "SELECT * FROM workspace.campus_explorer.campus_events ORDER BY event_date ASC, start_time ASC",
    undefined,
    20
  );

  if (result.state === "SUCCEEDED" && result.records) {
    const events = result.records.map(mapRowToEvent);
    return NextResponse.json({
      events,
      source: "lakehouse",
      count: events.length,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  return NextResponse.json(
    {
      error: result.error || `Lakehouse query failed with state: ${result.state}`,
      state: result.state,
    },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminUser();
    if (guard.error) {
      return NextResponse.json({ success: false, error: guard.error.message }, { status: guard.error.status });
    }

    const body = await req.json();
    const eventId = body.id || `EV-${Date.now().toString().slice(-4)}`;
    const title = String(body.title || "New Campus Event");
    const category = (body.category || "meeting").toLowerCase();
    const host = String(body.host || body.host_organization || "Student Org");
    const hostCode = (body.hostCode || host.slice(0, 2)).toUpperCase();
    const location = String(body.location || "Campus Hub");
    const isVirtual = Boolean(body.isVirtual ?? body.isHybrid ?? false);
    const date = body.date || "2026-04-15";
    const time = String(body.time || "6:00 PM");
    const duration = String(body.duration || "1h");
    const capacity = parseInt(body.capacity) || 50;
    const food = Boolean(body.food ?? body.hasFood ?? false);
    const featured = Boolean(body.featured ?? body.isFeatured ?? false);
    const status = body.status || "live";
    const visibility = body.visibility || "public";
    const description = String(body.description || body.desc || "");
    const tags = Array.isArray(body.tags) ? body.tags : [category, "Campus"];
    const tagsJson = JSON.stringify(tags.map(String));
    const createdBy = guard.user.userId;
    const whatsappUrl = typeof body.whatsappUrl === "string" && body.whatsappUrl.trim() ? body.whatsappUrl.trim() : null;

    const insertSql = `
      INSERT INTO workspace.campus_explorer.campus_events (event_id, title, category, host_organization, host_code,
        location, is_virtual, event_date, start_time, duration, capacity, registered_count, food_provided,
        is_featured, status, visibility, tags, description, created_at, created_by, whatsapp_url)
      VALUES (
        :event_id, :title, :category, :host, :host_code,
        :location, :is_virtual, :event_date, :start_time, :duration,
        :capacity, 0, :food, :featured, :status, :visibility,
        from_json(:tags_json, 'array<string>'), :description, current_timestamp(), :created_by, :whatsapp_url
      )
    `;

    const result = await executeLakehouseSql(insertSql, undefined, 30, [
      { name: "event_id", value: String(eventId) }, { name: "title", value: title },
      { name: "category", value: category }, { name: "host", value: host },
      { name: "host_code", value: hostCode }, { name: "location", value: location },
      { name: "is_virtual", value: isVirtual, type: "BOOLEAN" },
      { name: "event_date", value: String(date), type: "DATE" },
      { name: "start_time", value: time }, { name: "duration", value: duration },
      { name: "capacity", value: capacity, type: "INT" }, { name: "food", value: food, type: "BOOLEAN" },
      { name: "featured", value: featured, type: "BOOLEAN" }, { name: "status", value: String(status) },
      { name: "visibility", value: String(visibility) }, { name: "tags_json", value: tagsJson },
      { name: "description", value: description }, { name: "created_by", value: createdBy },
      { name: "whatsapp_url", value: whatsappUrl },
    ]);

    if (result.state === "SUCCEEDED") {
      return NextResponse.json({
        success: true,
        eventId,
        state: result.state,
        message: "Event successfully saved to Lakehouse Delta Table.",
      });
    }

    return NextResponse.json(
      { success: false, error: result.error || "Failed to insert event into Databricks Lakehouse" },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("[Create Event Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAdminUser();
    if (guard.error) {
      return NextResponse.json({ success: false, error: guard.error.message }, { status: guard.error.status });
    }

    const body = await req.json();
    const eventId = String(body.id || body.eventId || "");
    if (!eventId) {
      return NextResponse.json({ success: false, error: "Missing event ID" }, { status: 400 });
    }

    const title = String(body.title || "Campus Event");
    const category = (body.category || "meeting").toLowerCase();
    const host = String(body.host || body.host_organization || "Student Org");
    const hostCode = (body.hostCode || host.slice(0, 2)).toUpperCase();
    const location = String(body.location || "Campus Hub");
    const isVirtual = Boolean(body.isVirtual ?? body.isHybrid ?? false);
    const date = body.date || "2026-04-15";
    const time = String(body.time || "6:00 PM");
    const duration = String(body.duration || "1h");
    const capacity = parseInt(body.capacity || body.capNumber) || 50;
    const food = Boolean(body.food ?? body.hasFood ?? false);
    const featured = Boolean(body.featured ?? body.isFeatured ?? false);
    const status = body.status || "live";
    const visibility = body.visibility || "public";
    const description = String(body.description || body.desc || "");
    const tags = Array.isArray(body.tags) ? body.tags : [category, "Campus"];
    const tagsJson = JSON.stringify(tags.map(String));
    // undefined = leave the stored link untouched; null/"" clears it.
    const waProvided = body.whatsappUrl !== undefined;
    const whatsappUrl = typeof body.whatsappUrl === "string" && body.whatsappUrl.trim() ? body.whatsappUrl.trim() : null;

    const mergeSql = `
      MERGE INTO workspace.campus_explorer.campus_events AS target
      USING (
        SELECT
          :event_id AS event_id, :title AS title, :category AS category,
          :host AS host_organization, :host_code AS host_code, :location AS location,
          :is_virtual AS is_virtual, :event_date AS event_date, :start_time AS start_time,
          :duration AS duration, :capacity AS capacity, :food AS food_provided,
          :featured AS is_featured, :status AS status, :visibility AS visibility,
          from_json(:tags_json, 'array<string>') AS tags, :description AS description,
          :whatsapp_url AS whatsapp_url
      ) AS src
      ON target.event_id = src.event_id
      WHEN MATCHED THEN UPDATE SET
        target.title = src.title,
        target.category = src.category,
        target.host_organization = src.host_organization,
        target.host_code = src.host_code,
        target.location = src.location,
        target.is_virtual = src.is_virtual,
        target.event_date = src.event_date,
        target.start_time = src.start_time,
        target.duration = src.duration,
        target.capacity = src.capacity,
        ${waProvided ? "target.whatsapp_url = src.whatsapp_url," : ""}
        target.food_provided = src.food_provided,
        target.is_featured = src.is_featured,
        target.status = src.status,
        target.visibility = src.visibility,
        target.tags = src.tags,
        target.description = src.description
      WHEN NOT MATCHED THEN INSERT (
        event_id, title, category, host_organization, host_code,
        location, is_virtual, event_date, start_time, duration,
        capacity, registered_count, food_provided, is_featured, status, visibility,
        tags, description, created_at, created_by, whatsapp_url
      ) VALUES (
        src.event_id, src.title, src.category, src.host_organization, src.host_code,
        src.location, src.is_virtual, src.event_date, src.start_time, src.duration,
        src.capacity, 0, src.food_provided, src.is_featured, src.status, src.visibility,
        src.tags, src.description, current_timestamp(), :created_by, src.whatsapp_url
      )
    `;

    const result = await executeLakehouseSql(mergeSql, undefined, 30, [
      { name: "event_id", value: eventId }, { name: "title", value: title },
      { name: "category", value: category }, { name: "host", value: host },
      { name: "host_code", value: hostCode }, { name: "location", value: location },
      { name: "is_virtual", value: isVirtual, type: "BOOLEAN" },
      { name: "event_date", value: String(date), type: "DATE" },
      { name: "start_time", value: time }, { name: "duration", value: duration },
      { name: "capacity", value: capacity, type: "INT" }, { name: "food", value: food, type: "BOOLEAN" },
      { name: "featured", value: featured, type: "BOOLEAN" }, { name: "status", value: String(status) },
      { name: "visibility", value: String(visibility) }, { name: "tags_json", value: tagsJson },
      { name: "description", value: description }, { name: "whatsapp_url", value: whatsappUrl },
      { name: "created_by", value: guard.user.userId },
    ]);

    if (result.state !== "SUCCEEDED") {
      return NextResponse.json(
        { success: false, eventId, state: result.state, error: result.error || "Lakehouse update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      eventId,
      state: result.state,
      message: "Event updated in Databricks Lakehouse table.",
    });
  } catch (err: any) {
    console.error("[Update Event Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAdminUser();
    if (guard.error) {
      return NextResponse.json({ success: false, error: guard.error.message }, { status: guard.error.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing event ID" }, { status: 400 });
    }

    const deleteSql = "DELETE FROM workspace.campus_explorer.campus_events WHERE event_id = :event_id";
    const result = await executeLakehouseSql(deleteSql, undefined, 30, [{ name: "event_id", value: id }]);

    return NextResponse.json({
      success: true,
      deletedId: id,
      state: result.state,
      message: "Event deleted from Databricks Lakehouse.",
    });
  } catch (err: any) {
    console.error("[Delete Event Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
