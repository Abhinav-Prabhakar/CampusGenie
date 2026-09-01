import { NextRequest, NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";

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
    });
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
    const body = await req.json();
    const eventId = body.id || `EV-${Date.now().toString().slice(-4)}`;
    const title = (body.title || "New Campus Event").replace(/'/g, "''");
    const category = (body.category || "meeting").toLowerCase();
    const host = (body.host || body.host_organization || "Student Org").replace(/'/g, "''");
    const hostCode = (body.hostCode || host.slice(0, 2)).toUpperCase();
    const location = (body.location || "Campus Hub").replace(/'/g, "''");
    const isVirtual = Boolean(body.isVirtual);
    const date = body.date || "2026-04-15";
    const time = (body.time || "6:00 PM").replace(/'/g, "''");
    const duration = (body.duration || "1h").replace(/'/g, "''");
    const capacity = parseInt(body.capacity) || 50;
    const food = Boolean(body.food || body.hasFood);
    const featured = Boolean(body.featured || body.isFeatured);
    const status = body.status || "live";
    const visibility = body.visibility || "public";
    const description = (body.description || body.desc || "").replace(/'/g, "''");
    const tags = Array.isArray(body.tags) ? body.tags : [category, "Campus"];
    const tagsArraySql = `ARRAY(${tags.map((t: string) => `'${t.replace(/'/g, "''")}'`).join(",")})`;

    const insertSql = `
      INSERT INTO workspace.campus_explorer.campus_events VALUES (
        '${eventId}', '${title}', '${category}', '${host}', '${hostCode}',
        '${location}', ${isVirtual}, '${date}', '${time}', '${duration}',
        ${capacity}, 0, ${food}, ${featured}, '${status}', '${visibility}',
        ${tagsArraySql}, '${description}', current_timestamp()
      )
    `;

    const result = await executeLakehouseSql(insertSql);

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
