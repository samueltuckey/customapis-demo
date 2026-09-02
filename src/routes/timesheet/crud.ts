/**
 * The uniform timesheet routes — search, get, create.
 *
 * No tenant filter, and no ownership check. A timesheet reaches its company through four
 * derived hops — timesheets → employees → departments → locations → organisations — and
 * the framework walks that path from the foreign keys. Rows are private to their owner
 * because the table has an `owner_id` column, which is the entire configuration.
 *
 * What IS on every route is the shared field-visibility pair from `./fieldVisibility.ts`,
 * the one control this framework cannot derive. Note what ISN'T below.
 */

import { schema, type PgrmFramework, type RequestContext } from 'pgrm';
import { COST_RATE_NOTE, TIMESHEET_PERMISSIONS, hideCostRate } from './fieldVisibility.js';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerTimesheetCrudRoutes(f: PgrmFramework): void {
  // GET /timesheets
  f.route({
    // ── Mandatory — a standard route needs only these two ──────────────────────────
    model: 'timesheets',
    operation: 'search',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    // All fields are filterable until you declare `filters.allow`; then only these are.
    filters: { allow: ['workDate', 'status', 'employeeId'] },
    description: `List the timesheets in your read scope. ${COST_RATE_NOTE}`,
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
    // A create is a committed change, so it leaves a trail like any other. `true` rather
    // than `{ requireUserMessage: true }`: the approve route demands a written reason
    // because approving is a judgement someone should have to justify, and submitting your
    // own hours is not. Without this the page's claim that every write lands in /activity
    // was false for exactly one operation — the one a visitor is most likely to perform.
    audit: true,

    // No `defaultFieldValues` for `status`, deliberately: the column has a database
    // default, so the write schema makes it optional and the DATABASE supplies 'draft'.
    // Declaring it here would send a value on every INSERT, the DB default would never
    // fire, and a later migration changing it would silently do nothing.
    stageSettings: {
      /**
       * What a caller may WRITE is a separate question from what the model HAS; without
       * this block the route carries every nullable column as an optional body field.
       *
       * `costRate` is unreadable to every persona that can create, so it must not be
       * writable either — otherwise a caller sets a rate, never sees it, and is never told.
       * `status` is narrowed rather than dropped: 'draft' or 'submitted' is a legitimate
       * choice, but 'approved' belongs to `POST /timesheets/:id/approve`, which alone
       * requires the permission, a written reason and a submitted starting state.
       */
      validate: {
        removeProperties: ['costRate'],
        overrideProperties: { status: schema.enumOf('draft', 'submitted') },
      },
      operation: { after: emitCreated },
      processReturnData: { after: hideCostRate },
    },
    consultedPermissions: [...TIMESHEET_PERMISSIONS],
  });
}

// ── Code ───────────────────────────────────────────────────────────────────────────

/**
 * The domain event for a submission, emitted in-transaction and drained after commit, so
 * a subscriber never sees a timesheet that rolled back.
 *
 * The payload is deliberate rather than the whole row. `costRate` is permission-gated on
 * every read, and the demo's socket is an unauthenticated broadcast — publishing the row
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
