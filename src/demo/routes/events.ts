/**
 * `GET /events/recent` — what a subscriber would have received. The partner persona asks
 * "can I react to things happening in your system without polling you?", and this answers
 * it with the events that actually fired, emitted by the same `ctx.emit` the route makes.
 *
 * DEMO-ONLY: a REST endpoint over a bounded table is not how anyone consumes events. It
 * exists so a visitor with only a browser can see the stream. See `../publisher.ts` for
 * why the transport behind it does not scale.
 */

import type { PgrmFramework, RequestContext } from 'pgrm';
import { readRecentEvents } from '../../plugins/publisher.js';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerEventRoutes(f: PgrmFramework): void {
  f.route({
    // ── Mandatory — `custom` has no canonical method or path, so both are declared ──
    //               (a standard operation derives both from the model) ─────────────
    operation: 'custom',
    method: 'GET',
    path: '/events/recent',
    handler: recentEvents,

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    authenticate: false,
    requiredPermissions: 'none',
    description: 'The most recent domain events, newest first. Public, like the sandbox.',
  });
}

// ── Code ───────────────────────────────────────────────────────────────────────────

async function recentEvents(ctx: RequestContext): Promise<void> {
  const rows = await readRecentEvents(50);

  ctx.response = {
    // DEMO-ONLY: unscoped. Every visitor sees every company's events, because the
    // sandbox is shared and the keys are public. A real event API is scoped to the
    // subscriber, exactly as every other route here is scoped to the caller.
    events: rows.map((r) => ({ ...r, tenantId: r.tenantId === null ? null : String(r.tenantId) })),
    note: 'Emitted after commit. A rolled-back transaction never appears here.',
  };
}
