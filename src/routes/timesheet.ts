/**
 * The timesheet resource — four routes on one model, and the only code they needed.
 *
 * No tenant filter, and no ownership check. A timesheet reaches its company through four
 * derived hops — timesheets → employees → departments → locations → organisations — and
 * the framework walks that path from the foreign keys. Rows are private to their owner
 * because the table has an `owner_id` column, which is the entire configuration.
 *
 * What IS here is the app's own policy: who may see a cost rate, and who may approve. The
 * framework takes both as written — any field, any rule you can express — and derived
 * everything around them.
 */

import { schema, type PgrmFramework, type RequestContext, type TenantScopedRow } from 'pgrm';

/* ── Field visibility ───────────────────────────────────────────────────────────────
 *
 * The shared declaration EVERY route below applies. A cost rate is sensitive because of
 * what it is, so every endpoint that can put one on the wire owes the caller the same
 * answer; co-location is legibility, not enforcement — the deploy check is what fails if
 * a route on this model omits it.

 */

/** The permission itself. Derived names are the framework's; this one is app-defined. */
const COST_RATE = 'customapis_read_cost_rate';

/** Declaring a permission is what puts it in the resolution manifest, the generated docs
 *  and the permission catalog — an undeclared permission is one nobody can grant. */
const TIMESHEET_PERMISSIONS = [
  { permission: COST_RATE, description: 'See labour cost rates on timesheets' },
] as const;

/** The sentence each route's `description` appends, so the docs say it too. */
const COST_RATE_NOTE =
  '`costRate` appears only if you can read it — otherwise the field is absent, not null.';


// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerTimesheetRoutes(f: PgrmFramework): void {
  // GET /timesheets
  f.route({
    // ── Mandatory — a standard route needs only these two ──────────────────────────
    model: 'timesheets',
    operation: 'search',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    // All fields are filterable until you declare `filters.allow`; then only these are.
    filters: { allow: ['workDate', 'status', 'employeeId'] },
    // remove costRate sorting, so as not to leak any cost rate data.
    sort: { deny: ['costRate'] },
    description: `List the timesheets in your read scope. ${COST_RATE_NOTE}`,
    // add cost rate permission here for visibility in docs
    consultedPermissions: [...TIMESHEET_PERMISSIONS],
    stageSettings: { processReturnData: { after: hideCostRate } },
  });

  // GET /timesheets/:id
  f.route({
    // ── Mandatory — a standard route needs only these two ──────────────────────────
    model: 'timesheets',
    operation: 'get',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    description: `One timesheet by id. ${COST_RATE_NOTE}`,
    consultedPermissions: [...TIMESHEET_PERMISSIONS],
    stageSettings: { processReturnData: { after: hideCostRate } },
  });

  // Writes land in the scratch company only — enforced by the scope on
  // `customapis_create_timesheets` in the identity seam, not by anything here. `owner_id`
  // is stripped from the writable schema and stamped from the credential.
  // POST /timesheets
  f.route({
    // ── Mandatory — a standard route needs only these two ──────────────────────────
    model: 'timesheets',
    operation: 'create',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    description:
      'Submit a timesheet. The `employeeId` must be in your write scope — the Scratch ' +
      'Sandbox here — or you get a 404; `GET /me` names one your key can use. ' +
      `${COST_RATE_NOTE}`,
    // `'guaranteed'` writes the entry in the same transaction, so it is readable when the
    // 201 lands; the default here would buffer it past the response. No reason demanded —
    // approving is a judgement to justify, submitting your own hours is not.
    audit: { durability: 'guaranteed' },

    // No `defaultFieldValues` for `status`, deliberately: the column has a database
    // default, so the write schema makes it optional and the DATABASE supplies 'draft'.
    // Declaring it here would send a value on every INSERT, the DB default would never
    // fire, and a later migration changing it would silently do nothing.
    stageSettings: {
      // Without this the route accepts every nullable column. `costRate` is unreadable to
      // everyone who can create, so it must not be writable either; `approved` is narrowed
      // out because it belongs to the approve route and the reason it demands.
      validate: {
        removeProperties: ['costRate'],
        overrideProperties: { status: schema.enumOf('draft', 'submitted') },
      },
      operation: { after: emitCreated },
      processReturnData: { after: hideCostRate },
    },
    consultedPermissions: [...TIMESHEET_PERMISSIONS],
  });

  // POST /timesheets/:id/approve — a named business action.
  //
  // A customised update on the timesheet, so it inherits the whole pipeline: the row
  // loaded FOR UPDATE in a transaction, tenant-scoped down the four-hop path, owner
  // predicate applied, audited on commit, event drained after. Two hooks on the operation
  // stage add what this business action needs — `approveGuard` for the state rule, and
  // `emitApproved` for a custom event.
  f.route({
    // ── Mandatory ──────────────────────────────────────────────────────────────────
    model: 'timesheets',
    operation: 'update',
    // `method` + `path` join them here ONLY because this is a named action: an `update`
    // would otherwise derive `PATCH /timesheets/:id`, which is not the endpoint wanted.
    method: 'POST',
    path: '/timesheets/:id/approve',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    // Describe the custom action for the docs - openapi, llm etc.
    description:
      'Approve a submitted timesheet. Needs a written reason in `auditMessage`, which lands ' +
      'in the audit trail. Approving twice is a 409; approving outside your write scope — ' +
      `the Scratch Sandbox here — is a 404. ${COST_RATE_NOTE}`,
    // One config line, and approval cannot happen without a reason — which lands in the
    // audit row as `userMessage`.
    audit: { requireUserMessage: true },
    stageSettings: {
      // Everything but `auditMessage` is stripped: an approval must not double as an edit.
      validate: {
        removeProperties: ['status', 'costRate', 'hours', 'note', 'workDate', 'startAt', 'endAt'],
      },
      // hooks for custom business logic - only approve once
      operation: { before: approveGuard, after: emitApproved },
      // hide constRate if you done have permission
      processReturnData: { after: hideCostRate },
    },
    consultedPermissions: [...TIMESHEET_PERMISSIONS],
  });
}

