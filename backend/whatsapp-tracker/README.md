# Campus Genie — WhatsApp Event Tracker & Ingestion Daemon

An interactive Node.js WhatsApp Web application that connects to your WhatsApp account, lets you browse and select campus WhatsApp groups to track, analyzes incoming and unread messages with **Gemini 3.6 Flash (VoidAI)**, and automatically ingests newly discovered campus events into the **Databricks Lakehouse** (`workspace.campus_explorer.campus_events`).

---

## Features

- 📱 **Interactive QR Authentication**: Scans once via terminal QR (`qrcode-terminal`); session credentials persist locally in `.wwebjs_auth/` via `LocalAuth`.
- 📋 **Interactive Group Browser**: Browse all your WhatsApp groups with member & unread counts, and toggle which groups to track using an interactive checklist.
- 🕒 **Cursor-Based Unread Tracking**: Remembers the timestamp of the last processed message per group in `data/tracker-state.json` so re-runs only inspect new messages.
- 🤖 **Gemini 3.6 Flash Event Extraction**: Uses VoidAI / Gemini with structured JSON extraction to accurately identify event titles, categories, dates, times, venues, food perks, and descriptions while rejecting casual banter.
- 🏛️ **Databricks Lakehouse Ingestion**: Automatically executes SQL inserts into Delta table `workspace.campus_explorer.campus_events`, checks for duplicates, and credits the source.
- 🔴 **Live Watch Mode**: Real-time event listener that streams and ingests events as soon as they are posted in any tracked group.

---

## Quick Start

### 1. Installation

From the project root:
```bash
cd backend/whatsapp-tracker
npm install
```

### 2. Environment Configuration

The tracker automatically reads credentials from `.env` or the parent project's `.env.local`:
- `LLM_BASE_URL` (VoidAI / Gemini proxy endpoint)
- `LLM_API_KEY` (VoidAI / Gemini API key)
- `LLM_MODEL` (e.g. `gemini-3.6-flash`)
- `DATABRICKS_HOST`
- `DATABRICKS_TOKEN` (or active Databricks CLI login)
- `DATABRICKS_WAREHOUSE_ID`

### 3. Run the Interactive CLI

```bash
npm start
```

### 4. CLI Direct Flags

- `npm run groups` (`node index.js --groups`): Jump directly to group selection.
- `npm run scan` (`node index.js --scan`): Run a one-time sync of all unread messages across tracked groups.
- `npm run watch` (`node index.js --watch`): Start real-time watch mode.
- `npm test`: Run the test suite validating configuration, state management, Gemini extraction, and Lakehouse connectivity.

---

## Data Ingestion Schema

Events are written to `workspace.campus_explorer.campus_events`:
- `event_id`: `EV-WA-<ID>`
- `title`: Extracted title
- `category`: `hackathon` | `workshop` | `social` | `career` | `meeting` | `sports`
- `host_organization`: Sponsoring club or organization
- `host_code`: `WA`
- `location`: Campus room, building, or online platform
- `event_date`: `YYYY-MM-DD`
- `start_time`: e.g. `10:00 AM`
- `duration`: e.g. `2h`
- `capacity`: Estimated attendee capacity
- `food_provided`: Boolean
- `status`: `live`
- `visibility`: `public`
- `created_by`: `whatsapp_tracker`
- `whatsapp_url`: Name of the source group
