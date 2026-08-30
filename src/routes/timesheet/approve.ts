/**
 * `POST /timesheets/:id/approve` — a named business action.
 *
 * No "command" concept and no bespoke handler: an ordinary `update` route on a custom path,
 * so it inherits the entire pipeline — the row loaded under `FOR UPDATE` in a transaction,
 * tenant-scoped down the 4-hop path, owner predicate applied, audited on commit, event
 * drained only after. The demo wrote `approveGuard`, about ten lines; what it did not write
 * is everything that makes that rule safe to run concurrently.
 *
 * It also inherits the resource's field visibility: an `update` returns the row, so it is
 * as much a disclosure surface as a GET.
 */

import type { PgrmFramework, RequestContext } from 'pgrm';
import { COST_RATE_NOTE, TIMESHEET_PERMISSIONS, hideCostRate } from './fieldVisibility.js';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerApproveRoutes(f: PgrmFramework): void {
  f.route({
    // ── Mandatory ──────────────────────────────────────────────────────────────────
    model: 'timesheets',
    operation: 'update',
    // `method` + `path` join them here ONLY because this is a named action: an `update`
    // would otherwise derive `PATCH /timesheets/:id`, which is not the endpoint wanted.
    method: 'POST',
    path: '/timesheets/:id/approve',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    // A custom guard is invisible to the OpenAPI generator, so the rule has to be described
    // or no integrator — and no agent — will know it exists.
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
      operation: { before: approveGuard, after: emitApproved },
      // The same field-visibility hook every other route on this model carries. An update
      // returns the row, so it discloses exactly what a read discloses.
      processReturnData: { after: hideCostRate },
    },
    consultedPermissions: [...TIMESHEET_PERMISSIONS],
  });
}

// ── Code ───────────────────────────────────────────────────────────────────────────

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
 * The domain event, emitted in-transaction and drained AFTER commit, so a subscriber never
 * sees `timesheet.approved` for a transaction that rolled back. `events: true` would
 * announce `timesheet.updated` — true and useless, since the partner subscribes to an
 * approval, not a column changing.
 *
 * The payload is deliberate rather than the whole row: a domain event is a contract with a
 * subscriber who cannot see your schema, and the partner is not allowed employee PII.
 */
function emitApproved(ctx: RequestContext): void {
  ctx.emit('timesheet.approved', {
    timesheetId: String(ctx.params.id),
    approvedBy: ctx.user ? String(ctx.user.displayName) : 'System',
    approvedAt: new Date().toISOString(),
  });
}
