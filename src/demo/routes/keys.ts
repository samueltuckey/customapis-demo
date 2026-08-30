/**
 * `GET /keys` — public, unauthenticated, the current key set. Step one of every
 * walkthrough: anything an agent has to negotiate for, it will not reach.
 *
 * `authenticate: false` is the ONLY way to make a route public — `requiredPermissions:
 * 'none'` alone just drops the permission gate for callers who already authenticated.
 *
 * DEMO-ONLY: serving live credentials to anyone who asks. Real keys are issued per tenant,
 * stored hashed, and never returned by an API — these are public *because* the demo is the
 * sandbox, and they rotate so a scraped one dies on its own.
 */

import type { PgrmFramework, RequestContext } from 'pgrm';
import { keysFor, currentWindow, GRACE_SECONDS } from '../keys.js';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerKeyRoutes(f: PgrmFramework): void {
  f.route({
    // ── Mandatory — `custom` has no canonical method or path, so both are declared ──
    //               (a standard operation derives both from the model) ─────────────
    operation: 'custom',
    method: 'GET',
    path: '/keys',
    handler: listKeys,

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    authenticate: false,
    requiredPermissions: 'none',
    description: 'The current demo key set. Public by design — start here.',
  });
}

// ── Code ───────────────────────────────────────────────────────────────────────────

function listKeys(ctx: RequestContext): void {
  // One `now` for every field below. A caller derives the offset between its clock and
  // ours from these, so two of them computed a millisecond apart would be a bug.
  const now = new Date();
  const window = currentWindow(now);
  ctx.response = {
    /** The server's clock. Also on every response as the `date` header, which CORS exposes. */
    serverTime: now.toISOString(),
    window: {
      started: window.started,
      expires: window.expires,
      secondsRemaining: window.secondsRemaining,
    },
    keys: keysFor().map((k) => ({
      persona: k.persona,
      name: k.name,
      key: k.key,
      summary: k.summary,
    })),
    graceSeconds: GRACE_SECONDS,
    note:
      'Keys rotate every 2 hours, on clock-aligned boundaries. The previous set keeps ' +
      'working for 15 minutes past a boundary, so a walkthrough that straddles one does ' +
      'not break. Fetch this endpoint again if you get a 401. Companies A and B are ' +
      'curated, read-only data: every write lands in the shared Scratch Sandbox ' +
      '(company 3), so a write against A or B is a 404 by design.',
  };
}
