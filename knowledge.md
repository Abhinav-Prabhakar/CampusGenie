# Campus Genie — Interview, Viva, and Demo Preparation

> Based on the repository as it exists on **2 September 2026**. This is a focused preparation guide: learn the **Priority 1** sections first, then use the rest to handle deeper follow-up questions.

## 0. If you have very little time

Learn these in order:

1. The 45-second pitch and the problem being solved.
2. The architecture and one complete chat request flow.
3. Why Databricks Lakehouse, Unity Catalog, Delta tables, SQL Warehouse, and Genie are each used.
4. Authentication versus authorization, and how Clerk users map to Lakehouse users.
5. SSE streaming and the LLM tool-calling loop.
6. The main tables and which data is per-user versus shared.
7. Three honest limitations and how you would improve them.
8. The 5-minute demo sequence.

Do not memorize implementation line by line. Be able to explain **why each layer exists, how data moves, what can fail, and what trade-off you made**.

---

## 1. The answer to “Tell me about your project”

### 15-second version

Campus Genie is an authenticated campus intelligence platform built with Next.js and Databricks. It unifies campus events, attendance, documents, clubs, alumni information, navigation, and administration in one application, with a conversational assistant that answers using governed Lakehouse data and renders interactive UI such as event cards and maps.

### 45-second version

Campus information is normally fragmented across posters, spreadsheets, WhatsApp groups, portals, and documents. Campus Genie creates one governed data layer in Databricks and exposes it through a Next.js web application and a Capacitor Android client. A student can ask a natural-language question; the server either routes it to a Databricks Genie space for read-only analytics or to a configured LLM with controlled tools. Tools query Unity Catalog tables through a SQL Warehouse and stream structured results back as text, event cards, MCQs, or a campus directions map. Clerk handles identity, while application roles and user-specific data are stored in Delta tables. Admins can manage events, surveys, sources, and complaints.

### One-line value proposition

**Campus Genie turns scattered campus data into a governed, personalized, and actionable student experience.**

### The problem and users

- **Students:** miss opportunities, cannot search policies easily, and use separate systems for attendance, events, teammates, alumni, and navigation.
- **Administrators:** repeatedly manage disconnected forms, spreadsheets, surveys, events, and grievances.
- **Institutions:** need access control, traceable data, and a source of truth rather than an ungoverned chatbot.

### What is technically distinctive

- The assistant is not only a text chatbot; model tool calls create typed UI events.
- Live facts come from governed Lakehouse queries instead of being trusted from model memory.
- Read-only analytical questions can use Databricks Genie, while application workflows use explicit server tools.
- Identity is managed by Clerk but mirrored into the Lakehouse for application roles and per-user analytics.
- The same data platform supports the web app, mobile client, admin tools, and analytics.

---

## 2. Architecture you must be able to draw

```text
Web browser (Next.js/React)          Android app (React/Vite/Capacitor)
             |                                      |
             | HTTPS + JSON/SSE                     | JSON
             v                                      v
     Next.js Route Handlers                 /api/mobile bridge
     - Clerk authentication                 or Databricks App
     - authorization/RBAC                   (Express + service principal OAuth)
     - provider routing                              |
     - LLM tool loop                                 |
     - validation/rate limiting                      |
             |                                       |
             +-------------------+-------------------+
                                 |
                +----------------+----------------+
                |                                 |
                v                                 v
        Databricks Genie API             Databricks SQL Statement API
        natural language → SQL           SQL Warehouse executes queries
                |                                 |
                +----------------+----------------+
                                 v
                Unity Catalog: workspace.campus_explorer
                Delta tables for users, events, attendance,
                documents, clubs, alumni, locations, etc.
```

### Responsibility of each layer

| Layer | Responsibility |
|---|---|
| React client | User interaction, local UI state, reading SSE, rendering structured cards/maps |
| Next.js Route Handlers | Trust boundary: auth, validation, orchestration, secrets, SQL/API access |
| Clerk | Sign-in/sign-up, session identity, protected routes |
| App user layer | Mirrors Clerk identity and stores app role, college, and phone in Databricks |
| LLM provider | Conversation, deciding which declared tool to request, final explanation |
| Databricks Genie | Natural-language exploration of configured governed data |
| SQL Warehouse | Compute that executes SQL Statement API requests |
| Unity Catalog | Catalog/schema organization, governance, permissions, discoverability |
| Delta tables | Durable ACID data with schema and history-friendly storage |

