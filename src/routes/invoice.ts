/**
 * The invoice resource — payroll-only, and the demonstration that resource access is a
 * permission rather than a filter.
 *
 * The duty manager holds no `customapis_*_invoice` permission, so these routes return
 * **403** — decided from one `can()` call before any row is loaded. It is the demo's only
 * refusal of a whole RESOURCE: he is not told a particular invoice is out of reach, he is
 * told invoices are. The other two 403s — the employee and payroll approving — refuse an
 * operation on a resource they can otherwise read, which is a different shape of no.
 */

import type { PgrmFramework } from 'pgrm';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerInvoiceRoutes(f: PgrmFramework): void {
  f.route({
    // ── Mandatory — a standard route needs only these two ──────────────────────────
    model: 'invoices',
    operation: 'search',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    filters: { allow: ['departmentId', 'status'] },
  });

  // Mandatory config only — there is no optional half. This is the whole route.
  f.route({ model: 'invoices', operation: 'get' });
}
