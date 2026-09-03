-- ──────────────────────────────────────────────────────────
-- Campus Genie Lakehouse · Seed Data (shared catalog content)
-- Per-user tables (student_courses, student_attendance_logs,
-- chat_threads, app_users) are seeded lazily per user at runtime.
-- ──────────────────────────────────────────────────────────

USE CATALOG workspace;
USE SCHEMA campus_explorer;

-- 1. Insert Campus Events (created_by NULL = seeded content)
INSERT INTO campus_events VALUES
  ('EV-01', 'ACM Weekly — Systems & Pizza', 'meeting', 'ACM Chapter', 'AC', 'Ocean Eng 214', false, '2026-09-04', '06:30 PM', '90m', 60, 41, true, false, 'live', 'public', ARRAY('Systems', 'Distributed Systems', 'Linux', 'Pizza'), 'Weekly systems talk — this week: kernel bypass networking demo and open hack time on the cluster.', current_timestamp(), NULL),
  ('EV-02', 'Figma 101 — Campus Design Systems', 'workshop', 'Design Club', 'DC', 'Virtual · Teams', true, '2026-09-04', '04:00 PM', '1h', 100, 78, false, false, 'draft', 'public', ARRAY('Design', 'UI/UX', 'Figma', 'Virtual'), 'Hands-on session building accessible design systems with OKLCH tokens and live React components.', current_timestamp(), NULL),
  ('EV-03', 'Transfer Student Firepit Mixer', 'social', 'Peer Mentors', 'PM', 'Quad Firepit', false, '2026-09-04', '07:30 PM', '2h', 50, 47, true, false, 'live', 'private', ARRAY('Social', 'Community', 'Mixer', 'Food'), 'Campfire snacks, s’mores, and campus survival tips for new and transfer students.', current_timestamp(), NULL),
  ('EV-04', 'Databricks Coffee Chats & Career AMA', 'career', 'Career Center', 'CC', 'Alumni Lounge', false, '2026-09-05', '01:00 PM', '2h', 12, 11, true, false, 'live', 'public', ARRAY('Career', 'Internship', 'Networking', 'Databricks'), '1-on-1 coffee chat slots with Databricks engineering leaders and campus recruiters.', current_timestamp(), NULL),
  ('EV-05', 'Robotics Lab Open House', 'meeting', 'Robotics Club', 'RB', 'Robotics Lab B2', false, '2026-09-05', '05:00 PM', '90m', 80, 58, false, false, 'live', 'public', ARRAY('Robotics', 'Hardware', 'ROS2', 'AI'), 'Live demos of autonomous quadrupeds, computer vision pipelines, and lab recruitment overview.', current_timestamp(), NULL),
  ('EV-06', 'Resume Lab — Drop-in Review', 'career', 'Career Center', 'CC', 'HUB 317', false, '2026-09-06', '12:00 PM', '2h', 40, 24, false, false, 'live', 'public', ARRAY('Career', 'Resume', 'Mentorship'), 'Peer and alumni resume reviews for summer internship applications and tech roles.', current_timestamp(), NULL),
  ('EV-07', 'Debate Society — Practice Rounds', 'meeting', 'Debate Society', 'DB', 'HUB 204', false, '2026-09-06', '04:30 PM', '2h', 30, 18, false, false, 'live', 'public', ARRAY('Debate', 'Public Speaking', 'Policy'), 'Parliamentary debate practice rounds covering AI governance, open source data, and energy policy.', current_timestamp(), NULL),
  ('EV-08', 'Lightning Blitz Mini-Hack', 'hackathon', 'Startup Garage', 'SG', 'Innovation Lab', false, '2026-09-06', '06:00 PM', '3h', 30, 28, true, false, 'live', 'public', ARRAY('Hackathon', 'Rapid Prototyping', 'Startups', 'Free Food'), 'Fast 3-hour rapid prototyping challenge with instant cash micro-grants for winning teams.', current_timestamp(), NULL),
  ('EV-09', 'Moonlight Jam on the Quad', 'social', 'Music Society', 'MS', 'Main Quad Stage', false, '2026-09-06', '09:00 PM', '3h', 300, 300, false, false, 'live', 'public', ARRAY('Music', 'Festival', 'Social', 'Quad'), 'Acoustic and indie student band performances under the stars on the central campus quad.', current_timestamp(), NULL),
  ('EV-10', 'HackDavis 36 — Build for Good', 'hackathon', 'CruX Coding Club', 'CX', 'Kemper 210', false, '2026-09-07', '09:00 AM', '36h', 250, 213, true, true, 'live', 'public', ARRAY('Hackathon', 'AI', 'Social Impact', 'Lakehouse'), 'Flagship 36-hour social impact hackathon with $5,000 prize pool and Databricks engineering mentors.', current_timestamp(), NULL),
  ('EV-11', 'Intramural 3v3 Hoops Blitz', 'sports', 'Intramurals', 'IM', 'Rec Courts', false, '2026-09-07', '11:00 AM', '3h', 24, 22, false, false, 'live', 'public', ARRAY('Sports', 'Basketball', 'Fitness'), 'Weekend 3-on-3 double-elimination basketball tournament with championship merch prizes.', current_timestamp(), NULL),
  ('EV-12', 'Sunrise Yoga — Library Terrace', 'sports', 'Wellness Collective', 'WE', 'Library Terrace', false, '2026-09-09', '06:30 AM', '1h', 60, 34, false, false, 'live', 'public', ARRAY('Wellness', 'Yoga', 'Mindfulness', 'Outdoors'), 'Gentle guided vinyasa flow with sunrise views over campus. Mats and tea provided.', current_timestamp(), NULL),
  ('EV-13', 'Genie Ideathon — 48h Virtual Build', 'hackathon', 'GDG Campus', 'GD', 'Discord & Virtual', true, '2026-09-17', '02:00 PM', '48h', 150, 96, false, false, 'live', 'public', ARRAY('Hackathon', 'Genie Agents', 'Cloud', 'Virtual'), 'Asynchronous global build sprint creating autonomous student tools with Databricks Genie.', current_timestamp(), NULL),
  ('EV-14', 'Delta Lake Deep-Dive with Genie', 'workshop', 'Data Club', 'DA', 'Virtual · Teams', true, '2026-09-09', '03:00 PM', '90m', 200, 140, false, false, 'live', 'public', ARRAY('Data', 'Delta Lake', 'SQL', 'Genie'), 'Interactive tutorial on ACID transactions, time travel, and Genie Text-to-SQL architecture.', current_timestamp(), NULL);

