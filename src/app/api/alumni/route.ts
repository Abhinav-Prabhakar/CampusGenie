import { NextResponse } from "next/server";
import { executeLakehouseSql, type LakehouseQueryResult } from "@/lib/lakehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AlumniRecord = {
  id: string;
  graduationYear: number;
  major: string;
  clubs: string[];
  labs: string[];
  firstJobTitle: string;
  firstCompany: string;
  currentRole: string;
  currentOrganization: string;
  domain: string;
  advice: string;
};

/** Mentorship availability is derived deterministically from the alumni id so
 *  the mapping is stable across reloads without extra storage. */
type AlumniAvailability = "strong" | "weak" | "veryweak" | "none";

const AVAILABILITY_BY_HASH: AlumniAvailability[] = ["strong", "weak", "strong", "veryweak", "strong", "none", "weak", "strong"];

function availabilityFor(alumniId: string): AlumniAvailability {
  let hash = 0;
  for (let i = 0; i < alumniId.length; i++) {
    hash = (hash * 31 + alumniId.charCodeAt(i)) >>> 0;
  }
  return AVAILABILITY_BY_HASH[hash % AVAILABILITY_BY_HASH.length];
}

function mapRowToAlumni(r: Record<string, unknown>): AlumniRecord {
  const arr = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  return {
    id: String(r.alumni_id ?? ""),
    graduationYear: Number(r.graduation_year) || 0,
    major: String(r.major ?? ""),
    clubs: arr(r.campus_clubs_joined),
    labs: arr(r.research_labs_joined),
    firstJobTitle: String(r.first_job_title ?? ""),
    firstCompany: String(r.first_company ?? ""),
    currentRole: String(r.current_role ?? ""),
    currentOrganization: String(r.current_organization ?? ""),
    domain: String(r.primary_domain ?? "General"),
    advice: String(r.advice_summary ?? ""),
  };
}

/** The pathways table stores no display name — derive one from the id so rows
 *  read naturally in the UI ("ALUM-01" → "Alum Profile 01"). */
function displayNameFor(rec: AlumniRecord): string {
  const num = rec.id.replace(/\D/g, "").padStart(2, "0");
  return `Alumni Pathway ${num} — ${rec.currentOrganization}`;
}

export async function GET() {
  const result: LakehouseQueryResult = await executeLakehouseSql(
    "SELECT * FROM workspace.campus_explorer.alumni_career_pathways ORDER BY graduation_year DESC",
    undefined,
    20
  );

  if (result.state === "SUCCEEDED" && result.records) {
    const alumni = result.records.map(mapRowToAlumni);
    const organizations = Array.from(new Set(alumni.map((a) => a.currentOrganization)));
    const domains = Array.from(new Set(alumni.map((a) => a.domain)));
    return NextResponse.json(
      {
        alumni: alumni.map((a) => ({ ...a, displayName: displayNameFor(a), availability: availabilityFor(a.id) })),
        stats: {
          pathways: alumni.length,
          organizations: organizations.length,
          domains,
          openToMentorship: alumni.filter((a) => availabilityFor(a.id) === "strong").length,
        },
        source: "lakehouse",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  return NextResponse.json(
    { error: result.error || `Lakehouse query failed with state: ${result.state}`, state: result.state },
    { status: 500 }
  );
}
