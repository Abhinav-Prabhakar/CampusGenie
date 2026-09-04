# Campus Genie — WhatsApp Event Tracker & Ingestion Daemon

An interactive Node.js WhatsApp Web application that connects to your WhatsApp account, lets you browse and select campus WhatsApp groups to track, analyzes incoming and unread messages with **Gemini 3.6 Flash (VoidAI)**, and automatically ingests newly discovered campus events into the **Databricks Lakehouse** (`workspace.campus_explorer.campus_events`).

---

## Features

- 📱 **Interactive QR Authentication**: Scans once via terminal QR (`qrcode-terminal`); session credentials persist locally in `.wwebjs_auth/` via `LocalAuth`.
- 📋 **Interactive Group Browser**: Browse all your WhatsApp groups with member & unread counts, and toggle which groups to track using an interactive checklist.
- 🕒 **Cursor-Based Unread Tracking**: Remembers the timestamp of the last processed message per group in `data/tracker-state.json` so re-runs only inspect new messages.
- 🤖 **Gemini 3.6 Flash Event Extraction**: Uses VoidAI / Gemini with structured JSON extraction to accurately identify event titles, categories, dates, times, venues, food perks, and descriptions while rejecting casual banter. Extracted dates are normalized to `YYYY-MM-DD` and categories validated before ingestion.
- 🏛️ **Databricks Lakehouse Ingestion**: Automatically executes SQL inserts into Delta table `workspace.campus_explorer.campus_events`, checks for duplicates, and credits the source.
- 🔴 **Live Watch Mode**: Real-time event listener that streams and ingests events as soon as they are posted in any tracked group. Entering watch mode first catches up on everything posted since the last run, so offline periods are never missed.
- 📊 **Status View**: Inspect tracked groups and recently ingested events without connecting to WhatsApp.

---

## Quick Start

### 1. Installation

From the project root:
```bash
cd backend/whatsapp-tracker
npm install
```

### 2. Environment Configuration

The tracker automatically reads credentials from `.env` (this folder) or the parent project's `.env.local`:
- `LLM_BASE_URL` (VoidAI / Gemini proxy endpoint)
- `LLM_API_KEY` (VoidAI / Gemini API key)
- `LLM_MODEL` (e.g. `gemini-3.6-flash`)
- `DATABRICKS_HOST`
- `DATABRICKS_TOKEN` (optional — falls back to the active Databricks CLI login)
- `DATABRICKS_WAREHOUSE_ID`

Optional WhatsApp Web browser tuning (see `.env.example`):
- `WA_PROXY_SERVER` — route the WhatsApp browser through an explicit proxy. By default the browser **bypasses the OS proxy**, because local proxies (Charles, Proxyman, Zscaler, …) reject WhatsApp's WebSocket handshake and block QR generation.
- `WA_USER_AGENT` — override the browser user agent presented to WhatsApp Web.
- `PUPPETEER_EXECUTABLE_PATH` — path to a Chrome/Chromium binary, used as a fallback when the Puppeteer-managed browser cache is corrupt.

### 3. Run the Interactive CLI

```bash
npm start
```

### 4. CLI Direct Flags

- `npm start`: Full interactive menu (connects via QR).
- `npm run groups` (`node index.js --groups`): Jump directly to group selection.
- `npm run scan` (`node index.js --scan`): Run a one-time sync of all unread messages across tracked groups.
- `npm run watch` (`node index.js --watch`): Start real-time watch mode (catches up on backlog first).
- `npm run status` (`node index.js --status`): Show tracked groups & recently ingested events — no WhatsApp connection needed.
- `node index.js --help`: Show all flags.
- `npm test`: Run the test suite validating configuration, state management, event normalization, Gemini extraction, and Lakehouse connectivity.

### 5. Verification Scripts

- `npm run verify:whatsapp`: Boots the WhatsApp Web client and exits successfully as soon as a QR code is produced (proves Puppeteer, the proxy/UA configuration, and WhatsApp connectivity all work). Scan the QR during this check if you also want to validate an authenticated session.
- `npm run verify:lakehouse`: Inserts a clearly-marked test event through the real ingestion path, reads it back, and deletes it — leaving the Delta table untouched.

---

## Troubleshooting

- **No QR code appears / client hangs on connect**: The most common cause is a system proxy (e.g. a local debugging proxy on `127.0.0.1:8080`) intercepting Chromium and rejecting WhatsApp's WebSocket upgrade. The tracker bypasses the OS proxy by default; if you *need* a proxy, set `WA_PROXY_SERVER`. `npm run verify:whatsapp` confirms this path.
- **`Failed to launch the browser process` / `dlopen ... Chrome for Testing Framework`**: The Puppeteer browser cache is corrupt. Reinstall it (`npx puppeteer browsers install chrome` from this folder — delete `~/.cache/puppeteer/chrome/<version>` first if the zip itself is intact but extraction is incomplete), or point `PUPPETEER_EXECUTABLE_PATH` at any installed Chrome.
- **Stale sessions / repeated auth failures**: Delete the `.wwebjs_auth/` folder and scan a fresh QR code.
- **Events stopped appearing in the Lakehouse**: Run `npm test` (checks LLM + Lakehouse connectivity) and `npm run verify:lakehouse` (checks the insert path).

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