-- 2. Insert Campus Surveys (created_by NULL = seeded content)
INSERT INTO campus_surveys VALUES
  ('SRV-01', 'Hack the Lake — Pre-Event Hacker Survey', 'Tell us your track, dietary needs, project interests, and mentorship preferences. Takes 2 minutes!', 'EV-10', true, true, 'public', 86, '[{"id":"q1","type":"radio","title":"Which track do you want to build in?","required":true,"options":["Campus Genie AI Agents","Lakehouse Analytics & Governance","Social Impact & Open Theme"]},{"id":"q2","type":"checkbox","title":"Any dietary needs? (Meals & midnight snacks covered)","required":false,"options":["Vegetarian","Vegan","Gluten-Free","Halal"]},{"id":"q3","type":"scale","title":"How prepared do you feel for a 48h build sprint?","required":false,"scaleMin":"Beginner","scaleMax":"Battle-Tested"},{"id":"q4","type":"star","title":"Rate your excitement for Databricks Lakehouse features!","required":false},{"id":"q5","type":"text","title":"What topics or tools are you most excited to explore?","required":false}]', current_timestamp(), NULL),
  ('SRV-02', 'ACM Weekly — Kernel Talk Feedback', 'Help us pick next month systems talk topics & vote for pizza flavors!', 'EV-01', true, false, 'public', 28, '[{"id":"q1","type":"radio","title":"Rate this week kernel bypass networking talk","required":true,"options":["Outstanding","Great","Solid","Needs more code"]},{"id":"q2","type":"text","title":"What topic should we explore next?","required":false}]', current_timestamp(), NULL);

