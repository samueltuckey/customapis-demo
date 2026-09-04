-- Custom APIs demo — the whole application schema.
--
--   organisations                    ◄── TENANT ROOT
--     └─ locations                   → organisations                            (1 hop)
--          └─ departments            → locations → organisations                (2 hops)
--               ├─ employees         → departments → locations → organisations  (3 hops)
--               │    └─ timesheets   → employees → … → organisations            (4 HOPS)
--               └─ invoices          → departments → locations → organisations  (3 hops)
--
-- The four-hop timesheet path is the concrete form of "access follows relational paths":
-- a timesheet reaches its company through joins the framework derives, not through a
-- tenant column on the row.
--
-- Every FK here is doing double duty — it is the referential constraint AND the tenancy
-- path the framework derives its scoping from. There is no `organisation_id` on
-- `timesheets`, and adding one would defeat the point of the demo.
--
-- TABLE NAMES ARE PLURAL, deliberately: pgrm derives a route's URL from the model name
-- and refuses to guess a plural ("the plural, if any, comes from how you name the
-- model/table, never from a guesser). Singular tables would mean every
-- CRUD route declaring `path: '/timesheets'` by hand; plural ones mean the five standard
-- routes declare `{ model, operation }` and nothing else.
--
-- The six `created_by_* / last_updated_*` columns on every table are pgrm's RESERVED
-- MANAGED COLUMNS: presence-detected and stamped by the framework, never writable by a
-- caller. Their shape is fixed and boot-validated — `*_by_id` nullable, but
-- `*_by_display_name` and both timestamps NOT NULL, because a display name is always
-- populated ('System' for non-user actions) and an unset audit timestamp is meaningless.
-- `pgrm check` rejects the schema otherwise.

-- Drop the SCHEMA, not a list of tables. A named list only removes what the list still
-- names, so renaming a table (singular → plural, when the URL is derived from the model
-- name) silently orphans the old one — and `pgrm generate models` introspects the LIVE
-- database, so it would then emit a model for each. This keeps dev-up.sh's "safe to
-- re-run" true across any rename. `audit_log` is recreated straight after, from
-- `npx pgrm db sql audit_log`.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- ONE sequence for every application table. A primary key is therefore
-- globally unique across companies, so `timesheet 1041` names exactly one row in the
-- whole deployment — which is what makes the cross-company 404 a proof rather than a
-- coincidence. The same id in two companies cannot happen here, by construction.
CREATE SEQUENCE global_id_seq START 1000;


-- ── Identity ───────────────────────────────────────────────────────────────────────
-- Local user table, bigint ids, matching pgrm's actor columns (`created_by_id`,
-- `owner_id`). Ids are integers end to end: a non-integer is rejected at the boundary
-- rather than coerced, so a mismatch surfaces as an error and never as a wrong row.
-- No route is ever declared on this table.
CREATE TABLE local_users (
  id                BIGINT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  display_name      TEXT NOT NULL,
  persona           TEXT NOT NULL UNIQUE
);


