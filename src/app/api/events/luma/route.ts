import { NextRequest, NextResponse } from "next/server";
import type { EventRecord } from "@/app/api/events/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Normalizes raw Luma API event payloads into our EventRecord schema
 */
function normalizeLumaEvent(raw: any): EventRecord {
  const event = raw.event || raw;
  const startAt = event.start_at ? new Date(event.start_at) : new Date();
  const endAt = event.end_at ? new Date(event.end_at) : new Date(startAt.getTime() + 2 * 3600 * 1000);

  const month = startAt.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(startAt.getDate()).padStart(2, "0");
  const dow = startAt.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
  const time = startAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const durationHours = Math.round((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60) * 10) / 10;
  const duration = durationHours > 0 ? `${durationHours}h` : "2h";

  const isVirtual = Boolean(
    event.geo_address_info?.mode === "online" ||
    event.is_online ||
    event.url_mode === "online" ||
    /zoom|meet|virtual|online/i.test(event.geo_address_info?.full_address || event.location || "")
  );

  const loc = event.geo_address_info?.full_address || event.location || (isVirtual ? "Virtual (Luma)" : "Campus Hub");
  const title = event.name || event.title || "Luma Event";
  const desc = event.description_md || event.description || "";

  // Infer category from title and description
  let cat: EventRecord["cat"] = "meeting";
  const lower = (title + " " + desc).toLowerCase();
  if (/hack|build|sprint|demo day/i.test(lower)) cat = "hackathon";
  else if (/workshop|class|course|hands-on/i.test(lower)) cat = "workshop";
  else if (/career|founders|hiring|investor/i.test(lower)) cat = "career";
  else if (/mixer|social|party|music|dinner/i.test(lower)) cat = "social";
  else if (/run|sports|tournament|walk|fitness/i.test(lower)) cat = "sports";

  const catLabels: Record<string, string> = {
    meeting: "Luma Meetup",
    hackathon: "Luma Hack",
    career: "Luma Career",
    workshop: "Luma Workshop",
    social: "Luma Social",
    sports: "Luma Activity",
  };

  const catIcons: Record<string, string> = {
    meeting: "i-msg",
    hackathon: "i-code",
    career: "i-brief",
    workshop: "i-wrench",
    social: "i-music",
    sports: "i-ball",
  };

  const hostName = event.hosts?.[0]?.name || event.calendar?.name || "Luma Host";
  const hostCode = (event.calendar?.name || hostName).slice(0, 2).toUpperCase();

  // Determine when bucket
  const now = new Date();
  const dayDiff = Math.round((startAt.getTime() - now.getTime()) / (1000 * 3600 * 24));
  let when: EventRecord["when"] = "future";
  const dayOfWeek = startAt.getDay();
  if (dayDiff === 0) {
    when = "today";
  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
    when = "weekend";
  } else if (dayDiff <= 7 && dayDiff >= 0) {
    when = "week";
  }

  return {
    id: `luma_${event.api_id || event.id || Math.random().toString(36).slice(2, 9)}`,
    title,
    cat,
    catLabel: catLabels[cat] || "Luma Event",
    catIcon: catIcons[cat] || "i-luma",
    month,
    day,
    dow,
    date: startAt.toISOString().slice(0, 10),
    time,
    duration,
    loc,
    isVirtual,
    registered: event.guest_count ?? (event.num_tickets_registered ?? 0),
    capacity: event.capacity ?? 100,
    host: hostName,
    hostCode: hostCode || "LU",
    flags: {
      food: /pizza|food|drinks|snacks|dinner|lunch|refreshments/i.test(desc),
      virtual: isVirtual,
      going: false,
    },
    when,
    description: desc,
    status: event.status || "live",
    visibility: event.visibility || "public",
    isFeatured: Boolean(event.featured || event.is_featured),
  };
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.LUMA_API_KEY;

  if (!apiKey) {
    // No API key configured -> return empty list with zero fallbacks
    return NextResponse.json({
      events: [],
      source: "luma",
      count: 0,
      message: "LUMA_API_KEY is not configured.",
    });
  }

  try {
    // Fetch all events accessible to the API key
    const endpoints = [
      "https://api.lu.ma/public/v1/calendar/list-events",
      "https://api.lu.ma/public/v1/event/list",
    ];

    let rawList: any[] = [];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          headers: {
            "x-luma-api-key": apiKey,
            "Accept": "application/json",
          },
          next: { revalidate: 30 },
        });

        if (res.ok) {
          const data = await res.json();
          const items = data.entries || data.events || data.items || [];
          if (Array.isArray(items) && items.length > 0) {
            rawList.push(...items);
          }
        }
      } catch {
        // continue to next endpoint
      }
    }

    if (rawList.length > 0) {
      // Deduplicate by event api_id or id
      const seen = new Set<string>();
      const dedupedRaw: any[] = [];
      for (const item of rawList) {
        const id = item.event?.api_id || item.event?.id || item.api_id || item.id;
        if (id && !seen.has(id)) {
          seen.add(id);
          dedupedRaw.push(item);
        } else if (!id) {
          dedupedRaw.push(item);
        }
      }

      const events = dedupedRaw.map(normalizeLumaEvent);
      return NextResponse.json({
        events,
        source: "luma_live_api",
        count: events.length,
      });
    }

    // If request succeeded but returned 0 events
    return NextResponse.json({
      events: [],
      source: "luma_live_api",
      count: 0,
    });
  } catch (apiErr: any) {
    console.error("[Luma API Error]", apiErr.message);
    return NextResponse.json(
      {
        events: [],
        source: "luma",
        count: 0,
        error: apiErr.message,
      },
      { status: 500 }
    );
  }
}
