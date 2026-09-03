/**
 * `GET /me` — the orientation endpoint, and the first thing an agent hits.
 *
 * `operation: 'custom'` still runs log → body-size → userCheck → authorize, so it cannot
 * skip authentication. What it skips is response shaping: a custom route has no model, so
 * **this file emits camelCase by hand** rather than answering in a different convention
 * to every other endpoint.
 *
 * The `cannot` array is how an agent knows what to *attempt*, and `expect` pre-commits the
 * server to an outcome the caller can verify. The harness asserts every one against a real
 * response, or the demo could be caught lying by the mechanism meant to prove its honesty.
 *
 * `tryThis` carries the same `expect`, and leads with a call that SUCCEEDS: a suggestion
 * list that is all refusals reads as a broken key rather than as a working boundary.
 */

import type { PgrmFramework, RequestContext } from 'pgrm';
import { PERSONA_PROFILES, type PersonaProfile } from '../plugins/getAppUser.js';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerMeRoutes(f: PgrmFramework): void {
  f.route({
    // ── Mandatory — `custom` has no canonical method or path, so both are declared ──
    //               (a standard operation derives both from the model) ─────────────
    operation: 'custom',
    method: 'GET',
    path: '/me',
    handler: whoAmI,

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    // No permission of its own: any valid credential may ask who it is. Authentication
    // still ran — 'none' means "no permission check", never "no auth".
    requiredPermissions: 'none',
    description: 'Who this key is, what it can reach, and what it will be refused.',
  });
}

// ── Code ───────────────────────────────────────────────────────────────────────────

/** Plain language for the derived permission names. The names are part of the pitch — you
 *  never write them — so they are shown as well as translated, never renamed to be pretty. */
const PLAIN: Readonly<Record<string, string>> = {
  customapis_get_timesheets: 'Read a timesheet by id',
  customapis_search_timesheets: 'List timesheets',
  customapis_create_timesheets: 'Submit a new timesheet',
  customapis_update_timesheets: 'Approve a timesheet',
  customapis_admin_timesheets: "See other people's timesheets, not just your own",
  customapis_read_cost_rate: 'See labour cost rates',
  customapis_get_employees: 'Read an employee by id',
  customapis_search_employees: 'List employees',
  customapis_get_invoices: 'Read an invoice by id',
  customapis_search_invoices: 'List invoices',
  customapis_read_activity: "Read your company's audit trail",
};

function whoAmI(ctx: RequestContext): void {
  const profile = PERSONA_PROFILES[String(ctx.user?.id ?? '')];
  if (!profile) {
    ctx.error('unauthenticated', 'Not authenticated.');
    return;
  }

  ctx.response = {
    identity: { name: profile.displayName, kind: profile.kind, actorId: profile.userId },
    company: profile.company,
    scope: {
      companies: profile.readCompanies,
      writeCompanies: profile.writeCompanies,
      // Read scope and write scope are SEPARATE axes, and every writable grant in this
      // demo points at the shared sandbox — never at the curated companies.
      writes:
        profile.writeCompanies.length > 0
          ? `your writes land only in the shared Scratch Sandbox (company ` +
            `${profile.writeCompanies.join(', ')}); the curated companies are read-only, ` +
            `so a write there is a 404`
          : 'read-only: this key holds no write permission in any company',
      // `POST /timesheets` needs an `employeeId` inside the write scope, and the sandbox
      // has exactly one worker — so name it here rather than make every caller search.
      ...(profile.demo.writeEmployeeId !== undefined
        ? { writeEmployeeId: profile.demo.writeEmployeeId }
        : {}),
      departments: profile.departments
        ? [...profile.departments]
        : 'all departments in your companies',
      rows: profile.ownerScoped
        ? 'owner-scoped: you see only timesheets you own'
        : 'you see every timesheet within your scope, not just your own',
    },
    can: Object.keys(profile.grants)
      .sort()
      .map((permission) => ({ permission, plain: PLAIN[permission] ?? permission })),
    cannot: profile.demo.cannot.map((c) => ({ ...c })),
    tryThis: [...profile.demo.tryThis],
  };
}

export type { PersonaProfile };