-- 3. Insert Knowledge Sources
INSERT INTO knowledge_sources VALUES
  ('DOC-01', 'Campus Hackathon Handbook 2026.pdf', 'document', 'Guidelines & Rules', 'Official rules, hardware lending policies, judging rubrics, and sponsor API credits for campus hackathons.', 48, '2.4 MB', 'Indexed', 'Hack the Lake 2026 rules: Teams of 1-4 students. All code must be written during the event. Databricks AI Serving and Genie APIs are provided with $200 free cloud credits per team. Submissions are judged on Technical Depth (30%), Practical Impact (30%), User Experience (20%), and Presentation (20%). Food and quiet sleeping zones available in Colt Arena 2nd floor.', 'Campus Admin', current_timestamp()),
  ('DOC-02', 'CS301 Distributed Systems Syllabus.pdf', 'syllabus', 'Curriculum', 'Course schedule, reading lists on Paxos/Raft, office hours, and project milestones.', 36, '1.1 MB', 'Indexed', 'CS301 covers distributed consensus, ACID guarantees, Delta Lake change data feed, linearizability, and fault tolerance. Midterm date: May 4. Final project requires implementing a high-throughput key-value store with raft consensus in Go/Rust.', 'Prof. Vance', current_timestamp()),
  ('DOC-03', 'Student Clubs & Funding Policy.md', 'policy', 'Governance', 'Student Senate guide on reserving campus halls, ordering pizza budgets, and security permits.', 24, '480 KB', 'Indexed', 'Registered campus clubs receive up to $1,500/semester for events with free student admission. Event requests must be submitted at least 5 business days in advance. Food distribution requires university catering safety compliance form.', 'Dean of Students', current_timestamp()),
  ('DOC-04', 'Lakehouse Delta Lake Architecture Whitepaper.pdf', 'technical', 'Lakehouse Reference', 'Technical guide on ACID transactions, Time Travel, Liquid Clustering, and Unity Catalog lineage.', 64, '4.8 MB', 'Indexed', 'Delta Lake is an open-format storage layer that brings reliability to data lakes. Key capabilities include ACID transactions, scalable metadata handling, and unifying streaming and batch data processing. Unity Catalog delivers unified governance across data and AI assets.', 'Databricks Research', current_timestamp()),
  ('DOC-05', 'Campus Dining & Cafe Hours 2026.json', 'dataset', 'Campus Life', 'Operating hours, dietary menus, allergens, and inventory schedules for campus dining.', 12, '180 KB', 'Live in Lakehouse', 'Central Dining Hall: 7:00 AM - 10:00 PM daily. Campus Cafe (Kemper Hall): 8:00 AM - 8:00 PM. Serving A2 organic milk, handcrafted espresso, and fresh pastries.', 'Dining Services', current_timestamp());

-- 4. Insert Research Labs & Clubs
INSERT INTO clubs_and_labs VALUES
  ('LAB-01', 'Autonomous Intelligent Systems Lab', 'research_lab', 'Dr. Sarah Jenkins', 'Aarav Patel', 'LLM Agents, Multi-Agent Systems & Robotics', true, 8, ARRAY('Python', 'PyTorch', 'ROS2', 'Databricks'), 'Tuesdays & Thursdays 5:00 PM', 'Kemper Hall 312', 'ais-lab@campus.edu', ARRAY('Campus Genie Multi-Agent Swarm', 'Drone Navigation with VLM')),
  ('LAB-02', 'High Performance Data Systems Group', 'research_lab', 'Prof. Marcus Vance', 'Elena Rostova', 'Delta Lake Internals & Distributed Storage', true, 10, ARRAY('C++', 'Rust', 'Distributed Systems', 'SQL'), 'Mondays 4:00 PM', 'Engineering IV 202', 'data-systems@campus.edu', ARRAY('Zero-Copy Parquet Deserializer', 'Governed Data Sharing')),
  ('CLUB-01', 'CruX Coding & AI Club', 'tech_club', 'Prof. David K.', 'Ava Kimura', 'Competitive Programming, Open Source & Fests', true, 5, ARRAY('Python', 'TypeScript', 'Algorithms'), 'Wednesdays 6:00 PM', 'Colt Innovation Wing', 'crux@campus.edu', ARRAY('Hack the Lake Organizer', 'Campus Mentorship Portal')),
  ('CLUB-02', 'Design & UX Guild', 'tech_club', 'Prof. Angela Ray', 'Maya Chen', 'Accessible UI/UX & Design Systems', true, 4, ARRAY('Figma', 'Tailwind', 'CSS', 'React'), 'Thursdays 4:00 PM', 'Kemper 110', 'design@campus.edu', ARRAY('Campus Genie UI Redesign', 'Accessible Campus Wayfinding'));

