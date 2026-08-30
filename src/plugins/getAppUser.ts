/**
 * Step two of authentication: **resolve the verified principal**, and decide where they may
 * act. The only place in this application where authorization is decided.
 *
 * The credential is already proven genuine, and the verified subject arrives on
 * `request.identityUser` — so this never reads a header. It answers two questions: which
 * local user is that, and for each permission pgrm asked about, which companies do they
 * hold it in. That resolves once per request; `ctx.userCan` answers from memory after.
 *
 * It does NOT decide whether a row is reachable or know what a permission means. It reports
 * where the caller may act; the framework enforces that down the 4-hop path, under the
 * owner predicate, behind the 403/404 disclosure rule.
 *
 * **In a real deployment the marked line below is a call to your Access Management
 * system.** Here it is a lookup in `personas.json` — the same shape, from a fixture.
 */

import type { GetAppUser, PermissionGrant } from 'pgrm';
import personas from '../demo/personas.json' with { type: 'json' };

/** One persona, exactly as the fixture stores it. */
export interface Persona {
  userId: number;
  displayName: string;
  kind: 'human' | 'machine';
  company: { id: number; name: string };
  /** True when no owner exemption is held, so the caller sees only rows they own. */
  ownerScoped: boolean;
  /** Departments this caller is narrowed to, if any (a `restrictions` entry). */
  departments?: string[];
  /** Permission → the companies it is held in. Absent ⇒ denied everywhere ⇒ 403. */
  grants: Record<string, string[]>;
  /** Presentation only — what `GET /me` publishes. Not an access-management concept. */
  demo: {
    cannot: Array<{ plain: string; why: string; expect: number | string }>;
    tryThis: string[];
  };
}

const PERSONAS = personas as unknown as Record<string, Persona>;

export const getAppUser: GetAppUser = (_ctx, request) => {
  // The subject is the persona name this demo's credentials carry; a real deployment looks
  // up by `(provider, subject)`, creating the local user on first sight if that is policy.
  const subject = request.identityUser?.subject;

  // ── The seam. In production: `await accessManagement.getUserTenants(request.permissionNames)`
  const persona = subject ? PERSONAS[subject] : undefined;
  // ──────────────────────────────────────────────────────────────────────────────────

  // A verified principal with no local user is a real state, not an error. `not_authorised`
  // says which failure this is: the credential verified, there is just no account behind
  // it. Only `unavailable` may serve a stale bundle, so the distinction is load-bearing.
  if (!persona) {
    return { failure: { reason: 'not_authorised', detail: `No persona for subject "${subject}".` } };
  }

  return {
    user: { id: persona.userId, displayName: persona.displayName },
    grants: grantsFor(persona, request.permissionNames),
  };
};

/**
 * Answer only for the permissions pgrm asked about; anything absent is denied. There is no
 * wildcard and no "all tenants" token, so "everywhere" cannot be granted by accident.
 *
 * `restrictions` narrows *within* a company to a subtree of the tenant path. Omitting it
 * means unrestricted; an EMPTY `allowedIds` would mean no records at all.
 */
function grantsFor(persona: Persona, manifest: string[]): PermissionGrant[] {
  const restrictions = persona.departments
    ? [{ modelName: 'departments', allowedIds: persona.departments }]
    : undefined;

  return manifest
    .filter((name) => persona.grants[name]?.length)
    .map((name) => ({
      permission: name,
      grants: persona.grants[name]!.map((tenantId) => ({
        tenantId,
        ...(restrictions ? { restrictions } : {}),
      })),
    }));
}

/** What `GET /me` publishes — from the same fixture the seam answers from, so the endpoint
 *  and the enforcement cannot describe different things. */
export interface PersonaProfile extends Persona {
  readCompanies: number[];
  writeCompanies: number[];
}

const companiesFor = (p: Persona, ops: string[]): number[] =>
  [
    ...new Set(
      Object.entries(p.grants)
        .filter(([name]) => ops.some((op) => name.startsWith(`customapis_${op}_`)))
        .flatMap(([, tenants]) => tenants),
    ),
  ]
    .map(Number)
    .sort((a, b) => a - b);

/** Keyed by local user id, which is what `ctx.user.id` carries. */
export const PERSONA_PROFILES: Readonly<Record<string, PersonaProfile>> = Object.fromEntries(
  Object.values(PERSONAS).map((p) => [
    String(p.userId),
    { ...p, readCompanies: companiesFor(p, ['get', 'search']), writeCompanies: companiesFor(p, ['create', 'update']) },
  ]),
);

/** Persona names, in fixture order. Keys themselves come from `../demo/keys.ts`. */
export const PERSONA_NAMES = Object.keys(PERSONAS);

/** Does this persona hold the permission ANYWHERE? Deliberately coarser than the
 *  request-time check: doc filtering is noise reduction, not the gate. */
export function personaHolds(personaName: string, permission: string): boolean {
  return (PERSONAS[personaName]?.grants[permission]?.length ?? 0) > 0;
}

/** The display name behind a persona, for telling a doc reader whose view they are on. */
export function personaDisplayName(personaName: string): string | undefined {
  return PERSONAS[personaName]?.displayName;
}