// ── Code ───────────────────────────────────────────────────────────────────────────

/**
 * The rate is DELETED, not nulled, so a caller cannot tell a hidden rate from an unset one.
 * Addressed in a hook — the framework gives us total control over how this route behaves.
 * Who may see a rate is the app's rule, the same kind `approveGuard` states for approval.
 *
 * Pass the ROW to `ctx.userCan`: it carries its own `tenantId`, so the question is exact on
 * a page spanning companies. The field is `costRate` — this runs after serialization.
 */
function hideCostRate(ctx: RequestContext): void {
  for (const row of rowsOf(ctx.response)) {
    if (!ctx.userCan(COST_RATE, row)) delete row['costRate'];
  }
}

/** A serialized row carrying its stamped `tenantId`, which is what makes it a legal
 *  `ctx.userCan` subject. */
function rowsOf(data: unknown): TenantScopedRow[] {
  if (Array.isArray(data)) return data as TenantScopedRow[];
  if (data && typeof data === 'object') return [data as TenantScopedRow];
  return [];
}

/**
 * The business rule. Runs INSIDE the transaction with the row already locked, so two
 * concurrent approvals of the same timesheet cannot both pass this check. `ctx.error`
 * raises a typed status into the same envelope as every framework refusal.
 */
function approveGuard(ctx: RequestContext): void {
  const current = ctx.originalRecord as { status?: string } | undefined;
  const status = current?.status;

  if (status === 'approved') {
    ctx.error('conflict', 'This timesheet has already been approved.');
  }
  if (status !== 'submitted') {
    ctx.error(
      'unprocessable_entity',
      `A timesheet can only be approved from "submitted"; this one is "${status}".`,
    );
  }
  ctx.body.status = 'approved';
}

/**
 * The domain event for a submission, emitted in-transaction and drained after commit, so a
 * subscriber never sees a timesheet that rolled back.
 *
 * The payload is deliberate rather than the whole row: `costRate` is permission-gated on
 * every read and the demo's socket is an unauthenticated broadcast, so publishing the row
 * would put a field hidden from most callers onto a public wire.
 */
function emitCreated(ctx: RequestContext): void {
  const row = ctx.record as Record<string, unknown> | undefined;
  ctx.emit('timesheet.created', {
    timesheetId: String(row?.['id'] ?? ''),
    employeeId: String(row?.['employee_id'] ?? ''),
    workDate: String(row?.['work_date'] ?? ''),
    hours: String(row?.['hours'] ?? ''),
    status: String(row?.['status'] ?? ''),
    submittedBy: ctx.user ? String(ctx.user.displayName) : 'System',
  });
}

/**
 * The same in-transaction contract, for an approval. `events: true` would announce
 * `timesheet.updated` — true and useless, since the partner subscribes to an approval,
 * not a column changing.
 *
 * The payload is deliberate here for a second reason: a domain event is a contract with a
 * subscriber who cannot see your schema, and the partner is not allowed employee PII.
 */
function emitApproved(ctx: RequestContext): void {
  ctx.emit('timesheet.approved', {
    timesheetId: String(ctx.params.id),
    approvedBy: ctx.user ? String(ctx.user.displayName) : 'System',
    approvedAt: new Date().toISOString(),
  });
}