-- 5. Insert Bengaluru Tech Events
INSERT INTO city_tech_events VALUES
  ('BLR-01', 'Bengaluru Generative AI Builders Meetup', 'GenAI BLR Collective', 'Indiranagar', '100ft Road Innovation Hub', '2026-09-11', '06:00 PM', 0, 180, 'Generative AI', 18),
  ('BLR-02', 'Rust & High-Throughput Systems BLR', 'Rustaceans South India', 'Koramangala', 'Koramangala 4th Block Co-work', '2026-09-12', '10:30 AM', 0, 95, 'Rust / Systems', 24),
  ('BLR-03', 'HSR Founders & AI Angel Mixer', 'Peak BLR', 'HSR Layout', 'Sector 3 Rooftop', '2026-09-12', '05:00 PM', 250, 120, 'Founders & VC', 28);

-- 6. Insert Alumni Career Pathways
INSERT INTO alumni_career_pathways VALUES
  ('ALUM-01', 2023, 'Computer Science & Engineering', ARRAY('CruX Coding Club', 'ACM Chapter'), ARRAY('Autonomous Intelligent Systems Lab'), 'Associate AI Engineer', 'Databricks', 'Senior ML Systems Engineer', 'Databricks', 'Lakehouse AI & Model Serving', 'Joining an active research lab in 3rd year was the single biggest turning point for landing Lakehouse roles.'),
  ('ALUM-02', 2022, 'Information Science', ARRAY('Design Club'), ARRAY('High Performance Data Systems Group'), 'Software Development Engineer I', 'Microsoft', 'Senior SDE', 'Stripe', 'Distributed Cloud Infrastructure', 'Prioritize solid systems fundamentals and contributing to open-source fests over resume stuffing.');

-- 7. Insert Procurement Inventory
INSERT INTO procurement_inventory VALUES
  ('ITEM-01', 'A2 Organic Full-Cream Milk (20L Cans)', 'Dairy', 4, 8, 'Amul Dairy & Organic Farms', 14250.00, 2, '2026-04-01'),
  ('ITEM-02', 'Handmade Crispy Waffle Cones (Box of 500)', 'Waffle Cones', 2, 5, 'Cone King Supplies', 4800.00, 7, '2026-03-28'),
  ('ITEM-03', 'Belgian Dark Chocolate Chips (10kg)', 'Dry Goods', 6, 4, 'Royal Confectioneries', 6200.00, 3, '2026-04-03');

-- 8. Insert Campus Building Locations (Databricks University · Jayanagar campus)
INSERT INTO campus_locations VALUES
  ('LOC-01', 'Databricks University', 'Central Library', 'library', 12.92640, 77.58950, 'Four-floor stack with silent study decks, the Delta Reading Room, and a terrace garden open till 11 PM.'),
  ('LOC-02', 'Databricks University', 'Main Canteen', 'dining', 12.92520, 77.59180, 'The busiest eatery on campus — filter coffee, masala dosas, and late-night Maggi counters.'),
  ('LOC-03', 'Databricks University', 'Student Center Cafe', 'dining', 12.92430, 77.59040, 'Espresso bar and waffle station tucked beside the Student Center lounge.'),
  ('LOC-04', 'Databricks University', 'Main Gate', 'landmark', 12.92380, 77.59300, 'Grand arched entrance on 9th Main Road with the campus map plinth and security desk.'),
  ('LOC-05', 'Databricks University', 'Innovation Lab', 'lab', 12.92710, 77.59090, 'Maker space with 3D printers, robotics benches, and the Genie agent sandbox cluster.'),
  ('LOC-06', 'Databricks University', 'Kemper Hall', 'academics', 12.92660, 77.59210, 'Primary lecture block for CS and Statistics; houses Kemper 210 and the CS department office.'),
  ('LOC-07', 'Databricks University', 'Open Air Auditorium', 'landmark', 12.92580, 77.58880, 'Amphitheatre stage on the west quad used for fests, club showcases, and moonlight jams.'),
  ('LOC-08', 'Databricks University', 'Sports Complex', 'sports', 12.92330, 77.58970, 'Basketball courts, badminton halls, and the campus gym with morning yoga on the lawn.'),
  ('LOC-09', 'Databricks University', 'North Hostel', 'housing', 12.92800, 77.59280, 'Undergraduate residence block with the night canteen on the ground floor.'),
  ('LOC-10', 'Databricks University', 'South Hostel', 'housing', 12.92260, 77.59140, 'Senior-year residence block facing the south lawn and the astro turf court.'),
  ('LOC-11', 'Databricks University', 'Health Center', 'wellness', 12.92470, 77.58840, 'Campus clinic with a resident nurse, counseling rooms, and 24x7 emergency contact.'),
  ('LOC-12', 'Databricks University', 'Admin Block', 'admin', 12.92590, 77.59350, 'Registrar, accounts, and the Dean of Students office behind the banyan courtyard.');

