export const CORE_QUESTION =
  "I am a third-year CSE student interested in AI, free Friday after 4 PM, under INR 300, and within 30 minutes. What verified opportunity should I join?";

export const GOVERNED_TABLES = [
  "campus_events",
  "clubs_labs",
  "recruitment_windows",
  "alumni_outcomes",
] as const;

export type Opportunity = {
  id: string;
  title: string;
  type: string;
  host: string | null;
  startsAt: string | null;
  schedule: string | null;
  location: string | null;
  commuteMinutes: number | null;
  feeInr: number | null;
  eligibility: string | null;
  recruitmentStatus: string | null;
  sourceUrl: string | null;
  sourceTables: string[];
  lastUpdated: string | null;
  whyMatch: string[];
  matchExplanation: string;
  synthetic: boolean;
};

export type GenieEvidence = {
  agentName: string;
  tables: string[];
  sql: string[];
  rowsReturned: number;
  freshness: string | null;
  statementIds: string[];
  truncated: boolean;
};

export type NavigatorStatus = "ok" | "no_results" | "out_of_scope" | "unavailable";

export type NavigatorResponse = {
  ok: boolean;
  status: NavigatorStatus;
  answer: string;
  conversationId?: string;
  opportunities: Opportunity[];
  evidence?: GenieEvidence;
  error?: { code: string; message: string; requestId?: string };
};

const SCOPE_TERMS = [
  "opportunity", "event", "workshop", "hackathon", "meetup", "club", "lab", "research",
  "recruit", "campus", "bengaluru", "bangalore", "ai", "career", "application", "eligibility",
  "friday", "weekend", "after 4", "commute", "budget", "cse", "student",
];

export function isOpportunityQuestion(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return SCOPE_TERMS.some((term) => normalized.includes(term));
}

function getValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  }
  return null;
}

function asString(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asSafeUrl(value: unknown): string | null {
  const candidate = asString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function indiaDateParts(value: string): { weekday: string; hour: number } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return weekday && Number.isFinite(hour) ? { weekday, hour } : null;
}

export function extractTablesFromSql(sql: string): string[] {
  const found = new Set<string>();
  for (const match of sql.matchAll(/\b(?:FROM|JOIN)\s+[`"]?([\w.]+)[`"]?/gi)) {
    const table = match[1].split(".").pop()?.toLowerCase();
    if (table && (GOVERNED_TABLES as readonly string[]).includes(table)) found.add(table);
  }
  return [...found];
}

export function latestTimestamp(records: Array<Record<string, unknown>>): string | null {
  const values = records
    .map((record) => asString(getValue(record, ["updated_at", "last_updated", "last_updated_at", "created_at"])))
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => b.time - a.time);
  return values[0]?.value || null;
}

function buildWhyMatch(record: Record<string, unknown>, prompt: string): string[] {
  const why: string[] = [];
  const normalized = prompt.toLowerCase();
  const searchable = Object.values(record).join(" ").toLowerCase();
  const fee = asNumber(getValue(record, ["fee_inr", "entry_fee_inr", "cost_inr", "price_inr"]));
  const commute = asNumber(getValue(record, ["commute_minutes", "commute_mins_from_campus", "travel_minutes"]));
  const startsAt = asString(getValue(record, ["starts_at", "start_at", "event_date", "date"]));
  const startsAtParts = startsAt ? indiaDateParts(startsAt) : null;
  const status = asString(getValue(record, ["recruitment_status", "status", "recruitment_open"]));

  if (normalized.includes("ai") && /(\bai\b|artificial intelligence|machine learning|llm|genie|data)/i.test(searchable)) {
    why.push("Relevant to AI or data interests");
  }
  const budgetMatch = normalized.match(/(?:under|below|within)\s*(?:inr|₹)?\s*(\d+)/i);
  if (budgetMatch && fee !== null && fee <= Number(budgetMatch[1])) why.push(`Within the ₹${budgetMatch[1]} budget`);
  if (normalized.includes("30 minute") && commute !== null && commute <= 30) why.push("Within the 30-minute travel limit");
  if (normalized.includes("friday") && startsAtParts?.weekday === "Fri") why.push("Scheduled on Friday");
  if (normalized.includes("after 4") && startsAtParts && startsAtParts.hour >= 16) why.push("Starts after 4 PM");
  if (status && /open|rolling|published|active|true/i.test(status)) why.push("Open or active for students");
  return why;
}

export function normalizeOpportunityRecords(
  records: Array<Record<string, unknown>>,
  prompt: string,
  sourceTables: string[],
): Opportunity[] {
  return records
    .map((record, index): Opportunity | null => {
      const title = asString(getValue(record, ["title", "name", "opportunity_title", "event_title"]));
      if (!title) return null;
      const whyMatch = buildWhyMatch(record, prompt);
      const id = asString(getValue(record, ["opportunity_id", "event_id", "entity_id", "meetup_id", "id"])) || `result-${index + 1}`;
      const startsAt = asString(getValue(record, ["starts_at", "start_at", "event_datetime", "event_date", "date"]));
      const updatedAt = asString(getValue(record, ["updated_at", "last_updated", "last_updated_at", "created_at"]));
      return {
        id,
        title,
        type: asString(getValue(record, ["opportunity_type", "type", "category", "domain"])) || "Opportunity",
        host: asString(getValue(record, ["host_name", "host_organization", "organizer", "host"])),
        startsAt,
        schedule: asString(getValue(record, ["schedule", "meeting_schedule", "start_time"])),
        location: asString(getValue(record, ["location_name", "location", "venue_address", "neighborhood"])),
        commuteMinutes: asNumber(getValue(record, ["commute_minutes", "commute_mins_from_campus", "travel_minutes"])),
        feeInr: asNumber(getValue(record, ["fee_inr", "entry_fee_inr", "cost_inr", "price_inr"])),
        eligibility: asString(getValue(record, ["eligibility", "eligibility_text", "eligible_students", "required_skills"])),
        recruitmentStatus: asString(getValue(record, ["recruitment_status", "status", "recruitment_open"])),
        sourceUrl: asSafeUrl(getValue(record, ["source_url", "registration_url", "application_url", "url"])),
        sourceTables,
        lastUpdated: updatedAt,
        whyMatch,
        matchExplanation: whyMatch.length > 0
          ? `Genie returned this row with ${whyMatch.length} verifiable constraint${whyMatch.length === 1 ? "" : "s"} present in the data.`
          : "Genie returned this opportunity, but the result row does not expose enough fields to verify the requested constraints.",
        synthetic: asBoolean(getValue(record, ["is_synthetic", "synthetic"])),
      };
    })
    .filter((opportunity): opportunity is Opportunity => Boolean(opportunity));
}
