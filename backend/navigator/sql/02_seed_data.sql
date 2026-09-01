INSERT OVERWRITE TABLE workspace.campus_navigator.campus_events VALUES
  ('EV-001', 'Applied AI Lab Open House', 'campus_event', 'BMSCE AI Research Group', 'AI', TIMESTAMP '2026-09-04 17:00:00', TIMESTAMP '2026-09-04 18:30:00', 'BMSCE Data Lab, CSE Block', 8, 0, 'Open to 2nd- and 3rd-year CSE/ISE students; Python basics recommended', 'open', 'published', 'Meet project mentors, review current RAG evaluation work, and apply for the semester team.', 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('EV-002', 'GenAI Builders Bengaluru: Evaluation Night', 'city_meetup', 'Bengaluru GenAI Builders', 'AI', TIMESTAMP '2026-09-04 18:30:00', TIMESTAMP '2026-09-04 20:30:00', 'Jayanagar Innovation Hub', 24, 250, 'Students with a valid college ID; beginner-friendly', 'not_applicable', 'published', 'Hands-on evaluation clinic for RAG and agent workflows with local builders.', 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('EV-003', 'Databricks Genie Opportunity Data Clinic', 'workshop', 'BMSCE Data Science Club', 'Data and AI', TIMESTAMP '2026-09-04 16:30:00', TIMESTAMP '2026-09-04 18:00:00', 'BMSCE Library Seminar Hall', 6, 100, 'All BMSCE students; bring a laptop', 'not_applicable', 'published', 'Learn how table descriptions, certified queries, and evaluation sets improve Genie answers.', 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('EV-004', 'ML Systems Reading Group', 'campus_event', 'BMSCE Systems Collective', 'ML Systems', TIMESTAMP '2026-09-05 11:00:00', TIMESTAMP '2026-09-05 12:30:00', 'CSE Seminar Hall', 7, 0, 'Open to students comfortable reading technical papers', 'rolling', 'published', 'Weekly discussion of serving, evaluation, and data-system papers.', 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('EV-005', 'AI Product Hack Evening', 'hackathon', 'Bengaluru Student Builders', 'AI Product', TIMESTAMP '2026-09-11 17:30:00', TIMESTAMP '2026-09-11 21:00:00', 'Koramangala 5th Block', 38, 0, 'College students in teams of 1-3', 'not_applicable', 'published', 'A short build sprint for practical student-facing AI products.', 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00');

-- COMMAND ----------

INSERT OVERWRITE TABLE workspace.campus_navigator.clubs_labs VALUES
  ('LAB-001', 'BMSCE Applied AI Lab', 'research_lab', 'RAG evaluation, responsible agents, and multilingual campus search', 'open', 4.0, 'Fridays 5:00 PM–7:00 PM', '2nd- or 3rd-year CSE/ISE; Python basics; no prior research required', 'CSE Block, Data Lab', 8, 0, 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('CLUB-001', 'BMSCE Data Science Club', 'ai_club', 'Databricks, analytics engineering, ML projects, and peer learning', 'rolling', 3.0, 'Wednesdays 4:30 PM–6:00 PM', 'Open to all branches; project teams require a short interest form', 'BMSCE Library Seminar Hall', 6, 0, 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('LAB-002', 'Vision and Robotics Lab', 'research_lab', 'Computer vision, edge inference, and autonomous systems', 'closed', 7.0, 'Tuesdays and Thursdays 5:00 PM–7:00 PM', '3rd-year students with linear algebra and Python', 'ECE Research Wing', 12, 0, 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00');

-- COMMAND ----------

INSERT OVERWRITE TABLE workspace.campus_navigator.recruitment_windows VALUES
  ('RW-001', 'LAB-001', TIMESTAMP '2026-08-28 09:00:00', TIMESTAMP '2026-09-08 20:00:00', 'open', '2nd- or 3rd-year CSE/ISE; Python basics', 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('RW-002', 'CLUB-001', TIMESTAMP '2026-08-20 09:00:00', TIMESTAMP '2026-09-30 20:00:00', 'open', 'Open to all BMSCE branches', 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('RW-003', 'LAB-002', TIMESTAMP '2026-07-15 09:00:00', TIMESTAMP '2026-08-15 20:00:00', 'closed', '3rd-year students with Python and linear algebra', 'https://campus-genie-ivory.vercel.app/', true, TIMESTAMP '2026-09-01 09:00:00');

-- COMMAND ----------

INSERT OVERWRITE TABLE workspace.campus_navigator.alumni_outcomes VALUES
  ('AO-001', 'LAB-001', 2025, 'ML engineering and research internships', 'Synthetic cohort example: lab members produced evaluated capstone projects and applied to ML internships.', 'Illustrative hackathon data; association does not establish causation.', true, TIMESTAMP '2026-09-01 09:00:00'),
  ('AO-002', 'CLUB-001', 2025, 'Data and analytics internships', 'Synthetic cohort example: project-team members practiced SQL, dashboards, and peer review.', 'Illustrative hackathon data; association does not establish causation.', true, TIMESTAMP '2026-09-01 09:00:00');
