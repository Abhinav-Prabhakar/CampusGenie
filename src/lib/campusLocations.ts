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
  canteen: ["canteen", "dining", "mess", "cafeteria", "cafe", "food", "eatery"],
  cafeteria: ["canteen", "dining", "mess", "cafeteria", "cafe", "food", "eatery"],
  cafe: ["cafe", "canteen", "coffee", "cafeteria", "food"],
  coffee: ["cafe", "canteen", "coffee"],
  dining: ["dining", "canteen", "cafe", "cafeteria", "mess", "food"],
  food: ["canteen", "dining", "cafe"],
  library: ["library", "reading", "books", "study"],
  gym: ["gym", "sports", "court", "fitness"],
  court: ["sports", "gym", "court"],
  sports: ["sports", "gym", "court", "turf"],
  hostel: ["hostel", "housing", "dorm", "residence"],
  dorm: ["dorm", "hostel", "housing", "residence"],
  dormitory: ["dorm", "hostel", "housing", "residence"],
  housing: ["housing", "hostel", "dorm", "residence"],
  class: ["academics", "lecture", "hall", "classroom"],
  lecture: ["academics", "lecture", "hall", "classroom"],
  hall: ["hall", "academics", "auditorium", "lecture"],
  lab: ["lab", "innovation", "robotics", "maker"],
  robotics: ["lab", "innovation"],
  innovation: ["lab", "maker"],
  auditorium: ["auditorium", "amphitheatre", "stage", "theatre"],
  stage: ["auditorium", "quad"],
  firepit: ["auditorium", "quad"],
  clinic: ["wellness", "health", "hospital", "doctor"],
  medical: ["health", "wellness", "clinic"],
  health: ["health", "wellness", "clinic", "medical"],
  gate: ["gate", "entrance", "main gate", "security"],
  entrance: ["gate", "entrance", "main gate"],
  admin: ["admin", "administration", "dean", "registrar"],
  office: ["admin", "administration"],
};

export function normalizeLocationTerm(term: string): string {
  return String(term || "")
    .toLowerCase()
    .replace(/\b(the|main|room|building|hall|block)\b/g, " ")
    .replace(/\b\d+[a-z]?\b/gi, " ") // strip room numbers like 210, 214, 317
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The college saved on the student's profile (app_users.college in the
 * Lakehouse). Falls back to the default campus when unknown.
 */
export async function getCollegeForUser(userId?: string | null): Promise<string> {
  if (!userId) return DEFAULT_COLLEGE;
  try {
    const res = await executeLakehouseSql(
      "SELECT college FROM workspace.campus_explorer.app_users WHERE user_id = :user_id",
      undefined,
      20,
      [{ name: "user_id", value: userId }]
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

  const scoped = await executeLakehouseSql(select(" WHERE college = :college"), undefined, 20, [
    { name: "college", value: college },
  ]);
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
