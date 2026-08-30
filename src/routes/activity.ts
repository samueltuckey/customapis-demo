/**
 * `GET /activity` — the audit trail, as an ordinary search route.
 *
 * This file is the whole audit API: no bespoke handler, no hand-written tenant filter, no
 * pagination code, no OpenAPI wiring. `audit_log` is a framework-shipped MODEL, so a route
 * on it inherits everything a route on `timesheet` inherits — **the audit API is not a
 * special case**. The framework registers its tenant path at assembly, so a caller sees
 * their own company's trail whether or not the author thought about it.
 */

import type { PgrmFramework } from 'pgrm';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerActivityRoutes(f: PgrmFramework): void {
  f.route({
    // ── Mandatory — a standard route needs only these two ──────────────────────────
    model: 'pgrm_audit_log',
    operation: 'search',

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    // `path` is a CHOICE here: the derived one would be `/pgrm-audit-log`, which names
    // the framework's table rather than the thing a reader came for.
    path: '/activity',
    // The derived name would be `customapis_search_pgrm_audit_log` — an implementation
    // detail leaking into a permission an administrator has to grant. Pinned instead.
    requiredPermissions: ['customapis_read_activity'],
    description:
      'Every committed change in your company, newest first: who, what, when, the ' +
      'field-level diff, and the written reason where one was required.',
    // Default-deny. `changes`, `context` and the message fields stay unfilterable —
    // JSONB predicates and text search are unindexable at any scale — but are still
    // RETURNED, which is what the diff and the approval reason need.
    filters: { allow: ['entityType', 'entityId', 'action', 'actorId', 'correlationId'] },
  });
}
