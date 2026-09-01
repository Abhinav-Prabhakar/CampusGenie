# Campus Genie

The focused experience at `/navigator` is a **Campus Opportunity Navigator** for the HackCulture Databricks Campus Hackathon, BMSCE Edition. Its target user is a third-year CSE student who wants one verified campus or Bengaluru opportunity that fits their interests, time, budget, eligibility, and travel limit.

The production answer path is intentionally singular:

```text
Student question → Next.js server route → Databricks Genie Agent
                 → governed Delta tables → answer + rows + SQL evidence
```

There is no OpenAI-compatible router and no silent fallback. If Databricks is unavailable, the UI says so and returns no recommendation.

## Local setup

Requirements: Node.js 20+, npm, a Databricks Free Edition workspace, a SQL warehouse, and a configured Genie Agent.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure these server-side values in `.env.local` and in Vercel:

```env
DATABRICKS_HOST=https://<workspace-host>
DATABRICKS_TOKEN=<server-side-token>
DATABRICKS_WAREHOUSE_ID=<sql-warehouse-id>
DATABRICKS_GENIE_SPACE_ID=<genie-agent-or-space-id>
DATABRICKS_GENIE_AGENT_NAME=Campus Opportunity Navigator
DATABRICKS_CATALOG=workspace
DATABRICKS_SCHEMA=campus_navigator
```

Do not prefix credentials with `NEXT_PUBLIC_`. Check configuration through `GET /api/health/databricks`; its response is sanitized and never returns secrets.

## Databricks and Genie configuration

Provision the four-table synthetic snapshot through the Databricks SQL Statement Execution REST API:

```bash
python3 backend/navigator/init_lakehouse.py
```

This setup intentionally replaces the four demo tables. Review the SQL before running it against a schema containing non-demo data.

Create one Genie Agent named **Campus Opportunity Navigator**, attach the same SQL warehouse, and add these Unity Catalog tables:

| Table | Purpose | Key relationship |
| --- | --- | --- |
| `campus_events` | Time-bound campus and Bengaluru opportunities | `event_id` |
| `clubs_labs` | Active clubs and research labs | `entity_id` |
| `recruitment_windows` | Open and closed application periods | `entity_id → clubs_labs` |
| `alumni_outcomes` | Anonymized contextual outcomes | `entity_id → clubs_labs` |

Table and column comments define units, allowed values, timestamps, and synonyms such as “AI club,” “research lab,” “free evening,” “near campus,” and “open recruitment.” Grant the server identity access to the Agent and `SELECT` access to these tables. The app uses the current [Genie Conversation API](https://docs.databricks.com/api/genie/v1/genie-start-conversation) and [SQL Statement Execution API](https://docs.databricks.com/api/statement-execution/v1).

## Data disclosure and limitations

All bundled records are original synthetic hackathon data anchored to September 2026 and marked with `is_synthetic = true`. They are not real BMSCE announcements. The UI displays this label per result. Freshness, row counts, source tables, and generated SQL are shown only when returned by Databricks; missing evidence is labeled rather than invented.

The app does not perform RSVP writes. Its sole approval action downloads an `.ics` file after confirmation and does not modify the user’s calendar automatically.

## Verification

```bash
npm run lint
npm test
npm run build
```

The built-in Node test suite covers the REST adapter, sanitized failures, read-only enforcement, constraint matching, no-result behavior, scope rejection, and evidence table allowlisting.

## Three-minute judge demo

1. Show the **Live Databricks** status and ask the prefilled Friday AI question.
2. Open the evidence panel: Agent name, tables, SQL, returned rows, and freshness.
3. Compare the recommendation cards and their constraint-level match explanations.
4. Use the one-click refinement for free, open-recruitment options.
5. Choose one result, review the confirmation, and export its calendar file.
6. Briefly show the Databricks-unavailable state to prove that no answer is fabricated.