Key boundary: **the browser does not receive a Databricks token and does not query Databricks directly.** Credentials remain on the server.

---

## 3. Complete chat request flow

Be able to explain this without looking at the code.

1. The client creates a user message, updates the React UI, and persists the chat thread through `/api/threads`.
2. It sends message history, selected model/provider, routing mode, and optional custom-provider configuration to `POST /api/chat`.
3. Clerk middleware has already protected the route. The chat handler also applies an in-memory RPM/RPD limit based on forwarded client IP.
4. In explicit Genie mode, the request goes directly to Databricks Genie. In automatic mode, a small classifier decides whether the request is a read-only question Genie can answer. Action requests remain in the application tool flow.
5. For the standard provider flow, the server loads a current knowledge-source summary and campus location names, then constructs the Campus Genie system prompt.
6. The server calls an OpenAI-compatible streaming endpoint with four declared tools:
   - `query_campus_data`
   - `show_event_cards`
   - `show_campus_directions`
   - `ask_user_questions`
7. The model may emit a streamed tool call. The server reconstructs its chunked name and JSON arguments.
8. The server executes the tool itself. The model never receives a database credential.
9. A query result is appended as a `tool` message, then the model gets another turn to summarize it. The loop is capped at five iterations to prevent unbounded tool use.
10. The server sends Server-Sent Events (SSE): content deltas, tool status, event IDs, survey questions, or a directions payload.
11. The client incrementally decodes SSE, updates the assistant message, and renders Markdown plus typed components.
12. An `AbortController` supports “stop generation,” and the completed thread is saved to the user’s Lakehouse-backed history.

### Why SSE?

SSE is simple for one-way server-to-browser streaming over normal HTTP. It improves perceived latency and can carry both text deltas and structured JSON events. WebSockets would be more useful for persistent bidirectional real-time communication, which this request/response chat does not require.

### What “tool calling” means

The model does **not** execute a function. It returns a structured request such as a tool name plus JSON arguments. The trusted server validates and executes that request, returns the result to the model, and may also emit a UI event. This separation is important for security and reliability.

### Genie path

`streamGenieConversation` starts a conversation, polls its message until completion, reads answer/query attachments, fetches query results, matches any returned event IDs against live Lakehouse events, and emits the final answer and event-card event. Genie is best for governed read-only analytical questions.

---

## 4. Main product features

| Area | What is implemented | Important technical idea |
|---|---|---|
| Conversational home | Streaming multi-provider chat, automatic/Genie routing, tools, stoppable generation | SSE, tool loop, provider abstraction |
| Events | Browse/filter events, details, passes, admin CRUD, WhatsApp link | Shared Delta data; admin writes |
| Attendance | Per-user courses/logs, status updates, risk calculations, recovery plan | User isolation; deterministic math with optional LLM enhancement |
| Campus directions | Resolve campus place synonyms and show a MapLibre route card | Haversine distance, bearing, deterministic path generation |
| Knowledge sources | Upload PDF/image/JSON/text/CSV, extract text, search, preview, delete | PDF parsing, Tesseract OCR, Lakehouse metadata/content sample |
| Authentication/profile | Clerk sessions, Lakehouse identity mirror, college/phone profile | Authentication versus app authorization |
| Admin | Manage events/surveys and inspect complaints | Server layout guard plus API authorization checks |
| Complaints | Validated grievance submission, real anonymity, admin listing | Anonymous rows store SQL `NULL` user ID |
| Alumni | Explore career pathways, export CSV, request introduction | Governed aggregate/example data and per-user requests |
| Teammates | Like/pass profiles and detect deterministic mutual matches | Per-user swipe state with `MERGE` upsert |
| Awards | Podium/event award display | Lakehouse read model |
| Campus Wrapped | Personalized story-like summary | Seeded deterministic personalization, not an LLM |
| Mobile | Native-feeling Capacitor Android app with haptics | Shared APIs and separately deployable Databricks App |
| Component gallery | Isolated atoms and AI-native UI primitives | Reusable design system |

---

## 5. Technology choices and how to defend them

### Next.js 16 App Router + React 19 + TypeScript

