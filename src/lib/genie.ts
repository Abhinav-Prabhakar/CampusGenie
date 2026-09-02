import { execFile } from "child_process";
import { promisify } from "util";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { fetchCampusLocations, resolveCampusPoint } from "@/lib/campusLocations";
import { buildWalkingRoute, extractDirectionEndpoints, type DirectionsPayload } from "@/lib/campusDirections";
import { DEFAULT_COLLEGE } from "@/lib/appUsers";

const execFileAsync = promisify(execFile);

type GenieMessage = {
  status?: string;
  attachments?: Array<{
    attachment_id?: string;
    text?: { content?: string; purpose?: string };
    query?: { query?: string; description?: string; thoughts?: Array<{ content?: string }> };
    suggested_questions?: { questions?: string[] };
  }>;
};

type GenieConfig = {
  host: string;
  token: string;
  spaceId: string;
};

async function getDatabricksToken(): Promise<string> {
  if (process.env.DATABRICKS_TOKEN) return process.env.DATABRICKS_TOKEN;

  // Desktop-launched Next processes may not inherit the shell PATH. Keep
  // token auth as the preferred deployment path, but make local U2M auth
  // work with the standard macOS/Linux CLI locations as well.
  const candidates = [
    process.env.DATABRICKS_CLI_PATH,
    "/opt/homebrew/bin/databricks",
    "/usr/local/bin/databricks",
    "databricks",
  ].filter((path): path is string => Boolean(path));
  let lastError: unknown;
  for (const executable of candidates) {
    try {
      const { stdout } = await execFileAsync(executable, ["auth", "token"], {
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
        },
      });
      const token = JSON.parse(stdout).access_token;
      if (token) return token;
    } catch (error: any) {
      lastError = error;
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(
    `Databricks authentication is not configured. Set DATABRICKS_TOKEN${lastError instanceof Error ? ` (${lastError.message})` : ""}.`
  );
}

async function genieFetch(config: GenieConfig, path: string, init: RequestInit = {}) {
  return fetch(`${config.host}/api/2.0/genie${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function recordsFromStatementResponse(response: any): Record<string, unknown>[] {
  const statement = response?.statement_response || response;
  const columns = statement?.manifest?.schema?.columns?.map((column: any) => column.name) || [];
  return (statement?.result?.data_array || []).map((row: unknown[]) =>
    Object.fromEntries(columns.map((column: string, index: number) => [column, row[index]]))
  );
}

type LakehouseEvent = {
  event_id: string;
  title: string;
};

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeEventId(value: unknown): string | null {
  const match = String(value || "").match(/^EV-?(\d+)$/i);
  return match ? `EV-${match[1]}` : null;
}

async function getLiveLakehouseEvents(): Promise<LakehouseEvent[]> {
  const result = await executeLakehouseSql(
    "SELECT event_id, title FROM workspace.campus_explorer.campus_events WHERE visibility = 'public' ORDER BY event_date ASC, start_time ASC",
    undefined,
    20
  );

  if (result.state !== "SUCCEEDED" || !result.records) return [];
  return result.records
    .map((record) => ({
      event_id: String(record.event_id || ""),
      title: String(record.title || ""),
    }))
    .filter((event) => Boolean(normalizeEventId(event.event_id) && normalizeText(event.title)));
}

function resolveLiveEventIds(
  records: Record<string, unknown>[],
  answer: string,
  prompt: string,
  liveEvents: LakehouseEvent[]
): string[] {
  const ids = new Set<string>();
  const textCandidates = [answer, prompt, ...records.flatMap((record) => Object.values(record).map(String))]
    .map(normalizeText)
    .filter(Boolean);

  for (const record of records) {
    for (const value of Object.values(record)) {
      const id = normalizeEventId(value);
      if (id) ids.add(id);
    }
  }

  for (const event of liveEvents) {
    const id = normalizeEventId(event.event_id);
    const title = normalizeText(event.title);
    if (!id || !title) continue;

    if (textCandidates.some((candidate) => candidate.includes(title))) {
      ids.add(id);
    }
  }

  const liveIds = new Set(liveEvents.map((event) => normalizeEventId(event.event_id)).filter(Boolean));
  return Array.from(ids).filter((id) => liveIds.has(id));
}


export async function resolveGenieWalkingRoute(
  prompt: string,
  answer: string,
  records: Record<string, unknown>[],
  college: string = DEFAULT_COLLEGE
): Promise<DirectionsPayload | null> {
  const locations = await fetchCampusLocations(college);
  if (!locations || locations.length === 0) return null;

  // 1. Check prompt or answer for explicit endpoints ("from X to Y")
  const endpoints = extractDirectionEndpoints(prompt) || extractDirectionEndpoints(answer);
  if (endpoints) {
    const fromMatch = resolveCampusPoint(locations, endpoints.from);
    const toMatch = resolveCampusPoint(locations, endpoints.to);
    if (fromMatch && toMatch && fromMatch.point.name !== toMatch.point.name) {
      return buildWalkingRoute(fromMatch.point, toMatch.point, college);
    }
    if (toMatch && !fromMatch) {
      const defaultHub =
        locations.find((l) => /main gate|central library|student center/i.test(l.name) && l.name !== toMatch.point.name) ||
        locations.find((l) => l.name !== toMatch.point.name);
      if (defaultHub) {
        return buildWalkingRoute(
          { name: defaultHub.name, lat: defaultHub.lat, lng: defaultHub.lng, category: defaultHub.category },
          toMatch.point,
          college
        );
      }
    }
    if (fromMatch && !toMatch) {
      const defaultDest =
        locations.find((l) => /main canteen|student center|central library/i.test(l.name) && l.name !== fromMatch.point.name) ||
        locations.find((l) => l.name !== fromMatch.point.name);
      if (defaultDest) {
        return buildWalkingRoute(
          fromMatch.point,
          { name: defaultDest.name, lat: defaultDest.lat, lng: defaultDest.lng, category: defaultDest.category },
          college
        );
      }
    }
  }

  // 2. Check if Genie SQL query returned location records
  const locRecords = records.filter(
    (r) =>
      (r.lat !== undefined && r.lng !== undefined) ||
      (r.location_id !== undefined && r.name !== undefined) ||
      r.building !== undefined
  );
  if (locRecords.length >= 2) {
    const p1 = resolveCampusPoint(locations, String(locRecords[0].name || locRecords[0].building || ""));
    const p2 = resolveCampusPoint(locations, String(locRecords[1].name || locRecords[1].building || ""));
    if (p1 && p2 && p1.point.name !== p2.point.name) {
      return buildWalkingRoute(p1.point, p2.point, college);
    }
  }

  // 3. Navigation intent detection in prompt
  const hasNavIntent = /\b(directions?|navigate|navigation|map|route|walk|walking|path|where is|how (do i|to) (get|reach|walk|go)|way to|locate)\b/i.test(prompt);
  if (hasNavIntent) {
    const matches: Array<{ loc: (typeof locations)[0]; score: number }> = [];
    for (const loc of locations) {
      const match = resolveCampusPoint([loc], prompt);
      if (match && match.score >= 45) {
        matches.push({ loc, score: match.score });
      }
    }
    matches.sort((a, b) => b.score - a.score);

    if (matches.length >= 2 && matches[0].loc.name !== matches[1].loc.name) {
      const p1 = resolveCampusPoint(locations, matches[0].loc.name);
      const p2 = resolveCampusPoint(locations, matches[1].loc.name);
      if (p1 && p2 && p1.point.name !== p2.point.name) {
        return buildWalkingRoute(p1.point, p2.point, college);
      }
    } else if (matches.length === 1) {
      const dest = resolveCampusPoint(locations, matches[0].loc.name);
      if (dest) {
        const defaultHub =
          locations.find((l) => /main gate|student center|dorm|hostel|entrance/i.test(l.name) && l.name !== dest.point.name) ||
          locations.find((l) => l.name !== dest.point.name);

        if (defaultHub) {
          const originPoint = {
            name: defaultHub.name,
            lat: defaultHub.lat,
            lng: defaultHub.lng,
            category: defaultHub.category,
          };
          return buildWalkingRoute(originPoint, dest.point, college);
        }
      }
    }
  }

  return null;
}

export async function streamGenieConversation(
  prompt: string,
  signal: AbortSignal,
  send: (event: unknown) => void,
  college: string = DEFAULT_COLLEGE
) {
  const config: GenieConfig = {
    host: (process.env.DATABRICKS_HOST || "https://dbc-c69189ed-ede0.cloud.databricks.com").replace(/\/+$/, ""),
    token: await getDatabricksToken(),
    spaceId: process.env.DATABRICKS_GENIE_SPACE_ID || "01f1a5c5fe5110d3b2618830a3195ee7",
  };

  const geniePrompt =
`[System Context & Instructions]:
Database location: Databricks Lakehouse catalog and schema is \`workspace.campus_explorer\`.
Available governed tables:
- \`workspace.campus_explorer.knowledge_sources\`: Contains all student-uploaded documents, syllabi, guidelines, policies, user preferences, notes, and handbook text (columns: source_id, name, type, category, description, chunk_count, file_size, status, content_sample, uploaded_by, updated_at).
- \`workspace.campus_explorer.campus_events\`: Verified campus events, workshops, hackathons, and RSVPs.
- \`workspace.campus_explorer.campus_surveys\`: Pre-event track votes and student survey responses.
- \`workspace.campus_explorer.campus_locations\`: Buildings, coordinates, and navigation landmarks for ${college}.
- \`workspace.campus_explorer.app_users\`: Student profiles, degrees, minors, and preferences.

MANDATORY INSTRUCTION: You must almost always query \`workspace.campus_explorer.knowledge_sources\` (via SELECT on content_sample, description, name, category) to check for relevant background documents, uploaded sources, policies, and user preferences to ensure your answer is deeply personalized and grounded in the campus knowledge base.

Student Question:
${prompt}`;

  const start = await genieFetch(config, `/spaces/${config.spaceId}/start-conversation`, {
    method: "POST",
    body: JSON.stringify({ content: geniePrompt, enable_visualization: false }),
    signal,
  });
  if (!start.ok) throw new Error(`Genie start failed (${start.status}): ${await start.text()}`);

  const started = await start.json();
  const conversationId = started.conversation_id;
  const messageId = started.message_id;
  if (!conversationId || !messageId) throw new Error("Genie did not return a conversation or message ID");

  send({ type: "tool_status", toolName: "genie_agent", label: "Campus Genie Agent is reasoning…", active: true });

  let message: GenieMessage = {};
  for (let attempt = 0; attempt < 120; attempt++) {
    if (signal.aborted) return;
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : 1500));
    const result = await genieFetch(config, `/spaces/${config.spaceId}/conversations/${conversationId}/messages/${messageId}`, { signal });
    if (!result.ok) throw new Error(`Genie status failed (${result.status}): ${await result.text()}`);
    message = await result.json();
    if (["COMPLETED", "FAILED", "CANCELLED", "CANCELED"].includes(message.status || "")) break;
  }

  if (signal.aborted) return;
  if (!["COMPLETED"].includes(message.status || "")) {
    throw new Error(`Genie message ended with status ${message.status || "TIMEOUT"}`);
  }

  const attachments = message.attachments || [];
  const answer = attachments.find((attachment) => attachment.text?.purpose?.includes("ANSWER"))?.text?.content;
  const queries = attachments.filter((attachment) => attachment.query?.query);
  const thoughts = queries.flatMap((attachment) => attachment.query?.thoughts || []).map((thought) => thought.content).filter(Boolean);
  const genieRecords: Record<string, unknown>[] = [];

  for (const thought of thoughts) send({ choices: [{ delta: { reasoning_content: `${thought}\n` } }] });
  for (const attachment of queries) {
    const query = attachment.query?.query || "";
    send({ type: "tool_status", toolName: "genie_agent", label: `Genie SQL: ${query.slice(0, 70)}…`, active: true });
    let records: Record<string, unknown>[] = [];
    if (attachment.attachment_id) {
      const result = await genieFetch(config, `/spaces/${config.spaceId}/conversations/${conversationId}/messages/${messageId}/attachments/${attachment.attachment_id}/query-result`, { signal });
      if (result.ok) records = recordsFromStatementResponse(await result.json());
    }
    genieRecords.push(...records);
    send({ type: "tool_status", toolName: "genie_agent", label: `Genie SQL completed (${records.length} rows)`, active: false });
    send({ choices: [{ delta: { reasoning_content: `\n\`\`\`sql\n${query}\n\`\`\`\n` } }] });
  }

  let toolIndex = 0;

  // 1. Live Lakehouse events grid
  const liveEvents = await getLiveLakehouseEvents();
  const eventIds = resolveLiveEventIds(genieRecords, answer || "", prompt, liveEvents);

  if (eventIds.length > 0) {
    send({ type: "events_grid", eventIds });
    send({
      choices: [{
        delta: {
          tool_calls: [{
            index: toolIndex++,
            id: "genie_events",
            function: {
              name: "show_events_grid",
              arguments: JSON.stringify({ eventIds, summary: `Matched ${eventIds.length} live Lakehouse events` }),
            },
          }],
        },
      }],
    });
  }

  // 2. Interactive campus directions map
  const walkingRoute = await resolveGenieWalkingRoute(prompt, answer || "", genieRecords, college);
  if (walkingRoute) {
    send({ type: "directions", directions: walkingRoute });
    send({
      choices: [{
        delta: {
          tool_calls: [{
            index: toolIndex++,
            id: "genie_directions",
            function: {
              name: "show_campus_directions",
              arguments: JSON.stringify({
                from_location: walkingRoute.from.name,
                to_location: walkingRoute.to.name,
                college: walkingRoute.college,
              }),
            },
          }],
        },
      }],
    });
  }

  let finalContent = answer || "";
  if (walkingRoute && (!finalContent || finalContent.length < 30 || !finalContent.toLowerCase().includes("walking"))) {
    const stepsText = walkingRoute.steps.map((s, i) => `${i + 1}. ${s.instruction}`).join("\n");
    const directionsSummary =
      `\n\n**Walking directions from ${walkingRoute.from.name} to ${walkingRoute.to.name}:**\n` +
      `Distance: ${walkingRoute.distanceMeters} m (about ${walkingRoute.durationMinutes} min on foot)\n\n` +
      `${stepsText}\n\n` +
      `Explore the interactive 3D campus map above for turn-by-turn navigation.`;

    finalContent = finalContent ? `${finalContent.trim()}\n${directionsSummary}` : directionsSummary.trim();
  }

  send({ choices: [{ delta: { content: finalContent || "Genie completed the query but did not return an answer." } }] });
}
