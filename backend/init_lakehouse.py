#!/usr/bin/env python3
"""
Campus Genie — Databricks Lakehouse Initialization & Seed Script
Executes DDL and DML to provision Unity Catalog Delta tables for Campus Genie.
"""

import json
import os
import subprocess
import sys
import time

WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "25132a20d91813ef")

STATEMENTS = [
  # 1. Create Schema in workspace catalog or campus_explorer
  "CREATE SCHEMA IF NOT EXISTS workspace.campus_explorer COMMENT 'Governed Campus Genie Lakehouse schema for events, clubs, alumni pathways, and procurement'",
  
  # 2. Campus Events Table
  """CREATE OR REPLACE TABLE workspace.campus_explorer.campus_events (
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
  ) USING DELTA""",

  # 3. Seed Campus Events
  """INSERT INTO workspace.campus_explorer.campus_events VALUES
    ('EV-01', 'Hack the Lake — 48h Genie Build Sprint', 'hackathon', 'CruX Coding Club', 'Colt Arena Gate C', false, '2026-04-25', '08:30 AM', '48h', 250, 217, true, ARRAY('AI', 'Databricks', 'Hackathon'), 'Flagship 48-hour lakehouse & agent build sprint with industry mentors.', current_timestamp()),
    ('EV-02', 'ACM Weekly — Systems & Pizza', 'meeting', 'ACM Chapter', 'Ocean Eng 214', false, '2026-04-09', '06:30 PM', '90m', 60, 41, true, ARRAY('Systems', 'Distributed Systems', 'Linux'), 'Deep dive into fast concurrent distributed systems architectures.', current_timestamp()),
    ('EV-03', 'Figma 101 — Campus Design Systems', 'workshop', 'Design Club', 'Virtual · Teams', true, '2026-04-09', '04:00 PM', '1h', 100, 78, false, ARRAY('Design', 'UI/UX', 'Figma'), 'Hands-on session building accessible design systems for campus web applications.', current_timestamp()),
    ('EV-04', 'Databricks Coffee Chats & Career AMA', 'career', 'Career Center', 'Alumni Lounge', false, '2026-04-10', '01:00 PM', '2h', 12, 11, true, ARRAY('Career', 'Internship', 'Networking'), '1-on-1 coffee chat slots with Databricks engineering leaders and recruiters.', current_timestamp()),
    ('EV-05', 'Transfer Student Firepit Mixer', 'social', 'Peer Mentors', 'Quad Firepit', false, '2026-04-09', '07:30 PM', '2h', 50, 47, true, ARRAY('Social', 'Community', 'Mixer'), 'Campfire snacks, s’mores, and campus survival tips for new and transfer students.', current_timestamp())""",

  # 4. Research Labs & Student Clubs Table
  """CREATE OR REPLACE TABLE workspace.campus_explorer.clubs_and_labs (
    entity_id STRING,
    name STRING,
    type STRING,
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
  ) USING DELTA""",

  # 5. Seed Clubs & Labs
  """INSERT INTO workspace.campus_explorer.clubs_and_labs VALUES
    ('LAB-01', 'Autonomous Intelligent Systems Lab', 'research_lab', 'Dr. Sarah Jenkins', 'Aarav Patel', 'LLM Agents, Multi-Agent Systems & Robotics', true, 8, ARRAY('Python', 'PyTorch', 'ROS2', 'Databricks'), 'Tuesdays & Thursdays 5:00 PM', 'Kemper Hall 312', 'ais-lab@campus.edu', ARRAY('Campus Genie Multi-Agent Swarm', 'Drone Navigation with VLM')),
    ('LAB-02', 'High Performance Data Systems Group', 'research_lab', 'Prof. Marcus Vance', 'Elena Rostova', 'Delta Lake Internals & Distributed Storage', true, 10, ARRAY('C++', 'Rust', 'Distributed Systems', 'SQL'), 'Mondays 4:00 PM', 'Engineering IV 202', 'data-systems@campus.edu', ARRAY('Zero-Copy Parquet Deserializer', 'Governed Data Sharing')),
    ('CLUB-01', 'CruX Coding & AI Club', 'tech_club', 'Prof. David K.', 'Ava Kimura', 'Competitive Programming, Open Source & Fests', true, 5, ARRAY('Python', 'TypeScript', 'Algorithms'), 'Wednesdays 6:00 PM', 'Colt Innovation Wing', 'crux@campus.edu', ARRAY('Hack the Lake Organizer', 'Campus Mentorship Portal'))""",

  # 6. City Tech Events Table
  """CREATE OR REPLACE TABLE workspace.campus_explorer.city_tech_events (
    meetup_id STRING,
    title STRING,
    organizer STRING,
    neighborhood STRING,
    venue_address STRING,
    event_date DATE,
    start_time STRING,
    entry_fee_inr INT,
    attendee_count INT,
    domain STRING,
    commute_mins_from_campus INT
  ) USING DELTA""",

  # 7. Seed City Events
  """INSERT INTO workspace.campus_explorer.city_tech_events VALUES
    ('BLR-01', 'Bengaluru Generative AI Builders Meetup', 'GenAI BLR Collective', 'Indiranagar', '100ft Road Innovation Hub', '2026-04-11', '06:00 PM', 0, 180, 'Generative AI', 18),
    ('BLR-02', 'Rust & High-Throughput Systems BLR', 'Rustaceans South India', 'Koramangala', 'Koramangala 4th Block Co-work', '2026-04-12', '10:30 AM', 0, 95, 'Rust / Systems', 24),
    ('BLR-03', 'HSR Founders & AI Angel Mixer', 'Peak BLR', 'HSR Layout', 'Sector 3 Rooftop', '2026-04-12', '05:00 PM', 250, 120, 'Founders & VC', 28)""",

  # 8. Alumni Career Pathways Table
  """CREATE OR REPLACE TABLE workspace.campus_explorer.alumni_career_pathways (
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
  ) USING DELTA""",

  # 9. Seed Alumni Pathways
  """INSERT INTO workspace.campus_explorer.alumni_career_pathways VALUES
    ('ALUM-01', 2023, 'Computer Science & Engineering', ARRAY('CruX Coding Club', 'ACM Chapter'), ARRAY('Autonomous Intelligent Systems Lab'), 'Associate AI Engineer', 'Databricks', 'Senior ML Systems Engineer', 'Databricks', 'Lakehouse AI & Model Serving', 'Joining an active research lab in 3rd year was the single biggest turning point for landing Lakehouse roles.'),
    ('ALUM-02', 2022, 'Information Science', ARRAY('Design Club'), ARRAY('High Performance Data Systems Group'), 'Software Development Engineer I', 'Microsoft', 'Senior SDE', 'Stripe', 'Distributed Cloud Infrastructure', 'Prioritize solid systems fundamentals and contributing to open-source fests over resume stuffing.')""",

  # 10. Procurement Inventory Table
  """CREATE OR REPLACE TABLE workspace.campus_explorer.procurement_inventory (
    item_id STRING,
    item_name STRING,
    category STRING,
    current_stock INT,
    min_reorder_threshold INT,
    preferred_supplier STRING,
    unit_price_inr DECIMAL(10, 2),
    lead_time_days INT,
    last_restock_date DATE
  ) USING DELTA""",

  # 11. Seed Procurement Inventory
  """INSERT INTO workspace.campus_explorer.procurement_inventory VALUES
    ('ITEM-01', 'A2 Organic Full-Cream Milk (20L Cans)', 'Dairy', 4, 8, 'Amul Dairy & Organic Farms', 14250.00, 2, '2026-04-01'),
    ('ITEM-02', 'Handmade Crispy Waffle Cones (Box of 500)', 'Waffle Cones', 2, 5, 'Cone King Supplies', 4800.00, 7, '2026-03-28'),
    ('ITEM-03', 'Belgian Dark Chocolate Chips (10kg)', 'Dry Goods', 6, 4, 'Royal Confectioneries', 6200.00, 3, '2026-04-03')"""
]