- App Router colocates pages, layouts, and route handlers.
- Server code keeps credentials and Lakehouse access away from the browser.
- Client components handle interactive state and stream rendering.
- TypeScript documents API/UI contracts and catches interface mistakes.
- `dynamic = "force-dynamic"` and `Cache-Control: no-store` are used where responses must reflect current user or Lakehouse state.

If asked “Why not a separate backend?”: for this project, Route Handlers reduce deployment and type-sharing complexity. At larger scale, the chat orchestration and data APIs could become separate services for independent scaling and fault isolation.

### Databricks Lakehouse

The Lakehouse approach combines warehouse-style SQL analytics and governance with data-lake flexibility. It fits Campus Genie because structured operational/analytics data, AI exploration, and governed access can share one platform.

### Delta Lake / Delta tables

Know these terms:

- **ACID transactions:** reliable concurrent reads/writes.
- **Schema enforcement/evolution:** predictable records while allowing managed change.
- **MERGE:** atomic upsert used for profiles, threads, attendance, events, and swipes.
- **Change Data Feed:** enabled on several tables for future incremental processing/auditing; the current UI does not yet consume it.
- **Time travel:** a Delta capability useful for auditing/recovery, although this app does not expose it directly.

### Unity Catalog

Unity Catalog organizes data as `catalog.schema.table`; this project uses `workspace.campus_explorer.<table>`. It is the governance boundary for discoverability and permissions. In production, the app service identity should receive only the table and operation privileges it needs.

### SQL Warehouse and Statement Execution API

The SQL Warehouse supplies compute. The server submits a statement to `/api/2.0/sql/statements`, waits or polls while it is pending/running, then maps column metadata plus row arrays into JavaScript records. Direct REST with a token is preferred; local development can fall back to Databricks CLI OAuth.

### Databricks Genie

Genie is a governed natural-language interface over a configured data space. It can interpret a campus question, generate SQL, execute it against permitted data, and return an explanation. It is not the same thing as the base LLM: Genie is the data-aware analytics agent; the general LLM path also supports application-specific UI tools.

### Clerk

Clerk owns identity and sessions. `src/proxy.ts` protects every non-auth route. On first use, the server mirrors selected Clerk profile fields into `app_users` with the default `student` role. The app database should own application authorization; Clerk session identity alone does not imply admin permission.

### Tailwind CSS 4 and design system

The UI uses semantic design tokens, OKLCH colors, reusable atoms/primitives, consistent radii, hairline borders, dark/light themes, and motion. OKLCH is useful because lightness changes are more perceptually consistent than raw RGB/HSL adjustments.

### MapLibre

MapLibre renders the interactive campus map without locking the app to a proprietary rendering library. The current route is a deterministic generated walking path between stored coordinates, not real pedestrian-network routing. A production upgrade would use a routing engine such as OSRM/Valhalla or a campus graph with accessible paths.

### Capacitor

Capacitor packages a web React application inside native Android while allowing native capabilities such as haptics. It was faster than rebuilding all product logic in a separate native framework, while keeping a clear path to native plugins.

---

## 6. Data model

### Identity and per-user tables

| Table | Purpose | Isolation key |
|---|---|---|
| `app_users` | Clerk identity mirror, role, college, phone | `user_id` |
| `chat_threads` | Serialized conversation history | `user_id` |
| `student_courses` | A student’s enrolled/default courses | `user_id` |
| `student_attendance_logs` | Attendance sessions | `student_id` |
| `teammate_swipes` | Like/pass state | `user_id` |
| `alumni_intro_requests` | Student-to-alumni intro request | `user_id` |
| `complaints` | Grievances; anonymous entries have `NULL` user | nullable `user_id` |

### Shared campus tables

| Table | Purpose |
|---|---|
| `campus_events` | Event metadata, capacity, food, visibility, status, author, WhatsApp link |
| `campus_surveys` | Published surveys and question JSON |
| `knowledge_sources` | Indexed source metadata and extracted content sample |
| `clubs_and_labs` | Recruitment, skills, schedules, and open projects |
| `city_tech_events` | Bengaluru technology meetups |
| `alumni_career_pathways` | Anonymized/example career trajectories |
| `procurement_inventory` | Campus café stock and reorder information |
| `campus_locations` | College-specific coordinates and place metadata |
| `event_awards` | Ranked winners and prizes |
| `teammate_profiles` | Discoverable collaboration profiles |

