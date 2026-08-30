/**
 * The employee resource — three hops from the tenant root.
 *
 * Nothing here is about tenancy, and that is the point: `employee` reaches the company
 * through departments → locations → organisations, derived from the foreign keys. It
 * differs from `timesheet` only in having no `owner_id`, so rows are not private per user.
 */

import type { PgrmFramework } from 'pgrm';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerEmployeeRoutes(f: PgrmFramework): void {
  f.route({
    // ── Mandatory — a standard route needs only these two ──────────────────────────
    model: 'employees',
    operation: 'search',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    filters: { allow: ['departmentId', 'fullName'] },
  });

  // Mandatory config only — there is no optional half. This is the whole route.
  f.route({ model: 'employees', operation: 'get' });
}
