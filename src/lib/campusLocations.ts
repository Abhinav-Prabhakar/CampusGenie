// Server-side campus location lookup backed by the Databricks Lakehouse.
// Resolves what students say ("canteen", "the library") against the
// campus_locations table for the college stored on their profile.
import { executeLakehouseSql } from "@/lib/lakehouse";
import { DEFAULT_COLLEGE } from "@/lib/appUsers";
import type { DirectionsPoint } from "@/lib/campusDirections";

export type CampusLocationRow = {
  locationId: string;
  college: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description: string;
};

// Students rarely use exact table names; expand common campus slang.
const SYNONYMS: Record<string, string[]> = {
  canteen: ["canteen", "dining", "mess"],
  cafe: ["cafe", "canteen", "coffee"],
  dining: ["dining", "canteen", "cafe"],
  library: ["library"],
  gym: ["gym", "sports"],
  sports: ["sports", "gym"],
  hostel: ["hostel", "housing", "dorm"],
  dorm: ["dorm", "hostel", "housing"],
  dormitory: ["dorm", "hostel", "housing"],
  class: ["academics", "lecture", "hall"],
  lecture: ["academics", "lecture"],
  lab: ["lab"],
  auditorium: ["auditorium"],
  clinic: ["wellness", "health"],
  medical: ["health", "wellness"],
};

export function normalizeLocationTerm(term: string): string {
  return String(term || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sqlString(value: string): string {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

/**
 * The college saved on the student's profile (app_users.college in the
 * Lakehouse). Falls back to the default campus when unknown.
 */
export async function getCollegeForUser(userId?: string | null): Promise<string> {
  if (!userId) return DEFAULT_COLLEGE;
  try {
    const res = await executeLakehouseSql(
      `SELECT college FROM workspace.campus_explorer.app_users WHERE user_id = ${sqlString(userId)}`,
      undefined,
      20
    );
    if (res.state === "SUCCEEDED" && res.records && res.records.length > 0) {
      return (res.records[0].college as string) || DEFAULT_COLLEGE;
    }
  } catch {
    console.warn("[campusLocations] college lookup failed");
  }
  return DEFAULT_COLLEGE;
}

export async function fetchCampusLocations(college: string): Promise<CampusLocationRow[]> {
  const select = (where: string) =>
    `SELECT location_id, college, name, category, lat, lng, description FROM workspace.campus_explorer.campus_locations${where}`;
  const mapRows = (rows: Array<Record<string, any>>): CampusLocationRow[] =>
    rows
      .filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)))
      .map((r) => ({
        locationId: String(r.location_id || ""),
        college: String(r.college || ""),
        name: String(r.name || ""),
        category: String(r.category || ""),
        lat: Number(r.lat),
        lng: Number(r.lng),
        description: String(r.description || ""),
      }));

  const scoped = await executeLakehouseSql(select(` WHERE college = ${sqlString(college)}`), undefined, 20);
  if (scoped.state === "SUCCEEDED" && scoped.records && scoped.records.length > 0) return mapRows(scoped.records);

  // Custom college names still resolve against the shared catalog.
  const all = await executeLakehouseSql(select(""), undefined, 20);
  if (all.state === "SUCCEEDED" && Array.isArray(all.records)) return mapRows(all.records);
  return [];
}

function scoreCandidate(row: CampusLocationRow, normTerm: string): number {
  const name = normalizeLocationTerm(row.name);
  const category = normalizeLocationTerm(row.category);
  const terms = new Set<string>([normTerm, ...(SYNONYMS[normTerm] || [])]);
  let best = 0;
  for (const term of terms) {
    if (!term) continue;
    if (name === term) best = Math.max(best, 100);
    else if (name.includes(term)) best = Math.max(best, 80);
    else if (category === term) best = Math.max(best, 70);
    else if (category.includes(term)) best = Math.max(best, 60);
    else {
      const tokens = name.split(" ");
      if (tokens.some((t) => t === term)) best = Math.max(best, 55);
      else if (normTerm.split(" ").some((qt) => qt.length >= 4 && tokens.includes(qt))) best = Math.max(best, 45);
    }
  }
  return best;
}

/** Resolve a free-text place ("the library", "Main Canteen") to a campus point. */
export function resolveCampusPoint(
  rows: CampusLocationRow[],
  rawTerm: string
): { point: DirectionsPoint; score: number } | null {
  const normTerm = normalizeLocationTerm(rawTerm);
  if (!normTerm || rows.length === 0) return null;
  let best: { row: CampusLocationRow; score: number } | null = null;
  for (const row of rows) {
    const score = scoreCandidate(row, normTerm);
    if (score >= 45 && (!best || score > best.score)) best = { row, score };
  }
  if (!best) return null;
  return {
    point: {
      name: best.row.name,
      lat: best.row.lat,
      lng: best.row.lng,
      category: best.row.category,
    },
    score: best.score,
  };
}

// ── Location name listing (system prompt + error hints), short-TTL cached ────

let namesCache: { college: string; names: string[]; at: number } | null = null;
const NAMES_TTL_MS = 60_000;

export async function listCampusLocationNames(college: string): Promise<string[]> {
  if (namesCache && namesCache.college === college && Date.now() - namesCache.at < NAMES_TTL_MS) {
    return namesCache.names;
  }
  const rows = await fetchCampusLocations(college);
  const names = rows.map((r) => r.name);
  namesCache = { college, names, at: Date.now() };
  return names;
}
