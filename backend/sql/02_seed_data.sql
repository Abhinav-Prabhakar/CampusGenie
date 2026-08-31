-- ──────────────────────────────────────────────────────────
-- Campus Genie Lakehouse · Seed Data
-- ──────────────────────────────────────────────────────────

USE CATALOG campus_explorer;
USE SCHEMA lakehouse_prod;

-- 1. Insert Campus Events
INSERT INTO campus_events VALUES
  ('EV-01', 'Hack the Lake — 48h Genie Build Sprint', 'hackathon', 'CruX Coding Club', 'Colt Arena Gate C', false, '2026-04-25', '08:30 AM', '48h', 250, 217, true, ARRAY('AI', 'Databricks', 'Hackathon'), 'Flagship 48-hour lakehouse & agent build sprint with industry mentors.', current_timestamp()),
  ('EV-02', 'ACM Weekly — Systems & Pizza', 'meeting', 'ACM Chapter', 'Ocean Eng 214', false, '2026-04-09', '06:30 PM', '90m', 60, 41, true, ARRAY('Systems', 'Distributed Systems', 'Linux'), 'Deep dive into fast concurrent distributed systems architectures.', current_timestamp()),
  ('EV-03', 'Figma 101 — Campus Design Systems', 'workshop', 'Design Club', 'Virtual · Teams', true, '2026-04-09', '04:00 PM', '1h', 100, 78, false, ARRAY('Design', 'UI/UX', 'Figma'), 'Hands-on session building accessible design systems for campus web applications.', current_timestamp()),
  ('EV-04', 'Databricks Coffee Chats & Career AMA', 'career', 'Career Center', 'Alumni Lounge', false, '2026-04-10', '01:00 PM', '2h', 12, 11, true, ARRAY('Career', 'Internship', 'Networking'), '1-on-1 coffee chat slots with Databricks engineering leaders and recruiters.', current_timestamp()),
  ('EV-05', 'Transfer Student Firepit Mixer', 'social', 'Peer Mentors', 'Quad Firepit', false, '2026-04-09', '07:30 PM', '2h', 50, 47, true, ARRAY('Social', 'Community', 'Mixer'), 'Campfire snacks, s’mores, and campus survival tips for new and transfer students.', current_timestamp());

-- 2. Insert Research Labs & Clubs
INSERT INTO clubs_and_labs VALUES
  ('LAB-01', 'Autonomous Intelligent Systems Lab', 'research_lab', 'Dr. Sarah Jenkins', 'Aarav Patel', 'LLM Agents, Multi-Agent Systems & Robotics', true, 8, ARRAY('Python', 'PyTorch', 'ROS2', 'Databricks'), 'Tuesdays & Thursdays 5:00 PM', 'Kemper Hall 312', 'ais-lab@campus.edu', ARRAY('Campus Genie Multi-Agent Swarm', 'Drone Navigation with VLM')),
  ('LAB-02', 'High Performance Data Systems Group', 'research_lab', 'Prof. Marcus Vance', 'Elena Rostova', 'Delta Lake Internals & Distributed Storage', true, 10, ARRAY('C++', 'Rust', 'Distributed Systems', 'SQL'), 'Mondays 4:00 PM', 'Engineering IV 202', 'data-systems@campus.edu', ARRAY('Zero-Copy Parquet Deserializer', 'Governed Data Sharing')),
  ('CLUB-01', 'CruX Coding & AI Club', 'tech_club', 'Prof. David K.', 'Ava Kimura', 'Competitive Programming, Open Source & Fests', true, 5, ARRAY('Python', 'TypeScript', 'Algorithms'), 'Wednesdays 6:00 PM', 'Colt Innovation Wing', 'crux@campus.edu', ARRAY('Hack the Lake Organizer', 'Campus Mentorship Portal'));

-- 3. Insert Bengaluru Tech Events
INSERT INTO city_tech_events VALUES
  ('BLR-01', 'Bengaluru Generative AI Builders Meetup', 'GenAI BLR Collective', 'Indiranagar', '100ft Road Innovation Hub', '2026-04-11', '06:00 PM', 0, 180, 'Generative AI', 18),
  ('BLR-02', 'Rust & High-Throughput Systems BLR', 'Rustaceans South India', 'Koramangala', 'Koramangala 4th Block Co-work', '2026-04-12', '10:30 AM', 0, 95, 'Rust / Systems', 24),
  ('BLR-03', 'HSR Founders & AI Angel Mixer', 'Peak BLR', 'HSR Layout', 'Sector 3 Rooftop', '2026-04-12', '05:00 PM', 250, 120, 'Founders & VC', 28);

-- 4. Insert Alumni Career Pathways
INSERT INTO alumni_career_pathways VALUES
  ('ALUM-01', 2023, 'Computer Science & Engineering', ARRAY('CruX Coding Club', 'ACM Chapter'), ARRAY('Autonomous Intelligent Systems Lab'), 'Associate AI Engineer', 'Databricks', 'Senior ML Systems Engineer', 'Databricks', 'Lakehouse AI & Model Serving', 'Joining an active research lab in 3rd year was the single biggest turning point for landing Lakehouse roles.'),
  ('ALUM-02', 2022, 'Information Science', ARRAY('Design Club'), ARRAY('High Performance Data Systems Group'), 'Software Development Engineer I', 'Microsoft', 'Senior SDE', 'Stripe', 'Distributed Cloud Infrastructure', 'Prioritize solid systems fundamentals and contributing to open-source fests over resume stuffing.');

-- 5. Insert Procurement Inventory
INSERT INTO procurement_inventory VALUES
  ('ITEM-01', 'A2 Organic Full-Cream Milk (20L Cans)', 'Dairy', 4, 8, 'Amul Dairy & Organic Farms', 14250.00, 2, '2026-04-01'),
  ('ITEM-02', 'Handmade Crispy Waffle Cones (Box of 500)', 'Waffle Cones', 2, 5, 'Cone King Supplies', 4800.00, 7, '2026-03-28'),
  ('ITEM-03', 'Belgian Dark Chocolate Chips (10kg)', 'Dry Goods', 6, 4, 'Royal Confectioneries', 6200.00, 3, '2026-04-03');
