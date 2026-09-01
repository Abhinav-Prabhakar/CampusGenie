import { NextRequest, NextResponse } from "next/server";
import type { EventRecord } from "@/app/api/events/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Curated high-fidelity Luma tech & campus community events
 * (used as instant fallback when LUMA_API_KEY is not configured or offline)
 */
const SAMPLE_LUMA_EVENTS: EventRecord[] = [
  {
    id: "luma_evt_01",
    title: "AI Agents & Autonomous Workflows Builders Night",
    cat: "hackathon",
    catLabel: "Luma Hack",
    catIcon: "i-code",
    month: "APR",
    day: "18",
    dow: "FRI",
    date: "2026-04-18",
    time: "5:30 PM",
    duration: "4h",
    loc: "Hacker Dojo / Zoom",
    isVirtual: true,
    registered: 142,
    capacity: 200,
    host: "Luma Builders Guild",
    hostCode: "LU",
    flags: { food: true, virtual: true, going: true },
    when: "week",
    description: "Hands-on build sprint creating autonomous AI agents, tool-calling reasoning loops, and multi-agent coordination frameworks with pizza and mentorship.",
    status: "live",
    visibility: "public",
    isFeatured: true,
  },
  {
    id: "luma_evt_02",
    title: "Databricks & Delta Lake Community Mixer",
    cat: "meeting",
    catLabel: "Luma Meetup",
    catIcon: "i-msg",
    month: "APR",
    day: "21",
    dow: "MON",
    date: "2026-04-21",
    time: "6:00 PM",
    duration: "2.5h",
    loc: "Tech Center Atrium, 3rd Floor",
    isVirtual: false,
    registered: 88,
    capacity: 120,
    host: "Lakehouse Developers",
    hostCode: "LU",
    flags: { food: true, virtual: false, going: false },
    when: "week",
    description: "Connect with data engineers, ML practitioners, and Databricks users building production analytics and Genie agent workflows on Unity Catalog.",
    status: "live",
    visibility: "public",
    isFeatured: false,
  },
  {
    id: "luma_evt_03",
    title: "Frontiers of LLM Fine-Tuning & Distillation",
    cat: "workshop",
    catLabel: "Luma Workshop",
    catIcon: "i-wrench",
    month: "APR",
    day: "24",
    dow: "THU",
    date: "2026-04-24",
    time: "4:00 PM",
    duration: "2h",
    loc: "Engineering Hall 102 & Stream",
    isVirtual: true,
    registered: 195,
    capacity: 250,
    host: "Open Science Club",
    hostCode: "LU",
    flags: { food: false, virtual: true, going: false },
    when: "future",
    description: "Deep dive into model quantization, LoRA parameter-efficient fine-tuning, reasoning distillation, and evaluation benchmarks.",
    status: "live",
    visibility: "public",
    isFeatured: false,
  },
  {
    id: "luma_evt_04",
    title: "Early-Stage Founders & Tech Demo Night",
    cat: "career",
    catLabel: "Luma Demo Day",
    catIcon: "i-brief",
    month: "APR",
    day: "26",
    dow: "SAT",
    date: "2026-04-26",
    time: "6:30 PM",
    duration: "3h",
    loc: "Venture Commons Quad",
    isVirtual: false,
    registered: 110,
    capacity: 150,
    host: "Campus Incubator",
    hostCode: "LU",
    flags: { food: true, virtual: false, going: true },
    when: "weekend",
    description: "Watch student founders and collegiate startups demo their latest AI applications, robotics prototypes, and developer tools to angel investors.",
    status: "live",
    visibility: "public",
    isFeatured: true,
  },
  {
    id: "luma_evt_05",
    title: "Full-Stack Next.js 16 & Turbopack Masterclass",
    cat: "workshop",
    catLabel: "Luma Workshop",
    catIcon: "i-wrench",
    month: "MAY",
    day: "02",
    dow: "SAT",
    date: "2026-05-02",
    time: "1:00 PM",
    duration: "3h",
    loc: "Computer Science Lab 4",
    isVirtual: true,
    registered: 76,
    capacity: 100,
    host: "Frontend Collective",
    hostCode: "LU",
    flags: { food: true, virtual: true, going: false },
    when: "future",
    description: "Master server actions, partial prerendering, parallel streaming routes, and edge runtime optimizations with modern Next.js.",
    status: "live",
    visibility: "public",
    isFeatured: false,
  },
  {
    id: "luma_evt_06",
    title: "Open Source AI & Rust Systems Jam",
    cat: "social",
    catLabel: "Luma Social",
    catIcon: "i-music",
    month: "MAY",
    day: "08",
    dow: "FRI",
    date: "2026-05-08",
    time: "7:00 PM",
    duration: "3.5h",
    loc: "Student Union Lounge",
    isVirtual: false,
    registered: 64,
    capacity: 80,
    host: "Systems & Rust Guild",
    hostCode: "LU",
    flags: { food: true, virtual: false, going: false },
    when: "future",
    description: "Casual evening of lightning talks, open source repo walkthroughs, live coding, and pizza for systems programmers and AI enthusiasts.",
    status: "live",
    visibility: "public",
    isFeatured: false,
  },
  {
    id: "luma_evt_07",
    title: "Campus Hackers Indiranagar Tech Crawl",
    cat: "sports",
    catLabel: "Luma Meetup",
    catIcon: "i-ball",
    month: "MAY",
    day: "10",
    dow: "SUN",
    date: "2026-05-10",
    time: "9:30 AM",
    duration: "4h",
    loc: "Indiranagar 100ft Road",
    isVirtual: false,
    registered: 35,
    capacity: 50,
    host: "Bengaluru Tech Walkers",
    hostCode: "LU",
    flags: { food: true, virtual: false, going: false },
    when: "future",
    description: "Morning walking meetup through top startup cafes, co-working hubs, and indie hacker spaces with coffee and networking.",
    status: "live",
    visibility: "public",
    isFeatured: false,
  },
  {
    id: "luma_evt_08",
    title: "GenAI Product Design & UX Critique Circle",
    cat: "workshop",
    catLabel: "Luma Design",
    catIcon: "i-wrench",
    month: "MAY",
    day: "14",
    dow: "THU",
    date: "2026-05-14",
    time: "5:00 PM",
    duration: "2h",
    loc: "Design Studio 204",
    isVirtual: true,
    registered: 52,
    capacity: 60,
    host: "Product Design Guild",
    hostCode: "LU",
    flags: { food: false, virtual: true, going: false },
    when: "future",
    description: "Bring your AI user interfaces, prompt bar interactions, and reasoning canvases for peer critique and heuristic reviews.",
    status: "live",
    visibility: "public",
    isFeatured: false,
  },
];

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
  const title = event.name || event.title || "Luma Community Event";
  const desc = event.description_md || event.description || "Join us for this exciting Luma event.";

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

  const hostName = event.hosts?.[0]?.name || event.calendar?.name || "Luma Community";

  return {
    id: `luma_${event.api_id || event.id || Math.random().toString(36).slice(2, 9)}`,
    title,
    cat,
    catLabel: catLabels[cat] || "Luma Event",
    catIcon: catIcons[cat] || "i-spark",
    month,
    day,
    dow,
    date: startAt.toISOString().slice(0, 10),
    time,
    duration,
    loc,
    isVirtual,
    registered: event.guest_count || Math.floor(Math.random() * 40 + 30),
    capacity: event.capacity || 100,
    host: hostName,
    hostCode: "LU",
    flags: {
      food: /pizza|food|drinks|snacks|dinner|lunch|refreshments/i.test(desc),
      virtual: isVirtual,
      going: false,
    },
    when: "future",
    description: desc,
    status: "live",
    visibility: "public",
    isFeatured: Boolean(event.featured || event.is_featured),
  };
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.LUMA_API_KEY;
  const calendarId = process.env.LUMA_CALENDAR_ID;

  if (apiKey) {
    try {
      // Fetch from official Luma public API
      const endpoint = calendarId
        ? `https://api.lu.ma/public/v1/calendar/get-items?calendar_api_id=${encodeURIComponent(calendarId)}`
        : `https://api.lu.ma/public/v1/calendar/list-events`;

      const res = await fetch(endpoint, {
        headers: {
          "x-luma-api-key": apiKey,
          "Accept": "application/json",
        },
        next: { revalidate: 60 },
      });

      if (res.ok) {
        const data = await res.json();
        const rawList = data.entries || data.events || data.items || [];
        if (Array.isArray(rawList) && rawList.length > 0) {
          const events = rawList.map(normalizeLumaEvent);
          return NextResponse.json({
            events,
            source: "luma_live_api",
            count: events.length,
          });
        }
      } else {
        console.warn(`[Luma API] Response status: ${res.status}, falling back to curated events.`);
      }
    } catch (apiErr: any) {
      console.warn("[Luma API Error]", apiErr.message);
    }
  }

  // Curated fallback
  return NextResponse.json({
    events: SAMPLE_LUMA_EVENTS,
    source: "luma_curated",
    count: SAMPLE_LUMA_EVENTS.length,
  });
}