### Relationships worth drawing

- `app_users.user_id` logically owns threads, courses, swipes, intro requests, and non-anonymous complaints.
- `student_attendance_logs.course_id` relates to `student_courses.course_id` and is additionally scoped by student ID.
- `campus_surveys.target_event_id` relates to `campus_events.event_id`.
- `event_awards.event_id` relates to `campus_events.event_id`.
- `alumni_intro_requests.alumni_id` relates to `alumni_career_pathways.alumni_id`.
- Some are logical relationships rather than enforced foreign keys. Be honest about this.

### Why JSON is stored for messages/questions

`messages_json` and `questions_json` keep variable nested structures simple and preserve the complete object. The trade-off is weaker column-level querying and validation. At scale, frequently analyzed fields should be normalized or stored in typed semi-structured columns with versioned schemas.

---

## 7. Authentication, authorization, security, and privacy

### Authentication versus authorization

- **Authentication:** “Who are you?” Clerk verifies the signed-in user and supplies `userId`.
- **Authorization:** “What may you do?” `app_users.role` and server guards decide whether the user may access admin pages or mutate protected resources.

### Current controls

- Clerk middleware protects non-public routes.
- Admin layout redirects non-admin users.
- Mutating admin APIs call `requireAdminUser`; UI hiding alone is never treated as security.
- User-owned APIs filter by the authenticated Clerk ID.
- Credentials are server environment variables.
- Chat SQL blocks obvious write/DDL keywords and limits returned rows.
- Event IDs from Genie are verified against live public events before interactive cards are emitted.
- Custom upload parsing and complaint inputs have size/type or field validation.
- Anonymous complaints store a genuine `NULL` user ID and the admin view suppresses reporter identity.
- Retry/backoff handles 429 and transient 5xx provider responses.
- Tool loops and prompt quotas are bounded.

### Security points you should not overclaim

The current chat SQL check is a **denylist**, not a full SQL parser or complete allowlist. A production version should parse SQL into an AST, permit only one `SELECT`/`WITH`, enforce allowed tables/columns, apply query cost/time limits, and ideally expose parameterized server functions rather than arbitrary model SQL.

Many route handlers escape apostrophes before constructing SQL strings. That is better than raw concatenation but is not equivalent to parameterized queries. Prefer bound parameters when supported, or a strict query builder/validated stored procedures.

The rate limiter is an in-memory `Map` keyed mainly by IP. It resets when the process restarts and is not shared across replicas. Production should use Redis, a gateway, or a managed distributed rate limiter, preferably keyed by authenticated user plus IP.

### Other production-hardening items

- Use a least-privilege Databricks service principal rather than broad personal credentials.
- Separate read and write identities/permissions.
- Add audit logs, secret rotation, request IDs, metrics, tracing, and alerts.
- Encrypt sensitive data and define retention/deletion policies.
- Do not send unnecessary personal/student data to third-party model providers.
- Add moderation and stronger prompt-injection/data-exfiltration tests.
- Restrict CORS and authenticate mobile API calls end to end.
- Make role changes an explicit audited admin-only workflow.

### Privacy answer

Campus data can include personal and academic records. Minimize collection, isolate every query by authenticated user, anonymize analytical examples, obtain consent for sharing contact details, retain only necessary fields, and ensure external LLM calls receive only the context required for the answer.

---

## 8. Important algorithms and non-obvious logic

### Attendance recovery math

Given attended sessions `A`, completed sessions `C`, total term sessions `T`, and cutoff `p`:

```text
remaining = T - C
target attended by term end = ceil(T × p/100)
minimum remaining to attend = max(0, target - A)
allowed future absences = remaining - minimum remaining to attend
maximum possible percentage = (A + remaining) / T × 100
```

The route always produces a deterministic plan first. If an LLM is configured, it may enhance the wording/action plan; deterministic calculations remain the safe fallback.

### Campus navigation

- Normalize names and synonyms such as “library.”
- Score candidates from the user’s saved college.
- Use the Haversine formula for great-circle distance.
- Use bearings to generate readable directions.
- Create a densified deterministic S-curve for the map payload.
- Estimate walking time at about 80 metres/minute.

