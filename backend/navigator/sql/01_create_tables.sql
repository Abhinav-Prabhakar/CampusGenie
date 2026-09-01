CREATE SCHEMA IF NOT EXISTS workspace.campus_navigator
COMMENT 'Synthetic hackathon dataset for verified BMSCE and Bengaluru student opportunities.';

-- COMMAND ----------

CREATE OR REPLACE TABLE workspace.campus_navigator.campus_events (
  event_id STRING NOT NULL COMMENT 'Stable opportunity key, for example EV-001',
  title STRING NOT NULL COMMENT 'Student-facing opportunity title',
  opportunity_type STRING NOT NULL COMMENT 'Allowed: campus_event, city_meetup, workshop, hackathon',
  host_name STRING NOT NULL COMMENT 'Verified organizing club, lab, or community',
  domain STRING NOT NULL COMMENT 'Primary interest area, such as AI, data, systems, or design',
  starts_at TIMESTAMP NOT NULL COMMENT 'Start timestamp in Asia/Kolkata',
  ends_at TIMESTAMP COMMENT 'End timestamp in Asia/Kolkata',
  location_name STRING NOT NULL COMMENT 'Campus room or Bengaluru venue',
  commute_minutes INT COMMENT 'Estimated one-way travel time from BMSCE in minutes',
  fee_inr INT NOT NULL COMMENT 'Registration cost in Indian rupees; 0 means free',
  eligibility STRING NOT NULL COMMENT 'Plain-language student eligibility',
  recruitment_status STRING NOT NULL COMMENT 'Allowed: open, closed, rolling, not_applicable',
  status STRING NOT NULL COMMENT 'Allowed: published, cancelled, draft',
  description STRING NOT NULL COMMENT 'Verified summary of the opportunity',
  source_url STRING COMMENT 'Registration or organizer source URL',
  is_synthetic BOOLEAN NOT NULL COMMENT 'True when created for the hackathon demo',
  updated_at TIMESTAMP NOT NULL COMMENT 'When this record was last checked'
)
USING DELTA
COMMENT 'Time-bound BMSCE and Bengaluru opportunities. Free evening means starts_at at or after 16:00; near campus means commute_minutes at or below the requested limit.';

-- COMMAND ----------

CREATE OR REPLACE TABLE workspace.campus_navigator.clubs_labs (
  entity_id STRING NOT NULL COMMENT 'Stable club or lab key',
  name STRING NOT NULL COMMENT 'Official club or research lab name',
  entity_type STRING NOT NULL COMMENT 'Allowed: ai_club, research_lab, technical_club',
  primary_focus STRING NOT NULL COMMENT 'Research and project themes; AI club and research lab synonyms are expected',
  recruitment_status STRING NOT NULL COMMENT 'Allowed: open, closed, rolling',
  weekly_commitment_hours DECIMAL(4,1) NOT NULL COMMENT 'Expected hours per week',
  meeting_schedule STRING NOT NULL COMMENT 'Human-readable recurring schedule in Asia/Kolkata',
  eligibility STRING NOT NULL COMMENT 'Who can apply and required background',
  location_name STRING NOT NULL COMMENT 'Usual meeting location',
  commute_minutes INT NOT NULL COMMENT 'Estimated one-way travel time from BMSCE in minutes',
  fee_inr INT NOT NULL COMMENT 'Membership or application cost in Indian rupees',
  source_url STRING COMMENT 'Official application or contact URL',
  is_synthetic BOOLEAN NOT NULL COMMENT 'True when created for the hackathon demo',
  updated_at TIMESTAMP NOT NULL COMMENT 'When this record was last checked'
)
USING DELTA
COMMENT 'Active BMSCE clubs and research labs with recruitment status, eligibility, cost, and weekly availability requirements.';

-- COMMAND ----------

CREATE OR REPLACE TABLE workspace.campus_navigator.recruitment_windows (
  window_id STRING NOT NULL COMMENT 'Stable recruitment window key',
  entity_id STRING NOT NULL COMMENT 'Logical foreign key to clubs_labs.entity_id',
  opens_at TIMESTAMP NOT NULL COMMENT 'Application opening timestamp in Asia/Kolkata',
  closes_at TIMESTAMP NOT NULL COMMENT 'Application closing timestamp in Asia/Kolkata',
  status STRING NOT NULL COMMENT 'Allowed: open, upcoming, closed',
  eligibility STRING NOT NULL COMMENT 'Window-specific applicant eligibility',
  application_url STRING COMMENT 'Application form or official information URL',
  is_synthetic BOOLEAN NOT NULL COMMENT 'True when created for the hackathon demo',
  updated_at TIMESTAMP NOT NULL COMMENT 'When this record was last checked'
)
USING DELTA
COMMENT 'Application windows linked to clubs and labs. Open recruitment means status=open and current_timestamp between opens_at and closes_at.';

-- COMMAND ----------

CREATE OR REPLACE TABLE workspace.campus_navigator.alumni_outcomes (
  outcome_id STRING NOT NULL COMMENT 'Stable anonymized outcome key',
  entity_id STRING NOT NULL COMMENT 'Logical foreign key to clubs_labs.entity_id',
  graduation_year INT NOT NULL COMMENT 'BMSCE graduation year',
  role_category STRING NOT NULL COMMENT 'Broad, anonymized outcome category',
  outcome_summary STRING NOT NULL COMMENT 'Aggregated outcome without personal identifiers',
  evidence_note STRING NOT NULL COMMENT 'Limitations and interpretation guidance',
  is_synthetic BOOLEAN NOT NULL COMMENT 'True when created for the hackathon demo',
  updated_at TIMESTAMP NOT NULL COMMENT 'When this record was last checked'
)
USING DELTA
COMMENT 'Synthetic, anonymized alumni outcome examples linked to club or lab participation; contextual evidence only, never a causal claim.';