-- 8. Official WhatsApp group invite links (join buttons on event detail)
UPDATE campus_events SET whatsapp_url = CASE event_id
  WHEN 'EV-01' THEN 'https://chat.whatsapp.com/KernelBypassPizzaNights'
  WHEN 'EV-04' THEN 'https://chat.whatsapp.com/DatabricksCoffeeChats26'
  WHEN 'EV-08' THEN 'https://chat.whatsapp.com/LightningBlitzCrew'
  WHEN 'EV-10' THEN 'https://chat.whatsapp.com/HackDavis36Teams'
  WHEN 'EV-11' THEN 'https://chat.whatsapp.com/HoopsBlitzBracket'
  WHEN 'EV-13' THEN 'https://chat.whatsapp.com/GenieIdeathonBuilds'
  ELSE NULL END;

-- 9. Event Awards (podium winners per event)
INSERT INTO event_awards VALUES
 ('AW-101','EV-10','HackDavis 36 — Build for Good',1,'Aarav Patel','STU-104281','Team Lakehouse Llamas','KrishiMitra — vernacular crop advisory agent','₹25,000 + Databricks mentorship','AI for Social Impact',current_timestamp()),
 ('AW-102','EV-10','HackDavis 36 — Build for Good',2,'Meera Krishnan','STU-107315','Team Pixel Panchayat','CivicEye — pothole & streetlight GIS reporter','₹15,000','AI for Social Impact',current_timestamp()),
 ('AW-103','EV-10','HackDavis 36 — Build for Good',3,'Rohan Das','STU-109902','Team Night Owls','MedBridge — offline-first clinic handoff summaries','₹10,000','AI for Social Impact',current_timestamp()),
 ('AW-201','EV-08','Lightning Blitz Mini-Hack',1,'Ishita Rao','STU-112044','Solo','PulseBoard — live campus sentiment wall','₹5,000 micro-grant','Rapid Prototyping',current_timestamp()),
 ('AW-202','EV-08','Lightning Blitz Mini-Hack',2,'Kabir Singh','STU-113871','Team Stack Smash','QueueLess — dining-hall crowd predictor','₹3,000 micro-grant','Rapid Prototyping',current_timestamp()),
 ('AW-203','EV-08','Lightning Blitz Mini-Hack',3,'Ananya Gopal','STU-115528','Team Stack Smash','QueueLess — dining-hall crowd predictor','₹2,000 micro-grant','Rapid Prototyping',current_timestamp()),
 ('AW-301','EV-13','Genie Ideathon — 48h Virtual Build',1,'Dev Nair','STU-201347','Team Agent Swarm','AutoTa — Genie-powered TA office-hours agent','Cloud credits + showcase slot','Genie Agents',current_timestamp()),
 ('AW-302','EV-13','Genie Ideathon — 48h Virtual Build',2,'Sara Mathew','STU-203918','Team Delta Queens','LineageLens — Unity Catalog lineage explorer','Cloud credits','Genie Agents',current_timestamp()),
 ('AW-303','EV-13','Genie Ideathon — 48h Virtual Build',3,'Farhan Ali','STU-207660','Team Agent Swarm','AutoTa — Genie-powered TA office-hours agent','Cloud credits','Genie Agents',current_timestamp()),
 ('AW-401','EV-01','ACM Weekly — Systems & Pizza',1,'Elena Rostova','STU-301002','—','Zero-copy Parquet deserializer benchmark suite','Pizza royalty + ACM spotlight','Systems',current_timestamp()),
 ('AW-402','EV-01','ACM Weekly — Systems & Pizza',2,'Vikram Shetty','STU-302755','—','eBPF kernel-bypass demo harness','ACM spotlight','Systems',current_timestamp()),
 ('AW-403','EV-01','ACM Weekly — Systems & Pizza',3,'Tara Bose','STU-304411','—','Chaos testing Raft visualizer','ACM spotlight','Systems',current_timestamp());