Important honesty: this visual route does not know paths, stairs, blocked areas, or accessibility. It demonstrates location grounding, not production-grade navigation.

### Genie event verification

The server extracts possible event IDs/titles from Genie records and answer text, then intersects them with live public events. This prevents invented event IDs from becoming actionable cards.

### Teammate matching

Swipes are upserted with `MERGE`. Mutual-match behavior is deterministic in this demo. A real system would store both users’ explicit preferences, enforce privacy, and notify only after a genuine two-sided match.

### Campus Wrapped

Seeded pseudo-random values derived from a stable user seed create repeatable personalized visuals. This produces a consistent demo without claiming that every statistic comes from a complete behavioral event pipeline.

---

## 9. API surface to know

| Route | Methods | Purpose/access |
|---|---|---|
| `/api/chat` | POST | Stream LLM/Genie answer and typed tool events |
| `/api/chat/usage` | GET | Current process-local quota usage |
| `/api/events` | GET, POST, PUT, DELETE | Read events; admin mutations |
| `/api/attendance` | GET, PUT | Per-user attendance and status update |
| `/api/attendance/recovery` | POST | Deterministic/LLM-enhanced recovery plan |
| `/api/sources` | GET, POST, DELETE | Browse/upload sources; admin delete |
| `/api/surveys` | GET, POST | Read/record response; admin creation path |
| `/api/threads` | GET, POST, DELETE | Per-user Lakehouse chat persistence |
| `/api/users` | GET, PATCH | Current profile; self-update of college/phone only |
| `/api/complaints` | POST, GET | Submit grievance; admin listing |
| `/api/alumni` | GET | Career pathway records |
| `/api/alumni/intro` | POST | Validated per-user introduction request |
| `/api/teammates` | GET, POST, DELETE | Profiles and per-user swipe state |
| `/api/awards` | GET | Awards display data |
| `/api/wrapped` | GET | Deterministic personalized summary |
| `/api/mobile` | GET, POST, OPTIONS | Mobile read/Genie bridge with CORS headers |
| `/api/models` | GET | Available provider/model configuration |
| `/api/lakehouse` | POST | Direct Lakehouse query endpoint; discuss restricting this strongly |

---

## 10. Frontend concepts they may ask

### Server versus client components

Pages/components with `"use client"` need state, effects, browser storage, event handlers, or streaming readers. Server layouts and route handlers can safely access Clerk server APIs and secrets. Keeping this boundary clean reduces browser JavaScript and credential exposure.

### State and persistence

- Chat UI state lives in React.
- A module cache keeps multiple chat-store hooks synchronized.
- Active thread ID remains in `localStorage` for fast browser continuity.
- Thread content is persisted per user in the Lakehouse; legacy local threads are migrated best-effort.
- Custom model definitions are local browser preferences.

### Structured UI from an AI response

The server sends discriminated event types such as `events_grid`, `survey`, `directions`, and `tool_status`. The client validates the expected shape and stores it on the assistant message. React then renders the corresponding component. This is safer and more maintainable than asking the model to generate HTML.

### Accessibility and UX points

Mention semantic buttons, dialog roles, keyboard shortcuts, focus/hover states, loading and error states, dark/light theme, responsive layouts, stop generation, and textual directions in addition to a visual map. Future work should include a formal WCAG audit and automated accessibility tests.

---

## 11. Deployment and environment

### Web/local

```bash
npm ci
cp .env.example .env.local
npm run dev
npm run lint
npm test
npm run build
```

Important environment variables:

- `DATABRICKS_HOST`
- `DATABRICKS_TOKEN` or local Databricks CLI OAuth
- `DATABRICKS_WAREHOUSE_ID`
- `DATABRICKS_GENIE_SPACE_ID`
- `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`
- provider-specific API keys
- Clerk publishable/secret configuration required by Clerk
- optional `LLM_RPM_LIMIT` and `LLM_RPD_LIMIT`

Never commit `.env.local` or tokens.

### Lakehouse provisioning

`backend/init_lakehouse.py` loads the ordered SQL files, splits statements, submits each through the Databricks CLI/API, polls completion, and continues while reporting individual failures. `databricks.yml` defines a Databricks Asset Bundle job for initialization in dev/prod workspace roots.

### Databricks App and mobile

