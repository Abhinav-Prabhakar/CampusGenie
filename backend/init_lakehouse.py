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
  # 1. Create Schema in workspace catalog
  "CREATE SCHEMA IF NOT EXISTS workspace.campus_explorer COMMENT 'Governed Campus Genie Lakehouse schema for events, surveys, knowledge sources, clubs, alumni pathways, and procurement'",
  
  # 2. Campus Events Table
  """CREATE OR REPLACE TABLE workspace.campus_explorer.campus_events (
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
    created_at TIMESTAMP
  ) USING DELTA""",

  # 3. Seed All 14 Campus Events
  """INSERT INTO workspace.campus_explorer.campus_events VALUES
    ('EV-01', 'ACM Weekly — Systems & Pizza', 'meeting', 'ACM Chapter', 'AC', 'Ocean Eng 214', false, '2026-04-09', '06:30 PM', '90m', 60, 41, true, false, 'live', 'public', ARRAY('Systems', 'Distributed Systems', 'Linux', 'Pizza'), 'Weekly systems talk — this week: kernel bypass networking demo and open hack time on the cluster.', current_timestamp()),
    ('EV-02', 'Figma 101 — Campus Design Systems', 'workshop', 'Design Club', 'DC', 'Virtual · Teams', true, '2026-04-09', '04:00 PM', '1h', 100, 78, false, false, 'draft', 'public', ARRAY('Design', 'UI/UX', 'Figma', 'Virtual'), 'Hands-on session building accessible design systems with OKLCH tokens and live React components.', current_timestamp()),
    ('EV-03', 'Transfer Student Firepit Mixer', 'social', 'Peer Mentors', 'PM', 'Quad Firepit', false, '2026-04-09', '07:30 PM', '2h', 50, 47, true, false, 'live', 'private', ARRAY('Social', 'Community', 'Mixer', 'Food'), 'Campfire snacks, s’mores, and campus survival tips for new and transfer students.', current_timestamp()),
    ('EV-04', 'Databricks Coffee Chats & Career AMA', 'career', 'Career Center', 'CC', 'Alumni Lounge', false, '2026-04-10', '01:00 PM', '2h', 12, 11, true, false, 'live', 'public', ARRAY('Career', 'Internship', 'Networking', 'Databricks'), '1-on-1 coffee chat slots with Databricks engineering leaders and campus recruiters.', current_timestamp()),
    ('EV-05', 'Robotics Lab Open House', 'meeting', 'Robotics Club', 'RB', 'Robotics Lab B2', false, '2026-04-10', '05:00 PM', '90m', 80, 58, false, false, 'live', 'public', ARRAY('Robotics', 'Hardware', 'ROS2', 'AI'), 'Live demos of autonomous quadrupeds, computer vision pipelines, and lab recruitment overview.', current_timestamp()),
    ('EV-06', 'Resume Lab — Drop-in Review', 'career', 'Career Center', 'CC', 'HUB 317', false, '2026-04-11', '12:00 PM', '2h', 40, 24, false, false, 'live', 'public', ARRAY('Career', 'Resume', 'Mentorship'), 'Peer and alumni resume reviews for summer internship applications and tech roles.', current_timestamp()),
    ('EV-07', 'Debate Society — Practice Rounds', 'meeting', 'Debate Society', 'DB', 'HUB 204', false, '2026-04-11', '04:30 PM', '2h', 30, 18, false, false, 'live', 'public', ARRAY('Debate', 'Public Speaking', 'Policy'), 'Parliamentary debate practice rounds covering AI governance, open source data, and energy policy.', current_timestamp()),
    ('EV-08', 'Lightning Blitz Mini-Hack', 'hackathon', 'Startup Garage', 'SG', 'Innovation Lab', false, '2026-04-11', '06:00 PM', '3h', 30, 28, true, false, 'live', 'public', ARRAY('Hackathon', 'Rapid Prototyping', 'Startups', 'Free Food'), 'Fast 3-hour rapid prototyping challenge with instant cash micro-grants for winning teams.', current_timestamp()),
    ('EV-09', 'Moonlight Jam on the Quad', 'social', 'Music Society', 'MS', 'Main Quad Stage', false, '2026-04-11', '09:00 PM', '3h', 300, 300, false, false, 'ended', 'public', ARRAY('Music', 'Festival', 'Social', 'Quad'), 'Acoustic and indie student band performances under the stars on the central campus quad.', current_timestamp()),
    ('EV-10', 'HackDavis 36 — Build for Good', 'hackathon', 'CruX Coding Club', 'CX', 'Kemper 210', false, '2026-04-12', '09:00 AM', '36h', 250, 213, true, true, 'live', 'public', ARRAY('Hackathon', 'AI', 'Social Impact', 'Lakehouse'), 'Flagship 36-hour social impact hackathon with $5,000 prize pool and Databricks engineering mentors.', current_timestamp()),
    ('EV-11', 'Intramural 3v3 Hoops Blitz', 'sports', 'Intramurals', 'IM', 'Rec Courts', false, '2026-04-12', '11:00 AM', '3h', 24, 22, false, false, 'live', 'public', ARRAY('Sports', 'Basketball', 'Fitness'), 'Weekend 3-on-3 double-elimination basketball tournament with championship merch prizes.', current_timestamp()),
    ('EV-12', 'Sunrise Yoga — Library Terrace', 'sports', 'Wellness Collective', 'WE', 'Library Terrace', false, '2026-04-13', '06:30 AM', '1h', 60, 34, false, false, 'live', 'public', ARRAY('Wellness', 'Yoga', 'Mindfulness', 'Outdoors'), 'Gentle guided vinyasa flow with sunrise views over campus. Mats and tea provided.', current_timestamp()),
    ('EV-13', 'Genie Ideathon — 48h Virtual Build', 'hackathon', 'GDG Campus', 'GD', 'Discord & Virtual', true, '2026-04-20', '02:00 PM', '48h', 150, 96, false, false, 'live', 'public', ARRAY('Hackathon', 'Genie Agents', 'Cloud', 'Virtual'), 'Asynchronous global build sprint creating autonomous student tools with Databricks Genie.', current_timestamp()),
    ('EV-14', 'Delta Lake Deep-Dive with Genie', 'workshop', 'Data Club', 'DA', 'Virtual · Teams', true, '2026-04-13', '03:00 PM', '90m', 200, 140, false, false, 'live', 'public', ARRAY('Data', 'Delta Lake', 'SQL', 'Genie'), 'Interactive tutorial on ACID transactions, time travel, and Genie Text-to-SQL architecture.', current_timestamp())""",

  # 4. Campus Surveys Table (For student feedback, votes, pre-event surveys)
  """CREATE OR REPLACE TABLE workspace.campus_explorer.campus_surveys (
    survey_id STRING,
    title STRING,
    description STRING,
    target_event_id STRING,
    is_published BOOLEAN,
    is_featured BOOLEAN,
    audience STRING,
    response_count INT,
    questions_json STRING,
    created_at TIMESTAMP
  ) USING DELTA""",

  # 5. Seed Campus Surveys
  """INSERT INTO workspace.campus_explorer.campus_surveys VALUES
    ('SRV-01', 'Hack the Lake — Pre-Event Hacker Survey', 'Tell us your track, dietary needs, team status, and mentorship preferences. Takes 2 minutes!', 'EV-10', true, true, 'public', 86, '[{"id":"q1","type":"text","title":"What should we call your team?","required":true},{"id":"q2","type":"radio","title":"Which track do you want to build in?","required":true,"options":["Campus Genie AI Agents","Lakehouse Analytics & Governance","Social Impact & Open Theme"]},{"id":"q3","type":"checkbox","title":"Any dietary needs? (Meals & midnight snacks covered)","required":false,"options":["Vegetarian","Vegan","Gluten-Free","Halal"]},{"id":"q4","type":"scale","title":"How prepared do you feel for a 48h build sprint?","required":false,"scaleMin":"Beginner","scaleMax":"Battle-Tested"},{"id":"q5","type":"star","title":"Rate your excitement for Databricks Lakehouse features!","required":false}]', current_timestamp()),
    ('SRV-02', 'ACM Weekly — Kernel Talk Feedback', 'Help us pick next month systems talk topics & vote for pizza flavors!', 'EV-01', true, false, 'public', 28, '[{"id":"q1","type":"radio","title":"Rate this week kernel bypass networking talk","required":true,"options":["Outstanding","Great","Solid","Needs more code"]},{"id":"q2","type":"text","title":"What topic should we explore next?","required":false}]', current_timestamp())""",

  # 6. Knowledge Sources Table (Governed Campus Documents for RAG)
  """CREATE OR REPLACE TABLE workspace.campus_explorer.knowledge_sources (
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
  ) USING DELTA""",

  # 7. Seed Knowledge Sources
  """INSERT INTO workspace.campus_explorer.knowledge_sources VALUES
    ('DOC-01', 'Campus Hackathon Handbook 2026.pdf', 'document', 'Guidelines & Rules', 'Official rules, hardware lending policies, judging rubrics, and sponsor API credits for campus hackathons.', 48, '2.4 MB', 'Indexed', 'Hack the Lake 2026 rules: Teams of 1-4 students. All code must be written during the event. Databricks AI Serving and Genie APIs are provided with $200 free cloud credits per team. Submissions are judged on Technical Depth (30%), Practical Impact (30%), User Experience (20%), and Presentation (20%). Food and quiet sleeping zones available in Colt Arena 2nd floor.', 'Campus Admin', current_timestamp()),
    ('DOC-02', 'CS301 Distributed Systems Syllabus.pdf', 'syllabus', 'Curriculum', 'Course schedule, reading lists on Paxos/Raft, office hours, and project milestones.', 36, '1.1 MB', 'Indexed', 'CS301 covers distributed consensus, ACID guarantees, Delta Lake change data feed, linearizability, and fault tolerance. Midterm date: May 4. Final project requires implementing a high-throughput key-value store with raft consensus in Go/Rust.', 'Prof. Vance', current_timestamp()),
    ('DOC-03', 'Student Clubs & Funding Policy.md', 'policy', 'Governance', 'Student Senate guide on reserving campus halls, ordering pizza budgets, and security permits.', 24, '480 KB', 'Indexed', 'Registered campus clubs receive up to $1,500/semester for events with free student admission. Event requests must be submitted at least 5 business days in advance. Food distribution requires university catering safety compliance form.', 'Dean of Students', current_timestamp()),
    ('DOC-04', 'Lakehouse Delta Lake Architecture Whitepaper.pdf', 'technical', 'Lakehouse Reference', 'Technical guide on ACID transactions, Time Travel, Liquid Clustering, and Unity Catalog lineage.', 64, '4.8 MB', 'Indexed', 'Delta Lake is an open-format storage layer that brings reliability to data lakes. Key capabilities include ACID transactions, scalable metadata handling, and unifying streaming and batch data processing. Unity Catalog delivers unified governance across data and AI assets.', 'Databricks Research', current_timestamp()),
    ('DOC-05', 'Campus Dining & Cafe Hours 2026.json', 'dataset', 'Campus Life', 'Operating hours, dietary menus, allergens, and inventory schedules for campus dining.', 12, '180 KB', 'Live in Lakehouse', 'Central Dining Hall: 7:00 AM - 10:00 PM daily. Campus Cafe (Kemper Hall): 8:00 AM - 8:00 PM. Serving A2 organic milk, handcrafted espresso, and fresh pastries.', 'Dining Services', current_timestamp())""",

  # 8. Research Labs & Student Clubs Table
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

  # 9. Seed Clubs & Labs
  """INSERT INTO workspace.campus_explorer.clubs_and_labs VALUES
    ('LAB-01', 'Autonomous Intelligent Systems Lab', 'research_lab', 'Dr. Sarah Jenkins', 'Aarav Patel', 'LLM Agents, Multi-Agent Systems & Robotics', true, 8, ARRAY('Python', 'PyTorch', 'ROS2', 'Databricks'), 'Tuesdays & Thursdays 5:00 PM', 'Kemper Hall 312', 'ais-lab@campus.edu', ARRAY('Campus Genie Multi-Agent Swarm', 'Drone Navigation with VLM')),
    ('LAB-02', 'High Performance Data Systems Group', 'research_lab', 'Prof. Marcus Vance', 'Elena Rostova', 'Delta Lake Internals & Distributed Storage', true, 10, ARRAY('C++', 'Rust', 'Distributed Systems', 'SQL'), 'Mondays 4:00 PM', 'Engineering IV 202', 'data-systems@campus.edu', ARRAY('Zero-Copy Parquet Deserializer', 'Governed Data Sharing')),
    ('CLUB-01', 'CruX Coding & AI Club', 'tech_club', 'Prof. David K.', 'Ava Kimura', 'Competitive Programming, Open Source & Fests', true, 5, ARRAY('Python', 'TypeScript', 'Algorithms'), 'Wednesdays 6:00 PM', 'Colt Innovation Wing', 'crux@campus.edu', ARRAY('Hack the Lake Organizer', 'Campus Mentorship Portal')),
    ('CLUB-02', 'Design & UX Guild', 'tech_club', 'Prof. Angela Ray', 'Maya Chen', 'Accessible UI/UX & Design Systems', true, 4, ARRAY('Figma', 'Tailwind', 'CSS', 'React'), 'Thursdays 4:00 PM', 'Kemper 110', 'design@campus.edu', ARRAY('Campus Genie UI Redesign', 'Accessible Campus Wayfinding'))""",

  # 10. City Tech Events Table
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

  # 11. Seed City Events
  """INSERT INTO workspace.campus_explorer.city_tech_events VALUES
    ('BLR-01', 'Bengaluru Generative AI Builders Meetup', 'GenAI BLR Collective', 'Indiranagar', '100ft Road Innovation Hub', '2026-04-11', '06:00 PM', 0, 180, 'Generative AI', 18),
    ('BLR-02', 'Rust & High-Throughput Systems BLR', 'Rustaceans South India', 'Koramangala', 'Koramangala 4th Block Co-work', '2026-04-12', '10:30 AM', 0, 95, 'Rust / Systems', 24),
    ('BLR-03', 'HSR Founders & AI Angel Mixer', 'Peak BLR', 'HSR Layout', 'Sector 3 Rooftop', '2026-04-12', '05:00 PM', 250, 120, 'Founders & VC', 28)""",

  # 12. Alumni Career Pathways Table
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

  # 13. Seed Alumni Pathways
  """INSERT INTO workspace.campus_explorer.alumni_career_pathways VALUES
    ('ALUM-01', 2023, 'Computer Science & Engineering', ARRAY('CruX Coding Club', 'ACM Chapter'), ARRAY('Autonomous Intelligent Systems Lab'), 'Associate AI Engineer', 'Databricks', 'Senior ML Systems Engineer', 'Databricks', 'Lakehouse AI & Model Serving', 'Joining an active research lab in 3rd year was the single biggest turning point for landing Lakehouse roles.'),
    ('ALUM-02', 2022, 'Information Science', ARRAY('Design Club'), ARRAY('High Performance Data Systems Group'), 'Software Development Engineer I', 'Microsoft', 'Senior SDE', 'Stripe', 'Distributed Cloud Infrastructure', 'Prioritize solid systems fundamentals and contributing to open-source fests over resume stuffing.')""",

  # 14. Procurement Inventory Table
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

  # 15. Seed Procurement Inventory
  """INSERT INTO workspace.campus_explorer.procurement_inventory VALUES
    ('ITEM-01', 'A2 Organic Full-Cream Milk (20L Cans)', 'Dairy', 4, 8, 'Amul Dairy & Organic Farms', 14250.00, 2, '2026-04-01'),
    ('ITEM-02', 'Handmade Crispy Waffle Cones (Box of 500)', 'Waffle Cones', 2, 5, 'Cone King Supplies', 4800.00, 7, '2026-03-28'),
    ('ITEM-03', 'Belgian Dark Chocolate Chips (10kg)', 'Dry Goods', 6, 4, 'Royal Confectioneries', 6200.00, 3, '2026-04-03')"""
]

def execute_sql(stmt: str):
    print(f"\n[Executing SQL]: {stmt.strip()[:90]}...")
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
