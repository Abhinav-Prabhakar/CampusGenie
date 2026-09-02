-- ──────────────────────────────────────────────────────────
-- Campus Genie Lakehouse · Unity Catalog Schema & Delta Tables
-- Multi-user schema: identity + per-user storage keyed by Clerk user_id
-- ──────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS workspace.campus_explorer;
USE CATALOG workspace;
USE SCHEMA campus_explorer;

-- 0. Application Users (Clerk identity mirror; role is app-level)
CREATE TABLE IF NOT EXISTS app_users (
  user_id STRING NOT NULL,          -- Clerk user id (user_...)
  email STRING,
  first_name STRING,
  last_name STRING,
  role STRING,                      -- 'student' | 'admin'
  college STRING,                   -- campus the student belongs to (drives navigation tools)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

-- Lazy migration for tables provisioned before the college column existed.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS college STRING;

-- 0b. Per-user chat threads (server-side chat history)
CREATE TABLE IF NOT EXISTS chat_threads (
  thread_id STRING NOT NULL,
  user_id STRING NOT NULL,          -- Clerk user id
  title STRING,
  messages_json STRING,             -- serialized ChatMessage[]
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

-- 1. Campus Events Table (shared; created_by tracks the admin author)
CREATE TABLE IF NOT EXISTS campus_events (
  event_id STRING,
  title STRING,
  category STRING,
  host_organization STRING,
  host_code STRING,
  location STRING,
  is_virtual BOOLEAN,
  event_date DATE,
  start_time STRING,
  duration STRING,
  capacity INT,
  registered_count INT,
  food_provided BOOLEAN,
  is_featured BOOLEAN,
  status STRING,
  visibility STRING,
  tags ARRAY<STRING>,
  description STRING,
  created_at TIMESTAMP,
  created_by STRING                 -- Clerk user id of the author (NULL = seed)
)
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

-- 2. Campus Surveys (shared; created_by tracks the admin author)
CREATE TABLE IF NOT EXISTS campus_surveys (
  survey_id STRING,
  title STRING,
  description STRING,
  target_event_id STRING,
  is_published BOOLEAN,
  is_featured BOOLEAN,
  audience STRING,
  response_count INT,
  questions_json STRING,
  created_at TIMESTAMP,
  created_by STRING                 -- Clerk user id of the author (NULL = seed)
)
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

-- 3. Per-user course enrollments
CREATE TABLE IF NOT EXISTS student_courses (
  course_id STRING,
  course_code STRING,
  title STRING,
  instructor STRING,
  location STRING,
  schedule_days ARRAY<STRING>,
  start_time STRING,
  duration_mins INT,
  min_attendance_pct INT,
  user_id STRING                    -- Clerk user id owning this enrollment
)
USING DELTA;

-- 4. Per-user attendance logs
CREATE TABLE IF NOT EXISTS student_attendance_logs (
  log_id STRING,
  student_id STRING,                -- Clerk user id
  course_id STRING,
  session_date DATE,
  status STRING,                    -- 'PRESENT' | 'LATE' | 'ABSENT' | 'SCHEDULED'
  check_in_time TIMESTAMP,
  verification_method STRING,
  notes STRING,
  created_at TIMESTAMP
)
USING DELTA;

-- 5. Knowledge Sources (governed RAG documents)
CREATE TABLE IF NOT EXISTS knowledge_sources (
  source_id STRING,
  name STRING,
  type STRING,
  category STRING,
  description STRING,
  chunk_count INT,
  file_size STRING,
  status STRING,
  content_sample STRING,
  uploaded_by STRING,
  updated_at TIMESTAMP
)
USING DELTA;

-- 6. Research Labs & Student Clubs
CREATE TABLE IF NOT EXISTS clubs_and_labs (
  entity_id STRING,
  name STRING,
  type STRING, -- 'research_lab', 'tech_club', 'cultural_society', 'sports_club'
  faculty_lead STRING,
  student_lead STRING,
  primary_focus STRING,
  recruitment_open BOOLEAN,
  weekly_commitment_hrs INT,
  required_skills ARRAY<STRING>,
  meeting_schedule STRING,
  location STRING,
  contact_email STRING,
  open_projects ARRAY<STRING>
)
USING DELTA;

-- 7. City & Bengaluru Tech Meetups
CREATE TABLE IF NOT EXISTS city_tech_events (
  meetup_id STRING,
  title STRING,
  organizer STRING,
  neighborhood STRING, -- 'Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield'
  venue_address STRING,
  event_date DATE,
  start_time STRING,
  entry_fee_inr INT,
  attendee_count INT,
  domain STRING, -- 'Generative AI', 'Rust / Systems', 'Founders & VC', 'Cloud Native'
  commute_mins_from_campus INT
)
USING DELTA;

-- 8. Alumni Career Pathways & Research Outcomes
CREATE TABLE IF NOT EXISTS alumni_career_pathways (
  alumni_id STRING,
  graduation_year INT,
  major STRING,
  campus_clubs_joined ARRAY<STRING>,
  research_labs_joined ARRAY<STRING>,
  first_job_title STRING,
  first_company STRING,
  current_role STRING,
  current_organization STRING,
  primary_domain STRING,
  advice_summary STRING
)
USING DELTA;

-- 9. Campus Cafe & Procurement Operations
CREATE TABLE IF NOT EXISTS procurement_inventory (
  item_id STRING,
  item_name STRING,
  category STRING, -- 'Dairy', 'Waffle Cones', 'Packaging', 'Dry Goods'
  current_stock INT,
  min_reorder_threshold INT,
  preferred_supplier STRING,
  unit_price_inr DECIMAL(10, 2),
  lead_time_days INT,
  last_restock_date DATE
)
USING DELTA;

-- 10. Campus Building Locations (shared; powers the campus directions tool)
CREATE TABLE IF NOT EXISTS campus_locations (
  location_id STRING,
  college STRING,                   -- owning campus name; matches app_users.college
  name STRING,                      -- human name students say, e.g. 'Library'
  category STRING,                  -- 'library' | 'dining' | 'academics' | 'landmark' | ...
  lat DOUBLE,
  lng DOUBLE,
  description STRING
)
USING DELTA;