The mobile React/Vite build is packaged with Capacitor. It can call a Next.js `/api/mobile` bridge, while `databricks-app/server.mjs` is a separate Express deployment that serves the compiled mobile assets and queries Databricks using cached OAuth client-credentials tokens. This makes the mobile experience deployable inside Databricks Apps without shipping credentials in the APK.

---

## 12. Testing and current verification status

### What exists

- Node’s built-in test runner with TypeScript stripping.
- Deterministic unit tests for Haversine distance, bearings, route generation, colocated points, determinism, and formatters.
- Unit tests for self-profile validation, including rejection of self-service role changes.
- One basic test-runner smoke test.

### Verification on 2 September 2026

- `npm test`: **10/10 tests passed**.
- `npm run lint`: **completed with 0 errors and 161 warnings**. Warnings mainly concern `any`, unused code, effect-state patterns, hook dependencies, and raw image tags.
- `npm run build`: could not complete in this checkout because declared packages `maplibre-gl` and `qrcode` were absent from the current `node_modules`. Run `npm ci` before treating this as an application build result.

### Honest test-gap answer

The highest-risk chat, SQL, authorization, upload, and Databricks adapter paths need much more coverage. Next priorities:

1. Unit tests for SQL policy/validation and tool argument parsing.
2. Route tests for 401/403, tenant isolation, validation, and error sanitization.
3. Mocked Databricks SQL and Genie polling tests, including timeout/failure states.
4. SSE parser and multi-tool integration tests.
5. Playwright E2E for sign-in, chat, event card, admin guard, and empty/unavailable states.
6. Load tests for concurrent chat and rate limiting.
7. Accessibility and mobile device tests.

---

## 13. Most likely viva questions with concise answers

### Product and architecture

**Q: Why did you build this?**  
A: Campus information is fragmented and difficult to search or personalize. The app creates one governed data layer and one student-facing interface instead of another isolated portal.

**Q: Is this just a chatbot?**  
A: No. Chat is an orchestration interface. The product also has event, attendance, source, admin, alumni, teammate, awards, profile, grievance, map, wrapped, and mobile experiences. Chat tool calls can render typed interactive UI.

**Q: Why not let the browser call Databricks?**  
A: It would expose credentials and bypass centralized authorization, validation, rate limiting, and auditing. The server must own the trust boundary.

**Q: Why both Genie and a normal LLM?**  
A: Genie is strong for governed read-only data exploration. A general LLM with application tools is better for multi-step UI workflows, clarification, navigation, and provider flexibility.

**Q: How does automatic routing work?**  
A: A low-temperature classifier returns whether the prompt is fully answerable by a read-only Genie agent. Explicit action verbs are classified away from Genie. If classification fails, the standard tool path is the safe fallback.

**Q: What happens if Databricks is unavailable?**  
A: APIs return explicit failure/unavailable states instead of silently presenting seed data as live. The UI has retry/error states. Attendance recovery still has a deterministic calculation fallback, but data-dependent facts cannot be claimed live.

### AI and reliability

**Q: How do you reduce hallucination?**  
A: Require Lakehouse queries for factual campus answers, give the model explicit tools, return tool data for final synthesis, verify event IDs against live public records, cap loops, and clearly distinguish demo data. Stronger output citations and evals are future work.

**Q: What is prompt injection?**  
A: Untrusted input tries to override instructions or exfiltrate data/secrets. System prompts help but are not enough; enforce privileges in code, restrict tools and SQL, isolate secrets, validate outputs, and treat retrieved text as data rather than instructions.

**Q: Do users see chain-of-thought?**  
A: The interface receives provider reasoning-like fields and tool-status text in some paths. For production, expose only concise progress summaries, never rely on or reveal private chain-of-thought.

**Q: Why cap tool iterations at five?**  
A: To bound latency, cost, accidental loops, and abuse while allowing query → UI tool → final answer workflows.

**Q: How would you evaluate answer quality?**  
A: Build a golden set of campus questions with expected tables/filters/results; score factual accuracy, tool choice, event-ID validity, refusal behavior, latency, cost, and user task completion. Run it for every model/prompt change.

### Databricks and data

