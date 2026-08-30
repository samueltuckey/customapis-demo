/**
 * Per-caller field visibility for the timesheet resource — the shared declaration EVERY
 * route here applies. A cost rate is sensitive because of what it is, so every endpoint
 * that can put one on the wire owes the caller the same answer; `guarantees.ts` fails if
 * any route on this model omits it.
 *
 * **This whole file is a workaround.** It should be `requires: 'customapis_read_cost_rate'`
 * on the model's `cost_rate` field, applied wherever the framework serializes a row.
 */

import type { RequestContext, TenantScopedRow } from 'pgrm';

/** The permission itself. Derived names are the framework's; this one is app-defined. */
export const COST_RATE = 'customapis_read_cost_rate';

/** Declaring a permission is what puts it in the resolution manifest, the generated docs
 *  and the permission catalog — an undeclared permission is one nobody can grant. */
export const TIMESHEET_PERMISSIONS = [
  { permission: COST_RATE, description: 'See labour cost rates on timesheets' },
] as const;

/** The sentence each route's `description` appends, so the docs say it too. */
export const COST_RATE_NOTE =
  '`costRate` appears only if you can read it — otherwise the field is absent, not null.';

/**
 * The rate is DELETED, not nulled, so a caller cannot tell a hidden rate from an unset one.
 * A hook rather than config, because nothing declarative removes a field per caller.
 *
 * Pass the ROW to `ctx.userCan`: it carries its own `tenantId`, so the question is exact on
 * a page spanning companies. The field is `costRate` — this runs after serialization.
 */
export function hideCostRate(ctx: RequestContext): void {
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