def execute_sql(stmt: str):
    print(f"\n[Executing SQL]: {stmt[:80]}...")
    payload = {
        "warehouse_id": WAREHOUSE_ID,
        "statement": stmt,
        "wait_timeout": "30s"
    }
    cmd = [
        "databricks", "api", "post", "/api/2.0/sql/statements",
        "--json", json.dumps(payload)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error executing statement: {res.stderr}")
        return False
    data = json.loads(res.stdout)
    stmt_id = data.get("statement_id")
    state = data.get("status", {}).get("state")
    
    while state in ("PENDING", "RUNNING"):
        time.sleep(2)
        check_cmd = ["databricks", "api", "get", f"/api/2.0/sql/statements/{stmt_id}"]
        check_res = subprocess.run(check_cmd, capture_output=True, text=True)
        if check_res.returncode == 0:
            check_data = json.loads(check_res.stdout)
            state = check_data.get("status", {}).get("state")
            if state == "SUCCEEDED":
                print(f"✓ Statement {stmt_id} succeeded.")
                return True
            elif state in ("FAILED", "CANCELED", "CLOSED"):
                print(f"✗ Statement {stmt_id} {state}: {check_data.get('status', {}).get('error')}")
                return False
    
    if state == "SUCCEEDED":
        print(f"✓ Statement {stmt_id} succeeded.")
        return True
    else:
        print(f"✗ Statement {stmt_id} {state}")
        return False

def main():
    print(f"=== Initializing Campus Genie Lakehouse on Warehouse {WAREHOUSE_ID} ===")
    success_count = 0
    for idx, stmt in enumerate(STATEMENTS, 1):
        print(f"\n--- Step {idx}/{len(STATEMENTS)} ---")
        if execute_sql(stmt):
            success_count += 1
        else:
            print(f"Warning: Step {idx} did not succeed.")
    
    print(f"\n==========================================")
    print(f"Completed Lakehouse Init: {success_count}/{len(STATEMENTS)} succeeded.")
    print(f"Unity Catalog Schema: workspace.campus_explorer")
    print(f"==========================================")

if __name__ == "__main__":
    main()