**Q: Lakehouse versus data warehouse?**  
A: A warehouse focuses on structured analytics; a data lake offers flexible low-cost storage but traditionally weaker management. A Lakehouse combines open/flexible data storage with transactional reliability, SQL performance, and governance.

**Q: What does Unity Catalog add?**  
A: Central naming, discovery, permissions, lineage/audit capabilities, and consistent governance across data and AI assets.

**Q: Why a SQL Warehouse?**  
A: It provides managed SQL compute for interactive statements and separates compute from the underlying Delta data.

**Q: Why `MERGE` instead of check-then-insert?**  
A: `MERGE` expresses an atomic upsert, reducing race windows and keeping create/update behavior in one transaction.

**Q: Is the project OLTP or OLAP?**  
A: It mixes small operational writes with analytical reads on a Lakehouse. That is convenient for the prototype; very high-volume transactional workloads may need a dedicated OLTP store with CDC into Databricks.

**Q: How is multi-user isolation implemented?**  
A: Server routes take the authenticated Clerk user ID and include it in reads/writes for user-owned tables. Production should reinforce this with database-level policies/views, not only application filters.

### Web and APIs

**Q: Why App Router?**  
A: Nested layouts, server/client component boundaries, and colocated route handlers fit a single full-stack React application.

**Q: Why `force-dynamic`?**  
A: User-specific or rapidly changing Lakehouse responses must be computed per request rather than accidentally cached as static output.

**Q: Why not WebSockets?**  
A: The chat needs one-direction streaming during a normal POST response, so SSE is simpler. WebSockets would add value for live multi-user notifications or collaboration.

**Q: How do you handle transient provider failures?**  
A: Exponential backoff retries 429 and selected 5xx responses, respects abort signals, and falls back to a summary if tools already returned useful data.

**Q: How are admin pages secured?**  
A: A server layout checks the current Lakehouse-backed app role and redirects; every sensitive API also checks the admin role. API enforcement is the real security boundary.

### Design and trade-offs

**Q: Why OKLCH?**  
A: It gives more perceptually uniform lightness and chroma control, which helps create consistent semantic ramps across dark and light themes.

**Q: What would you change with more time?**  
A: First strengthen authorization/SQL boundaries and automated tests; then add distributed rate limiting, observability, citations, vector retrieval, real routing, normalized analytics events, and production data governance.

**Q: What was the hardest part?**  
A: Coordinating streamed LLM output with multi-turn tools and typed UI while keeping live data verified. The solution was an explicit server-side loop, stable tool IDs, SSE event types, and client-side incremental parsing.

**Q: What did you personally learn?**  
A: Prepare a truthful answer around full-stack trust boundaries, Databricks APIs, stream parsing, multi-user data isolation, and designing graceful fallbacks. Add one specific bug you diagnosed and how you verified the fix.

---

## 14. Tough questions: answer honestly

**“Is this production ready?”**  
Recommended answer: “It is a strong functional prototype with real authentication, Lakehouse persistence, role guards, streaming, and error states. Before production I would require a clean dependency install/build, eliminate lint debt, expand integration/E2E tests, use distributed quotas, harden model-generated SQL, audit every API permission, and add observability and privacy controls.”

**“Is every recommendation genuinely personalized?”**  
No. Some use user context or live records; Wrapped and parts of teammate matching are deterministic demo personalization. Explain exactly which is which.

**“Are all event details real/current?”**  
No. Bundled seed records demonstrate the system. Replace them with verified institutional feeds before claiming current official information.

**“Is source upload full RAG?”**  
Not yet. Files are parsed/OCR’d and content samples are stored/searchable, but there is no complete embedding, vector index, chunk retrieval, citation, and re-ranking pipeline. The next step is to add one with per-source access control.

**“Does the map give real walking routes?”**  
No. It resolves campus coordinates and generates a deterministic illustrative path. Real navigation needs a pedestrian graph/routing service and accessibility constraints.

**“Can this scale horizontally today?”**  
Most server handlers can, but the in-memory limiter cannot coordinate replicas and repeated interactive SQL calls may become expensive. Use distributed state, caching where safe, connection/query management, queues for heavy OCR, and performance telemetry.

---

## 15. A safe 5-minute demo

