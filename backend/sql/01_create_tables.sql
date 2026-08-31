-- ──────────────────────────────────────────────────────────
-- Campus Genie Lakehouse · Unity Catalog Schema & Delta Tables
-- ──────────────────────────────────────────────────────────

CREATE CATALOG IF NOT EXISTS campus_explorer;
USE CATALOG campus_explorer;

CREATE SCHEMA IF NOT EXISTS lakehouse_prod;
USE SCHEMA lakehouse_prod;

-- 1. Campus Events Table
CREATE OR REPLACE TABLE campus_events (
  event_id STRING,
  title STRING,
  category STRING,
  host_organization STRING,
  location STRING,
  is_virtual BOOLEAN,
  event_date DATE,
  start_time STRING,
  duration STRING,
  capacity INT,
  registered_count INT,
  food_provided BOOLEAN,
  tags ARRAY<STRING>,
  description STRING,
  created_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

-- 2. Research Labs & Student Clubs
CREATE OR REPLACE TABLE clubs_and_labs (
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

-- 3. City & Bengaluru Tech Meetups
CREATE OR REPLACE TABLE city_tech_events (
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

-- 4. Alumni Career Pathways & Research Outcomes
CREATE OR REPLACE TABLE alumni_career_pathways (
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

-- 5. Campus Cafe & Procurement Operations
CREATE OR REPLACE TABLE procurement_inventory (
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
