-- Custom APIs demo — seed data.
--
-- Ids are pinned deliberately. The four-hop path this demo is built to show reads
--   timesheet 1041 → employee 77 → department 8 → location 3 → organisation 1
-- and the docs, the challenges and the captured transcript all quote those numbers, so
-- they are part of the published contract rather than an implementation detail.
--
-- DEMO-ONLY: pinning primary keys like this — real ids are never part of an API
-- contract, and a real seed would let the sequence assign them.
--
-- All data synthetic: no real people, no real businesses, no real ABNs.

-- `audit_log` is truncated too. It is framework infrastructure rather than application
-- data, but a demo whose trail accumulates across rebuilds shows a visitor other people's
-- history and makes the captured transcript unreproducible. The nightly rebuild is what
-- bounds it on the deployed demo; here the seed does.
TRUNCATE invoices, timesheets, employees, departments, locations, organisations, local_users RESTART IDENTITY CASCADE;
TRUNCATE audit_log RESTART IDENTITY;
TRUNCATE demo_events RESTART IDENTITY;

-- ── Identities ─────────────────────────────────────────────────────────────────────
INSERT INTO local_users (id, display_name, persona) VALUES
  (41, 'Alice Nguyen',  'employees'),
  (42, 'Sam Okafor',    'duty_manager'),
  (43, 'Priya Raman',   'payroll'),
  (44, 'Omar Haddad',   'kestrel_payroll'),
  (45, 'Ben Carter',    'colleague'),
  (46, 'Nadia Rahman',  'kitchen_colleague'),
  (47, 'Tomas Ferreira','department_manager');

-- ── Companies ──────────────────────────────────────────────────────────────────────
INSERT INTO organisations (id, name) VALUES
  (1, 'Harbourline Hospitality'),
  (2, 'Kestrel Facilities Group'),
  (3, 'Scratch Sandbox');

-- ── Hop 1: locations ───────────────────────────────────────────────────────────────
INSERT INTO locations (id, organisation_id, name) VALUES
  (3, 1, 'Harbour Lane'),
  (4, 1, 'Quay Street'),
  (5, 2, 'Kestrel Depot'),
  (6, 3, 'Sandbox Site');

-- ── Hop 2: departments ─────────────────────────────────────────────────────────────
INSERT INTO departments (id, location_id, name) VALUES
  (8,  3, 'Front of House'),
  (9,  3, 'Kitchen'),
  (10, 5, 'Cleaning'),
  (11, 6, 'Sandbox Department');

-- ── Hop 3: employees ───────────────────────────────────────────────────────────────
INSERT INTO employees (id, department_id, full_name, email, user_id) VALUES
  (77, 8,  'Alice Nguyen', 'alice@harbourline.example',  41),
  (78, 8,  'Ben Carter',   'ben@harbourline.example',    45),
  (79, 8,  'Sam Okafor',   'sam@harbourline.example',    42),
  (80, 10, 'Dana Whitlock', 'dana@kestrel.example',      NULL),
  (81, 11, 'Sandbox Worker', 'sandbox@example.invalid',  NULL),
  -- Department 9 is the KITCHEN — a sibling of Front of House under the same location,
  -- in the same company. It exists so the department-restricted manager has something
  -- to be refused: without a Kitchen timesheet, a restriction to Front of House is
  -- indistinguishable from no restriction at all.
  (82, 9,  'Nadia Rahman', 'nadia@harbourline.example',  46),
  (83, 8,  'Tomas Ferreira', 'tomas@harbourline.example', 47);

-- ── Hop 4: timesheets — the claim ──────────────────────────────────────────────────
-- 1041 is Alice's own row, in Harbourline. 1042 is her colleague Ben's, in the SAME
-- company and the SAME department — so the only thing separating them is `owner_id`.
-- 1043 belongs to Kestrel, and is the cross-company test.
INSERT INTO timesheets
  (id, employee_id, work_date, start_at, end_at, hours, status, cost_rate, note, owner_id, owner_display_name) VALUES
  (1041, 77, '2026-08-10', '2026-08-10T07:00:00Z', '2026-08-10T15:00:00Z', 8.00, 'submitted', 42.50, 'Morning service', 41, 'Alice Nguyen'),
  (1042, 78, '2026-08-10', '2026-08-10T15:00:00Z', '2026-08-10T23:00:00Z', 8.00, 'submitted', 39.00, 'Evening service', 45, 'Ben Carter'),
  (1044, 79, '2026-08-11', '2026-08-11T09:00:00Z', '2026-08-11T17:00:00Z', 8.00, 'approved',  55.00, 'Duty shift',      42, 'Sam Okafor'),
  (1043, 80, '2026-08-10', '2026-08-10T06:00:00Z', '2026-08-10T14:00:00Z', 8.00, 'submitted', 37.25, 'Depot clean',     NULL, 'System'),
  -- Harbourline, but the KITCHEN (department 9). Same company and same location as
  -- 1041/1042/1044 — only the department differs, which is the whole test.
  (1045, 82, '2026-08-11', '2026-08-11T05:00:00Z', '2026-08-11T13:00:00Z', 8.00, 'submitted', 44.00, 'Breakfast prep',  46, 'Nadia Rahman'),
  -- The SCRATCH company's row, and a READ fixture only. It is what proves Alice's grants
  -- span two companies (her list is [1041, 1046]) and it is the sole row when a search is
  -- narrowed to Scratch. Nothing approves it: challenge 7 creates its own row, because a
  -- shared one-shot target is a 409 for the second visitor through. Owned by Alice.
  (1046, 81, '2026-08-12', '2026-08-12T07:00:00Z', '2026-08-12T15:00:00Z', 8.00, 'submitted', 31.00, 'Sandbox shift',   41, 'Alice Nguyen');

-- ── Invoices — payroll-only resource ───────────────────────────────────────────────
INSERT INTO invoices (id, department_id, reference, amount, status) VALUES
  (2001, 8,  'HL-2026-0001', 1840.00, 'open'),
  (2002, 10, 'KF-2026-0001',  920.00, 'open');

-- Park the shared sequence above every pinned id so live writes never collide.
SELECT setval('global_id_seq', 5000, true);
