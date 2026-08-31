# 🧞 Campus Genie

> **AI-Powered Campus & City Intelligence for Students — Powered by Databricks & Genie Agents**

**Campus Genie** rewires how students explore campus life, research opportunities, and nearby city ecosystems. Built natively on **Databricks Lakehouse** with a **Databricks Genie Agent** at its core, Campus Genie stops student FOMO and decision paralysis by turning natural-language conversations into governed Lakehouse SQL queries, multi-step analytical reasoning, and personalized recommendations.

---

## 💡 Why Campus Genie?

College life moves fast, and navigating opportunities shouldn't feel like searching across five disconnected portals or guessing what to do each semester.

### The Student Pain Points We Solve
* **⚡ Decision Overload:** Hundreds of clubs, hackathons, and meetups; students are overwhelmed and don't know what is worth their time.
* **🔍 Invisible Opportunities:** Scholarships, lab openings, niche hackathons, and city tech events fail to reach the right students at the right time.
* **🏙️ Disconnected Campus & City:** Campus life often lives in a bubble. Campus Genie bridges campus micro-communities with vibrant city ecosystems (e.g., Bengaluru's tech and culture scene).
* **🧭 Navigating Without a Compass:** Students guess their way through academic years instead of learning from real patterns and trajectories of past alumni cohorts.
* **📋 Fragmented Information:** Event data is scattered across WhatsApp groups, posters, discord channels, and random spreadsheets. We unify it into one governed Lakehouse brain.

---

## 🧠 Why Databricks + Genie Handle the Hard Parts

Rather than building complex bespoke search and analytics pipelines from scratch, **Campus Genie makes Databricks do all the heavy lifting**, keeping our application backend thin, fast, and robust:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Campus Genie Web App                            │
│           (Chat UI • Recommendation Cards • What-If Sliders)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           App Backend                                  │
│             (User Context Enrichment & Genie Conversation API)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Databricks Genie Agent                            │
│    (Campus Reasoning Engine • Text-to-SQL • Multi-Step Planning)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Databricks Lakehouse & Unity Catalog                 │
│   (student_profiles • campus_events • clubs_labs • city_events • ...) │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Lakehouse as Campus Brain:**
   * All campus events, clubs, research labs, alumni outcomes, and city meetups are ingested into Delta tables in a **Unity Catalog** schema (e.g., `campus_explorer`).
   * Unity Catalog delivers centralized data governance, metadata management, and high-performance querying over structured and semi-structured datasets.

2. **Genie Agent as the Reasoning Engine:**
   * Configured directly over Unity Catalog tables with semantic descriptions, column definitions, and instructions tuned to campus language (e.g., *"introvert-friendly events"*, *"commitment level"*, *"AI-focused labs"*).
   * **Chat Mode:** Instantly converts natural-language queries (e.g., *"What's happening tonight that fits my interests and free schedule?"*) into optimized SQL, executes them against Delta tables, and returns answers with contextual visualizations.
   * **Agent Mode:** Plans and runs multi-step analyses for "why" and "what-if" explorations (e.g., *"What happens to my career trajectory if I attend ≥3 AI labs/events per week this semester?"*).

3. **Seamless Databricks App Integration:**
   * Authenticated through the **Databricks Apps Resource Model** with managed permissions to submit queries and stream responses.
   * Uses the **Genie Conversation API** to stream structured results, hypotheses, tables, and charts into the client interface.

> **The "Genie at the Core" Gut Check:** If Databricks or Genie is removed, schema understanding, text-to-SQL generation, governed data access, and analytical reasoning disappear entirely. The Lakehouse and Genie Agent are the fundamental brain of Campus Genie.

---

## 🏗️ End-to-End System Workflow

1. **Data Layer (Databricks Unity Catalog):**
   * `student_profiles`: Anonymized preferences, branch, year, interest tags, and commitment bandwidth.
   * `campus_events`: Workshops, guest lectures, hackathons, cultural fests, dates, and locations.
   * `clubs_labs`: Student organizations, research labs, focus areas, recruitment cycles, and activity ratings.
   * `city_events`: Tech meetups, open mic sessions, hackathons, and conferences across the city.
   * `alumni_paths`: Anonymized cohort trajectories, past involvement patterns, and career/higher-ed outcomes.

2. **Genie Agent Configuration:**
   * Specialized system instructions and curated few-shot SQL templates covering student intent, time constraints, and multi-table joins.

3. **Intelligence Flows:**
   * **Fast Tactical Chat:** Answering real-time schedule and weekend exploration questions.
   * **Deep Strategic Agent Reasoning:** Simulating academic/extracurricular pathways and alumni pattern matching.

4. **Thin Backend Server:**
   * Enriches student prompts with active profile metadata (year, branch, schedule availability).
   * Communicates with Databricks Genie APIs and parses responses into clean JSON streams for the UI.

5. **Student-First Front-End (Next.js & TypeScript):**
   * **Chat Pane:** Conversational portal to ask Campus Genie anything.
   * **Curated Recommendation Cards:** Filtered by relevance, vibe, and schedule fit.
   * **Timeline & Map View:** Spatiotemporal overview of campus and city opportunities.
   * **What-If Exploration Sliders:** Interactive controls powered by Agent Mode analyses.

---

## 🎯 Hero Questions Genie Answers

* **"Don't let me waste my week"** — Finds high-yield events, study jams, and meetups matching your exact free slots and skill goals.
* **"Find my tribe"** — Uncovers clubs, labs, and micro-communities matching your specific interests, energy level, and vibe.
* **"What if I go all-in?"** — Backed by alumni pathway patterns, models what skills, projects, and activities will maximize your target career or research goals.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.18.0 or newer)
* [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
* Access to a [Databricks Workspace](https://databricks.com/) with Unity Catalog and Genie enabled

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Abhinav-Prabhakar/CampusGenie.git
   cd CampusGenie
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   DATABRICKS_HOST=https://<your-databricks-instance>.cloud.databricks.com
   DATABRICKS_TOKEN=dapi...
   DATABRICKS_GENIE_SPACE_ID=<your-genie-space-id>
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Project Structure

```text
├── src/
│   ├── app/              # Next.js App Router (pages, layouts, API routes)
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Landing & Main App interface
│   │   └── globals.css   # Global Tailwind styles
│   └── ...
├── public/               # Static assets & icons
├── package.json          # Project dependencies & scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # Project documentation
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
