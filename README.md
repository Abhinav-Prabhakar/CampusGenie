11# Campus Genie

> A Databricks-powered campus intelligence platform for discovering events, joining communities, exploring research opportunities, managing campus data, and making better use of student life.

Campus Genie brings fragmented campus information into one conversational, governed interface. Students can ask natural-language questions, explore event cards, refine recommendations through interactive surveys, inspect trusted knowledge sources, and compare clubs, labs, alumni pathways, city meetups, and campus operations data. Administrators can manage events and surveys through the same application.

The project is a single Next.js App Router application backed by Databricks Lakehouse, Unity Catalog, SQL Warehouses, and a Databricks Genie space. The main experience is served at `/` as one integrated application.

## Table of contents

- [Why Campus Genie](#why-campus-genie)
- [What the application includes](#what-the-application-includes)
- [System architecture](#system-architecture)
- [How a chat request works](#how-a-chat-request-works)
- [Lakehouse data model](#lakehouse-data-model)
- [Security and prompt-injection defenses](#security-and-prompt-injection-defenses)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Local setup](#local-setup)
- [Databricks setup](#databricks-setup)
- [Environment variables](#environment-variables)
- [API routes](#api-routes)
- [Testing and verification](#testing-and-verification)
- [Demo walkthrough](#demo-walkthrough)
- [Deployment notes](#deployment-notes)
- [Known boundaries](#known-boundaries)

## Why Campus Genie

Campus opportunities are usually scattered across posters, chat groups, forms, spreadsheets, club pages, and word of mouth. That fragmentation creates several problems:

- Students miss useful events because discovery depends on being in the right group at the right time.
- Clubs and research labs struggle to reach students whose interests and availability are a good match.
- Event details, capacity, food availability, venue, registration status, and surveys live in different systems.
- Students cannot easily compare campus opportunities with nearby Bengaluru technology communities.
- Historical alumni and participation data is difficult to query without analytical or SQL knowledge.
- Administrators repeatedly rebuild the same event, survey, and source-management workflows.

Campus Genie turns those disconnected records into a governed campus data layer and places a conversational interface on top. Databricks Genie handles natural-language exploration, while explicit application tools render structured UI and execute controlled Lakehouse queries.

## What the application includes

### Conversational Campus Genie

- Streaming chat with selectable LLM providers and a Databricks Genie route.
- Governed tools for events, Lakehouse SQL, knowledge sources, interactive surveys, approvals, and recommendation cards.
- Personalized event and club discovery based on interests, time, food preference, category, commitment, or location.
- Interactive event cards rendered directly inside chat when verified event IDs are returned.
- Multi-step MCQ collection when a recommendation needs structured student preferences.
- Persistent local chat threads, titles, recent conversations, stop generation, and model settings.

### Event discovery

- Campus event grid with category and time filters.
- Event detail modal, availability information, venue, host, duration, and food indicators.
- Event-pass and RSVP-oriented interface flows.
- Featured surveys connected to relevant events.

### Attendance

- Daily attendance view and subject-level summaries.
- Term heatmap and weekday patterns.
- Progress indicators designed for quick academic status checks.

### Student administration

- Create and manage campus events.
- Build surveys with text, radio, checkbox, scale, and rating questions.
- Publish featured surveys and associate them with events.
- View response counts and event status from a dedicated admin workspace.

### Knowledge sources

- Browse Lakehouse-backed campus documents and datasets.
- Upload source metadata and content for indexing.
- Search source descriptions and content samples.
- Preview and delete managed sources through explicit API actions.

### Component gallery

- Internal showcase for Lakehouse tables, analytics cards, execution flows, SQL blocks, filters, search, approval cards, tool chips, and reusable UI atoms.
- Useful for testing visual primitives independently from the main student journeys.

## System architecture

The browser never connects directly to Databricks or receives server credentials. Next.js Route Handlers own provider selection, prompt security, tool orchestration, and Lakehouse access. Databricks remains the governed data and intelligence layer.

![Campus Genie system architecture](<Campus Genie System Architecture.png>)

## How a chat request works

1. The client sends user/assistant chat history, selected model, and optional custom-provider settings to `POST /api/chat`.
2. The server accepts only valid `user` and `assistant` messages, enforces message limits, normalizes content, and rejects role spoofing.
3. A deterministic guard detects common instruction-override, hidden-prompt, credential-exfiltration, fake-role, encoded, and obfuscated jailbreak patterns.
4. Read-only requests selected for Databricks Genie are classified and sent to the configured Genie space.
5. Other supported requests use the configured LLM provider with the permanent Campus Genie system and security instructions.
6. The model can request only declared tools. UI tools are filtered through an allowlist before reaching the browser.
7. Model-generated Lakehouse SQL must be a single `SELECT`/`WITH` query and may reference only governed Campus Genie tables.
8. Tool output is labeled as untrusted data before it is returned to the model for final summarization.
9. The server streams final content and concise tool-status events to the browser. Provider chain-of-thought is not exposed.
10. The client converts verified tool calls into surveys, event grids, approval cards, recommendations, and standard Markdown responses.

![Secure Campus Genie chat request sequence](<Secure Campus Genie Chat Request.png>)

## Lakehouse data model

The runtime routes and the canonical initialization script use the Unity Catalog schema `workspace.campus_explorer`.

| Table | Purpose | Example questions |
| --- | --- | --- |
| `campus_events` | Events, capacity, registration counts, venues, categories, food, visibility, and featured status | “Which AI events have food this week?” |
| `campus_surveys` | Published and featured student surveys with structured question JSON | “Show the featured pre-hackathon survey.” |
| `knowledge_sources` | Indexed documents, policies, syllabi, datasets, content samples, and upload metadata | “What does the club funding policy say?” |
| `clubs_and_labs` | Clubs, research labs, focus areas, recruitment state, skills, schedules, and open projects | “Which AI labs are recruiting?” |
| `city_tech_events` | Bengaluru meetups with neighborhood, fee, domain, attendance, and commute information | “What free GenAI meetups are near campus?” |
| `alumni_career_pathways` | Anonymized academic, club, lab, and career-pathway examples | “Compare ML research and systems career paths.” |
| `procurement_inventory` | Campus cafe inventory, reorder thresholds, suppliers, price, and lead time | “Which cafe items need restocking?” |

The bundled records are demonstration data. Do not represent them as current university announcements or real student outcomes without replacing the seed data with verified sources.

> **Diagram placeholder:** Generate the data diagram using the prompt below, export it as `docs/images/lakehouse-data-model.png`, then replace this entire prompt block with `![Campus Genie Lakehouse data model](docs/images/lakehouse-data-model.png)`.

```text
DIAGRAM GENERATION PROMPT — LAKEHOUSE DATA MODEL

Create a clear data-domain diagram titled “Campus Genie Lakehouse — workspace.campus_explorer.” Use seven table cards arranged around a central Unity Catalog governance hub.

Table cards:
- campus_events: event_id, title, category, host_organization, location, event_date, capacity, registered_count, food_provided, status
- campus_surveys: survey_id, title, target_event_id, is_published, is_featured, response_count, questions_json
- knowledge_sources: source_id, name, type, category, chunk_count, status, uploaded_by, updated_at
- clubs_and_labs: entity_id, name, type, primary_focus, recruitment_open, weekly_commitment_hrs, required_skills, open_projects
- city_tech_events: meetup_id, title, organizer, neighborhood, event_date, entry_fee_inr, domain, commute_mins_from_campus
- alumni_career_pathways: alumni_id, graduation_year, major, campus_clubs_joined, research_labs_joined, current_role, primary_domain
- procurement_inventory: item_id, item_name, category, current_stock, min_reorder_threshold, preferred_supplier, unit_price_inr, lead_time_days

Show the explicit logical relationship campus_surveys.target_event_id → campus_events.event_id. Show clubs/labs and alumni pathways as analytically related through participation arrays rather than claiming a strict foreign key. Place a SQL Warehouse below the governance hub and a Databricks Genie Agent above it. Use Delta-table icons, but keep the design technical, uncluttered, and suitable for a README.
```

## Security and prompt-injection defenses

The chat route uses defense in depth rather than depending on one system-prompt sentence.

### Instruction hierarchy

- The system policy explicitly treats user messages, chat history, retrieved documents, SQL rows, tool results, code blocks, URLs, and metadata as untrusted data.
- Requests to ignore rules, reveal hidden prompts, expose credentials, simulate privileged roles, or use encoded/translated variants do not change instruction priority.
- Mixed legitimate-plus-malicious requests do not gain access to protected information.

### Request boundary

- Client history may contain only `user` and `assistant` roles.
- Message count, per-message size, and total-history size are bounded.
- Fake `system`, `developer`, and `tool` messages are rejected before provider access.
- Known direct and obfuscated jailbreak patterns receive a local safe refusal without contacting an LLM or Databricks.

### Tool boundary

- Only declared server and UI tools are accepted.
- Chat-generated SQL is limited to one read-only `SELECT` or `WITH` statement.
- SQL table references are restricted to the seven governed Campus Genie tables.
- Write, DDL, permission, maintenance, procedure, and multi-statement SQL is rejected.
- Event-search input escapes SQL `LIKE` metacharacters and is length-limited.
- Tool results are marked `UNTRUSTED_TOOL_DATA` and size-limited before model reuse.

### Secret and output boundary

- Credentials stay in server-side environment variables.
- A caller-controlled custom endpoint never receives a server-owned API key.
- Raw upstream error bodies are not forwarded to the browser.
- Provider chain-of-thought and hidden reasoning are discarded; the UI receives final content and concise tool-status messages.

These controls reduce risk but do not replace platform security. Production deployments should also use least-privilege Unity Catalog grants, scoped service identities, endpoint authentication, rate limiting, audit logs, secret rotation, and network controls.

## Technology stack

| Layer | Technology |
| --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, custom design tokens, responsive component CSS |
| Icons and motion | Lucide React, Iconoir, Motion |
| Conversational intelligence | Databricks Genie Conversation API plus configurable LLM providers |
| Data platform | Databricks Lakehouse, Unity Catalog, Delta tables, SQL Warehouse |
| Local Databricks authentication | Environment token or Databricks CLI OAuth token fallback |
| Tests | Node.js built-in test runner with TypeScript stripping |
| Deployment assets | Databricks Asset Bundle configuration in `databricks.yml` |

## Repository structure

```text
CampusGenie/
├── backend/
│   ├── init_lakehouse.py          # Canonical workspace.campus_explorer provisioning and seed script
│   └── sql/                       # Reference DDL and seed SQL templates
├── public/                        # Static browser assets
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts      # Secure streaming LLM/Genie orchestration
│   │   │   ├── events/route.ts    # Event reads and explicit admin writes
│   │   │   ├── lakehouse/route.ts # Lakehouse query endpoint
│   │   │   ├── models/route.ts    # Available model configuration
│   │   │   ├── sources/route.ts   # Source read/upload/delete operations
│   │   │   └── surveys/route.ts   # Survey reads, creation, and response updates
│   │   ├── admin/page.tsx         # Student administration workspace
│   │   ├── attendance/page.tsx    # Attendance analytics
│   │   ├── events/page.tsx        # Event discovery
│   │   ├── gallery/page.tsx       # Internal UI gallery
│   │   ├── sources/page.tsx       # Knowledge-source management
│   │   └── page.tsx               # Main Campus Genie chat
│   ├── components/                # Domain components, primitives, atoms, and dialogs
│   └── lib/
│       ├── chatSecurity.ts         # Prompt, role, SQL, and tool-data security boundary
│       ├── chatStore.ts            # Local chat-thread persistence
│       ├── genie.ts                # Databricks Genie conversation adapter
│       ├── lakehouse.ts            # Databricks SQL/CLI adapter
│       ├── llm.ts                  # Provider models, tools, and retry helper
│       └── theme.ts                # Theme state
├── tests/                          # Deterministic Node tests
├── .env.example                    # Safe configuration template
├── databricks.yml                  # Databricks Asset Bundle
├── package.json
└── README.md
```

## Local setup

### Prerequisites

- Node.js 20 or newer
- npm
- A Databricks workspace with Unity Catalog
- A running SQL Warehouse
- A configured Databricks Genie space for the governed tables
- At least one configured LLM credential if you want non-Genie model routes

### Install and run

```bash
git clone https://github.com/Abhinav-Prabhakar/CampusGenie.git
cd CampusGenie
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Never commit `.env.local`, workspace tokens, provider API keys, or student data.

## Databricks setup

### 1. Authenticate

For local development, either set `DATABRICKS_TOKEN` in `.env.local` or authenticate with the Databricks CLI. The server adapter checks common CLI locations when a token is not supplied.

### 2. Configure a SQL Warehouse

Set `DATABRICKS_WAREHOUSE_ID` to a warehouse the chosen identity may use.

### 3. Provision the canonical schema

The canonical initializer matches the current runtime queries and creates `workspace.campus_explorer`:

```bash
python3 backend/init_lakehouse.py
```

Review the script before running it. It uses `CREATE OR REPLACE TABLE` for demonstration data and can overwrite tables with the same names.

### 4. Configure Databricks Genie

Create or select a Genie space with access to the seven governed tables. Add table and column descriptions that explain campus terminology, categories, time fields, recruitment state, fee units, capacity, and commute duration. Set its identifier as `DATABRICKS_GENIE_SPACE_ID`.

The server enriches Genie requests with a security reminder, but the Genie space should also contain its own narrow, read-only instructions and use a least-privilege identity.

### 5. Optional Databricks Asset Bundle

`databricks.yml` defines a job for running the initialization script. Review its workspace host and target paths before deploying:

```bash
databricks bundle validate
databricks bundle deploy -t dev
databricks bundle run seed_campus_lakehouse -t dev
```

## Environment variables

Copy `.env.example` to `.env.local` and fill only the providers you use.

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLM_API_KEY` | Optional | Primary OpenAI-compatible provider key |
| `LLM_BASE_URL` | Optional | OpenAI-compatible chat-completions base URL |
| `LLM_MODEL` | Recommended | Default configured model name |
| `OPENAI_API_KEY` | Optional | OpenAI fallback credential |
| `GEMINI_API_KEY` | Optional | Gemini fallback credential |
| `ANTHROPIC_API_KEY` | Optional | Anthropic fallback credential |
| `DATABRICKS_HOST` | Required for Lakehouse/Genie | Databricks workspace HTTPS origin |
| `DATABRICKS_TOKEN` | Recommended | Server-side Databricks token; local CLI auth may be used when absent |
| `DATABRICKS_WAREHOUSE_ID` | Required for SQL | SQL Warehouse identifier |
| `DATABRICKS_GENIE_SPACE_ID` | Required for Genie | Genie space identifier |
| `DATABRICKS_CLI_PATH` | Optional | Explicit local path to the Databricks CLI |

Do not use `NEXT_PUBLIC_` for credentials. Variables with that prefix can be included in browser bundles.

## API routes

| Method | Route | Responsibility |
| --- | --- | --- |
| `POST` | `/api/chat` | Validate and stream Campus Genie conversations; route to Genie/LLM; execute governed tools |
| `GET` | `/api/models` | Return configured model choices and default model metadata |
| `GET` | `/api/events` | Read and normalize Lakehouse events |
| `POST` | `/api/events` | Create an event through the explicit admin flow |
| `GET` | `/api/surveys` | Read published or featured surveys |
| `POST` | `/api/surveys` | Create a survey or record an explicit survey response |
| `GET` | `/api/sources` | Read or search knowledge sources |
| `POST` | `/api/sources` | Add a knowledge source |
| `DELETE` | `/api/sources` | Delete a selected knowledge source |
| `POST` | `/api/lakehouse` | Execute a validated, read-only query against governed Campus Genie tables |

Route Handlers are public HTTP surfaces. Add authentication and authorization before exposing administrative mutations outside a trusted demo environment.

## Testing and verification

Run the standard checks before submitting a change:

```bash
npm run lint
npm test
npm run build
```

The security suite includes deterministic cases for:

- Direct and zero-width-character-obfuscated instruction overrides
- Hidden system/developer prompt requests
- Fake role messages and client role spoofing
- Credential and environment-variable exfiltration attempts
- Encoded or translated hidden-instruction requests
- Read-only SQL enforcement
- Multi-statement and cross-schema SQL rejection
- Legitimate campus questions and educational prompt-injection questions
- Untrusted and oversized tool-result handling

For UI changes, also verify:

1. A normal campus question
2. An event query that renders cards
3. A recommendation that triggers the MCQ survey
4. An empty Lakehouse result
5. The Databricks/provider unavailable state
6. Events, attendance, sources, and admin pages at mobile and desktop widths

## Demo walkthrough

A concise product demonstration can follow this sequence:

1. Start on the main chat and ask: “What campus AI events have food this week?”
2. Show the streaming Lakehouse tool status and verified event cards.
3. Ask: “Recommend a club or lab for me,” then complete the generated preference survey.
4. Open the Events page and inspect an event detail/pass flow.
5. Open Sources and show Lakehouse-backed documents and search.
6. Open Attendance to show the term heatmap and subject-level progress.
7. Open Student Admin and show event/survey creation.
8. Demonstrate a blocked jailbreak request and explain that it is rejected locally before provider or tool execution.
9. Close with the Unity Catalog schema and Genie space to show governed data lineage.

## Deployment notes

Create a production build with:

```bash
npm run build
npm run start
```

Before deployment:

- Configure all secrets in the hosting platform, never in source control.
- Use a least-privilege Databricks service identity.
- Grant only required `SELECT` permissions to chat-accessible tables.
- Place authentication and authorization in front of admin and mutation routes.
- Add rate limiting and request-body limits at the edge or reverse proxy.
- Restrict custom model endpoints to trusted destinations.
- Enable Databricks audit logs and application monitoring.
- Replace demonstration data with verified, privacy-reviewed sources.

## Known boundaries

- Prompt-injection detection is defense in depth, not a mathematical guarantee. Least privilege and tool validation remain mandatory.
- The seed records are demonstration data and can become stale.
- The current chat history is stored locally in the browser rather than in a shared account store.
- Admin and mutation routes need deployment-specific authentication and authorization.
- The raw files under `backend/sql/` are reference templates; use `backend/init_lakehouse.py` for the schema expected by the current runtime unless you intentionally align the SQL templates first.
- Alumni examples are contextual patterns, not causal career predictions.
- Provider availability, model tool-calling behavior, Genie configuration, and warehouse startup time affect response quality and latency.
