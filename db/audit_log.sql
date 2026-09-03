-- pgrm framework infrastructure — the default audit sink table (§10.5),
-- `simple` storage profile (audit-search-and-retention spec §4.1 — the DEFAULT).
--
-- pgrm owns no application tables; this is one of at most two optional infra tables.
-- Apply it with whatever migration tooling you use (Liquibase / Flyway / psql / …)
-- BEFORE boot() in production. In development, ensureInfraTables() creates it for you
-- via Sequelize sync() — so pre-applying this is a no-op there. If you supply a custom
-- `audit.sink`, this table is not used at all.
--
-- Shape is canonical and must match the framework's AuditEntry (§10.1): append-only,
-- polymorphic (entity_type, entity_id) with NO foreign key to the entity (§10.5).
--
-- THE ENVELOPE IS IDENTICAL IN BOTH STORAGE PROFILES (spec §3.3) — same columns, same
-- PK, same indexes, same clock. `simple` → `partitioned` is therefore a pure storage
-- migration with no backfill, no API change and no sink change (spec §4.1). The
-- partitioned form is `npx pgrm db sql audit_log_partitioned`.

CREATE TABLE IF NOT EXISTS audit_log (
  id                  BIGSERIAL     NOT NULL,
  tenant_id           BIGINT,                    -- record-derived; null for non-tenanted (§7.2)
  -- The record's tenant resolved to the app's TOP declared tenancy level (spec §3.3).
  -- In single-level tenancy it simply equals tenant_id; in multi-level tenancy it is the
  -- top-level ancestor. ALWAYS populated (null only for non-tenanted models) so both
  -- profiles stay byte-identical and the upgrade is a dumb copy. It is the LIST
  -- partition key in the `partitioned` profile, and the pruning predicate the shipped
  -- search route emits unconditionally (spec §5.2).
  partition_value BIGINT,
  entity_type         TEXT          NOT NULL,    -- model name; keyed WITH entity_id (§14.1)
  entity_id           BIGINT        NOT NULL,
  action              TEXT          NOT NULL,    -- create | update | delete | override
  actor_id            BIGINT,                    -- null for system/non-user actions (§16.3)
  actor_display_name  TEXT          NOT NULL,    -- always populated (person or system descriptor)
  changes             JSONB         NOT NULL,    -- { field: { from, to } } diff (§10.1)
  system_message      TEXT          NOT NULL,
  user_message        TEXT,                      -- the request-supplied "why", if any
  -- The correlation pair (correlation spec §2). Two ids, NOT interchangeable:
  --   correlation_id        SERVER-generated — ctx.requestId, returned as the
  --                         `x-api-request-id` response header. Always present and
  --                         framework-minted, so it is the key everything else
  --                         correlates on: the same value appears on this request's log
  --                         lines and on any events it emitted.
  --   user_agent_request_id CLIENT-supplied — the caller's `x-ua-request-id`
  --                         header. UNTRUSTED (a caller may repeat, forge or omit it,
  --                         and an invalid one is dropped), so it never replaces the
  --                         server id. Recorded because a support pivot usually STARTS
  --                         from the caller's own id, and audit outlives log retention.
  correlation_id        TEXT        NOT NULL,
  user_agent_request_id TEXT,
  context             JSONB         NOT NULL,    -- enrich() extras
  -- DB clock, not the app clock (spec §3.3): created_at is the sort key (and, in the
  -- partitioned profile, a partition key), and multiple app instances' clocks disagree
  -- enough to reorder adjacent entries. The app-clock timestamp remains available in
  -- `context` when the sink is configured to record it.
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Composite key (spec §3.2) — the AUDIT-ONLY exception to the §14.1 single-bigint-PK
  -- invariant. Postgres requires every partition-key column in any PK/unique
  -- constraint, and the envelope is identical in both profiles, so the `simple` table
  -- carries the same key. `id` remains the LOGICAL identifier (one sequence, globally
  -- unique in practice, serialized as the row's id and filterable on search); nothing
  -- in the pipeline addresses an audit row by key (there is no GET-by-id route, and the
  -- shipped posture declares no mutating routes — spec §5, §6).
  --
  -- UNIQUE, NOT PRIMARY KEY, and this is forced rather than chosen: Postgres makes
  -- every PRIMARY KEY column NOT NULL, which would contradict two things this same
  -- design requires — `partition_value` is NULL for non-tenanted models (spec §3.3),
  -- and the `partitioned` profile gives those rows their own `FOR VALUES IN (NULL)`
  -- partition (spec §4.2). A UNIQUE constraint satisfies Postgres's
  -- "partition key must appear in every unique constraint" rule while still admitting
  -- NULL. Uniqueness of `id` alone is guaranteed by the sequence, so nothing is lost.
  CONSTRAINT audit_log_key UNIQUE (id, partition_value, created_at)
);

-- The shipped search route's index prefix (spec §3.3, §5.1): every query is
-- exactly-one tenant + a required entity_type + a bounded created_at window.
CREATE INDEX IF NOT EXISTS audit_log_tenant_entity_created_idx
  ON audit_log (tenant_id, entity_type, created_at DESC);

-- Record history — "full history of this record", the most common audit question and
-- the one query exempt from the 90-day window cap (spec §5.1).
CREATE INDEX IF NOT EXISTS audit_log_record_history_idx
  ON audit_log (tenant_id, entity_type, entity_id, created_at DESC);

-- Support pivot ("everything that happened in request X") — on by default (spec §3.3):
-- the second-most-common audit query, and the write tax is small.
CREATE INDEX IF NOT EXISTS audit_log_correlation_idx
  ON audit_log (correlation_id);

-- `user_agent_request_id` is deliberately NOT indexed by default. It is null for most
-- rows (most callers send no id), and the shipped search route always constrains
-- tenant + entity_type + a bounded window, so a pivot within that prefix is already
-- cheap. If your callers reliably send one and you pivot on it across the whole table,
-- add the partial index — it stays small because it skips every null row:
--
--   CREATE INDEX CONCURRENTLY audit_log_user_agent_request_idx
--     ON audit_log (user_agent_request_id) WHERE user_agent_request_id IS NOT NULL;

-- Immutability is a GRANT, not a promise (spec §6, §10.6 as reworded): the recommended
-- deployment gives the app DB role INSERT + SELECT only, so even a client-declared
-- update/delete route fails at the DB. Enabling mutation is then two explicit acts —
-- declare the route AND widen the grant.
--
--   GRANT SELECT, INSERT ON audit_log TO <app_role>;
--   GRANT USAGE, SELECT  ON SEQUENCE audit_log_id_seq TO <app_role>;
--   REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM <app_role>;