-- 10. Teammate Matcher profiles (details only — no photos by design)
INSERT INTO teammate_profiles VALUES
 ('TM-01','Aarav Patel','3rd Year','Computer Science','College of Engineering','hackathon','Ships fast, breaks things, patches faster. Looking for a HackDavis team that actually demos.',ARRAY('PyTorch','TypeScript','Databricks','Figma'),'Tue/Thu evenings + weekends','10+ hrs/week sprint mode',92,74,88,81,'DM on campus chat',current_timestamp()),
 ('TM-02','Meera Krishnan','4th Year','Information Science','College of Engineering','project','Design-engineer hybrid. I obsess over the last 10% — motion, empty states, a11y.',ARRAY('React','Tailwind','Figma','Motion'),'Weekday afternoons','6–8 hrs/week steady',85,68,79,94,'Design Guild studio hours',current_timestamp()),
 ('TM-03','Rohan Das','2nd Year','Electronics & Communication','College of Engineering','study','Circuits + signals survivor. Want a fixed weekly problem-set group for ECE core.',ARRAY('Signals','MATLAB','C++','KiCad'),'Mon/Wed/Fri mornings','4–6 hrs/week fixed slots',78,90,72,88,'Library 3rd floor carrels',current_timestamp()),
 ('TM-04','Ishita Rao','3rd Year','Data Science','School of Statistics','project','Lakehouse maximalist. If it is not in Delta format I am not touching it.',ARRAY('Spark SQL','Delta Lake','Python','dbt'),'Flexible weekdays','8–10 hrs/week',88,80,91,76,'Data Club lab desk',current_timestamp()),
 ('TM-05','Kabir Singh','1st Year','Computer Science','College of Engineering','hackathon','First-year energy, infinite enthusiasm. I learn frameworks overnight and document everything.',ARRAY('Next.js','Node','Supabase','Python'),'Evenings + Sundays','10+ hrs/week sprints',74,82,64,70,'CruX coding club wing',current_timestamp()),
 ('TM-06','Sara Mathew','4th Year','Mathematics','School of Statistics','study','Proofs before coffee. Hosting a Putnam-style weekly problem circle.',ARRAY('Real Analysis','Linear Algebra','LaTeX','Python'),'Tue/Thu 7–9 AM','4 hrs/week precise',90,86,95,92,'Math reading room',current_timestamp()),
 ('TM-07','Farhan Ali','3rd Year','Mechanical','College of Engineering','project','Robotics + firmware. I bring the quadruped; you bring the perception stack.',ARRAY('ROS2','C++','CAD','Embedded C'),'Lab nights','8 hrs/week build sessions',82,72,84,79,'AIS Lab B2',current_timestamp()),
 ('TM-08','Tara Bose','2nd Year','Cognitive Science','School of Liberal Arts','study','Spaced-repetition nerd. Building a shared Notion brain for orgo + cog-sci finals.',ARRAY('Anki','R','Notion','Writing'),'Weekend mornings','5 hrs/week consistent',87,84,71,90,'Quad study tables',current_timestamp()),
 ('TM-09','Vikram Shetty','4th Year','Computer Science','College of Engineering','hackathon','Systems gremlin. eBPF, io_uring, and hot takes about your ORM.',ARRAY('Rust','eBPF','Linux','Go'),'Late nights','Weekend warrior mode',69,58,93,74,'ACM kernel lab',current_timestamp()),
 ('TM-10','Ananya Gopal','3rd Year','Electrical Engineering','College of Engineering','project','Power systems by day, PCB art by night. Seeking a capstone crew that tests before shipping.',ARRAY('PCB Design','Simulink','Firmware','Soldering'),'Tue/Sat blocks','6–8 hrs/week milestone-based',84,78,83,87,'IEEE lab bench 4',current_timestamp()),
 ('TM-11','Dev Nair','2nd Year','Computer Science','College of Engineering','hackathon','Agent wrangler. My side projects have side projects. Genie prompt-chef.',ARRAY('LangGraph','Databricks Genie','Python','Vercel AI'),'Fri evenings','Sprint weekends + demos',80,65,86,68,'GDG campus loft',current_timestamp()),
 ('TM-12','Nikhila Reddy','4th Year','Chemical Engineering','College of Engineering','study','Thermo tutor with color-coded notes. Forming a 6 AM focus cohort before placements.',ARRAY('Thermo','Fluid Mechanics','MATLAB'),'Daily 6–8 AM','Daily 2 hr deep-work',93,96,82,97,'Cafe corner booth',current_timestamp());