1. **Sign in and profile (30 sec):** show Clerk identity, college selection, and explain that the profile is mirrored into the Lakehouse.
2. **Live event question (75 sec):** ask for an event by category/date/food. Point out tool status, Lakehouse query, streamed answer, and verified event cards.
3. **Directions (60 sec):** ask “Show me directions from the library to the canteen.” Show college-aware place resolution, textual steps, and map card.
4. **Attendance (45 sec):** show per-course percentage and recovery calculation. Explain deterministic fallback.
5. **Sources/admin (60 sec):** show an indexed document and event/complaint management. Explain admin authorization at both layout and API layers.
6. **Close (30 sec):** summarize Databricks governance, multi-user persistence, and the top production improvement.

Have backup screenshots or a prerecorded path. Live AI and external data services can fail even when the application is correct.

### Demo questions that are likely to work

- “Which upcoming AI events provide food?”
- “Show me directions from the Central Library to the Main Canteen.”
- “What attendance do I need in my highest-risk course to reach the cutoff?”
- “Which clubs or labs are recruiting for LLM-related work?”

### Before the demo

- Run `npm ci`, `npm test`, `npm run lint`, and `npm run build`.
- Confirm Clerk, Warehouse, Genie, and LLM credentials without displaying them.
- Confirm the SQL Warehouse is running and seed data dates match the demo.
- Test one normal answer, one tool answer, one empty result, one permission denial, and one unavailable state.
- Use a non-sensitive demo account and data.

---

## 16. Final study checklist

You are ready when you can answer “yes” to these:

- [ ] I can pitch the project in 15 and 45 seconds.
- [ ] I can draw the architecture from memory.
- [ ] I can trace a chat prompt through SSE, tool calling, Databricks, and back to React.
- [ ] I know the difference between LLM, Genie, SQL Warehouse, Unity Catalog, and Delta Lake.
- [ ] I can explain authentication versus authorization.
- [ ] I know which tables are shared and which are per-user.
- [ ] I can derive the attendance recovery formula.
- [ ] I can explain why the current map is illustrative, not real routing.
- [ ] I can explain three security controls and three remaining risks.
- [ ] I will not claim seed data is live institutional data.
- [ ] I will not claim the source feature is full vector RAG.
- [ ] I know the current test/build status.
- [ ] I have practiced the 5-minute demo and a failure fallback.

## 17. Ten terms to revise if unfamiliar

1. **SSE:** one-way event stream from server to browser over HTTP.
2. **Tool calling:** model requests a declared function; trusted code executes it.
3. **RAG:** retrieving relevant external data before generating an answer.
4. **ACID:** atomicity, consistency, isolation, durability of transactions.
5. **RBAC:** permissions based on roles such as student/admin.
6. **Unity Catalog:** Databricks governance/catalog layer.
7. **Delta Lake:** transactional table format used in the Lakehouse.
8. **SQL Warehouse:** managed compute for SQL queries.
9. **OAuth/service principal:** non-human identity and token flow for deployed services.
10. **Idempotency/upsert:** repeating an operation does not create unintended duplicates; `MERGE` supports update-or-insert behavior.

---

## 18. Code map for last-minute revision

- Main chat UI and SSE parser: `src/app/page.tsx`
- Chat orchestration and tools: `src/app/api/chat/route.ts`
- Genie adapter: `src/lib/genie.ts`
- SQL adapter: `src/lib/lakehouse.ts`
- Clerk/application users: `src/proxy.ts`, `src/lib/appUsers.ts`
- User profile authorization parsing: `src/lib/userProfileUpdate.ts`
- Chat persistence: `src/lib/chatStore.ts`, `src/app/api/threads/route.ts`
- Campus location resolution and route math: `src/lib/campusLocations.ts`, `src/lib/campusDirections.ts`
- Attendance: `src/app/api/attendance/route.ts`, `src/app/api/attendance/recovery/route.ts`
- Source parsing: `src/lib/docParser.ts`, `src/app/api/sources/route.ts`
- Lakehouse schema and seeds: `backend/sql/01_create_tables.sql`, `backend/sql/02_seed_data.sql`
- Provisioning/deployment: `backend/init_lakehouse.py`, `databricks.yml`
- Mobile client/app server: `mobile/`, `databricks-app/server.mjs`
- Design specification: `design.md`
- Tests: `tests/`

The best overall answer pattern in a viva is: **requirement → design choice → request/data flow → trade-off → verification → next improvement**.