-- ── The tenant root ────────────────────────────────────────────────────────────────
-- No collection route is ever declared on this table: the tenant root is
-- non-scoped by design, so a list route would return every company to any caller.
CREATE TABLE organisations (
  id                            BIGINT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  name                          TEXT NOT NULL,
  created_by_id                 BIGINT,
  created_by_display_name       TEXT NOT NULL DEFAULT 'System',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_by_id            BIGINT,
  last_updated_by_display_name  TEXT NOT NULL DEFAULT 'System',
  last_updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── Hop 1 ──────────────────────────────────────────────────────────────────────────
-- `organisation_id` matches `tenancy.idColumn` exactly, casing included —
-- so location is scoped by a direct predicate with no join, and everything below it
-- reaches the tenant THROUGH this column.
CREATE TABLE locations (
  id                            BIGINT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  organisation_id               BIGINT NOT NULL REFERENCES organisations(id),
  name                          TEXT NOT NULL,
  created_by_id                 BIGINT,
  created_by_display_name       TEXT NOT NULL DEFAULT 'System',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_by_id            BIGINT,
  last_updated_by_display_name  TEXT NOT NULL DEFAULT 'System',
  last_updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_locations_organisation ON locations(organisation_id);


-- ── Hop 2 ──────────────────────────────────────────────────────────────────────────
CREATE TABLE departments (
  id                            BIGINT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  location_id                   BIGINT NOT NULL REFERENCES locations(id),
  name                          TEXT NOT NULL,
  created_by_id                 BIGINT,
  created_by_display_name       TEXT NOT NULL DEFAULT 'System',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_by_id            BIGINT,
  last_updated_by_display_name  TEXT NOT NULL DEFAULT 'System',
  last_updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_departments_location ON departments(location_id);


-- ── Hop 3 ──────────────────────────────────────────────────────────────────────────
CREATE TABLE employees (
  id                            BIGINT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  department_id                 BIGINT NOT NULL REFERENCES departments(id),
  full_name                     TEXT NOT NULL,
  email                         TEXT NOT NULL,
  -- Links an employee row to the credential that acts as them. Not a tenancy path and
  -- not an owner column — `user_id`, deliberately, because naming it `owner_id` would
  -- silently make every employee row private to itself — presence of the column is the rule.
  user_id                       BIGINT REFERENCES local_users(id),
  created_by_id                 BIGINT,
  created_by_display_name       TEXT NOT NULL DEFAULT 'System',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_by_id            BIGINT,
  last_updated_by_display_name  TEXT NOT NULL DEFAULT 'System',
  last_updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_employees_department ON employees(department_id);


-- ── Hop 4 — the claim ──────────────────────────────────────────────────────────────
CREATE TABLE timesheets (
  id                            BIGINT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  employee_id                   BIGINT NOT NULL REFERENCES employees(id),
  work_date                     DATE NOT NULL,
  start_at                      TIMESTAMPTZ NOT NULL,
  end_at                        TIMESTAMPTZ NOT NULL,
  hours                         NUMERIC(5,2) NOT NULL,
  status                        TEXT NOT NULL DEFAULT 'draft',
  -- Payroll sees this; the duty manager does not. Removed per-caller in a
  -- `processReturnData.after` hook, so it is ABSENT from the wire, not nulled.
  cost_rate                     NUMERIC(8,2),
  note                          TEXT,
  -- The reserved owner columns. Presence of `owner_id` is the ENTIRE
  -- configuration for Alice's private timesheets — there is no config knob, and no
  -- filtering code anywhere in this repo. `owner_display_name` is stamped at create
  -- and never rewritten by a later rename.
  owner_id                      BIGINT REFERENCES local_users(id),
  owner_display_name            TEXT,
  created_by_id                 BIGINT,
  created_by_display_name       TEXT NOT NULL DEFAULT 'System',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_by_id            BIGINT,
  last_updated_by_display_name  TEXT NOT NULL DEFAULT 'System',
  last_updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_timesheets_employee ON timesheets(employee_id);
CREATE INDEX ix_timesheets_owner ON timesheets(owner_id);


-- ── Hop 3, a different branch — payroll-only resource ──────────────────────────────
CREATE TABLE invoices (
  id                            BIGINT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  department_id                 BIGINT NOT NULL REFERENCES departments(id),
  reference                     TEXT NOT NULL,
  amount                        NUMERIC(10,2) NOT NULL,
  status                        TEXT NOT NULL DEFAULT 'open',
  created_by_id                 BIGINT,
  created_by_display_name       TEXT NOT NULL DEFAULT 'System',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_by_id            BIGINT,
  last_updated_by_display_name  TEXT NOT NULL DEFAULT 'System',
  last_updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_invoices_department ON invoices(department_id);


-- ── Demo event log ─────────────────────────────────────────────────────────────────
-- DEMO-ONLY: a bounded table standing in for an event broker, so `GET /events/recent`
-- can show a visitor what a subscriber would have received. Real deployments publish to
-- something with delivery guarantees, retries and a dead-letter path; this has none of
-- those, and see src/plugins/publisher.ts for why it does not scale.
CREATE TABLE demo_events (
  id                BIGINT PRIMARY KEY DEFAULT nextval('global_id_seq'),
  event_type        TEXT NOT NULL,
  model             TEXT NOT NULL,
  tenant_id         BIGINT,
  object_data       JSONB NOT NULL,
  correlation_id    TEXT,
  emitted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_demo_events_emitted ON demo_events(emitted_at DESC);
