/**
 * Key rotation, and the grace window.
 *
 * Keys rotate together every two hours on **clock-aligned** boundaries, so every visitor,
 * node and captured transcript agrees on where the boundary is. They are **derived**, not
 * stored — HMAC(secret, persona:windowIndex) — so there is no table, no issuance, no
 * cleanup, and any number of nodes compute the same set without coordinating.
 *
 * **The grace window is the part not to skip.** For 15 minutes after a boundary the
 * previous window's keys still resolve, because an agent working through the challenges
 * can straddle a rotation, and a 401 halfway through reads as "the API is broken".
 *
 * Rotation buys something real but partial: a scraped key dies within hours. It cannot
 * stop a determined caller — `/keys` is public by design — so **rate limiting is the
 * control that has to hold**.
 *
 * DEMO-ONLY: the secret is in the source and the keys are served to anyone who asks. The
 * point being demonstrated is expiry, not secrecy.
 */

import { createHmac } from 'node:crypto';

const WINDOW_MS = 2 * 60 * 60 * 1000;
const GRACE_MS = 15 * 60 * 1000;

/** DEMO-ONLY: published in source, deliberately. Rotating a public key set is the
 *  demonstration; hiding the secret would not make the keys any less public. */
const SECRET = process.env.DEMO_KEY_SECRET ?? 'customapis-demo-not-a-real-secret';

export interface KeyWindow {
  started: string;
  expires: string;
  secondsRemaining: number;
  /** Whole 2-hour windows since the epoch. */
  index: number;
}

export function currentWindow(now: Date = new Date()): KeyWindow {
  const index = Math.floor(now.getTime() / WINDOW_MS);
  const started = index * WINDOW_MS;
  const expires = started + WINDOW_MS;
  return {
    started: new Date(started).toISOString(),
    expires: new Date(expires).toISOString(),
    secondsRemaining: Math.round((expires - now.getTime()) / 1000),
    index,
  };
}

/** Persona → the stable prefix its key carries, so a key is legible at a glance. */
export const PERSONA_DIRECTORY = [
  {
    persona: 'employee',
    prefix: 'emp',
    name: 'Alice Nguyen',
    summary: 'Sees only the timesheets she owns',
  },
  {
    persona: 'duty_manager',
    prefix: 'duty',
    name: 'Sam Okafor',
    summary: "Sees everyone's timesheets in Company A; approvals land in the shared sandbox",
  },
  {
    persona: 'department_manager',
    prefix: 'dept',
    name: 'Tomas Ferreira',
    summary: "Sees everyone's timesheets, but only in Front of House",
  },
  {
    persona: 'payroll',
    prefix: 'payroll',
    name: 'Priya Raman',
    summary: 'Everything in Company A, including cost rates and invoices',
  },
  {
    persona: 'kestrel_payroll',
    prefix: 'kestrel',
    name: 'Omar Haddad',
    summary: 'Everything in Company B, and nothing at all from Company A',
  },
] as const;

export type PersonaName = (typeof PERSONA_DIRECTORY)[number]['persona'];

function keyFor(persona: string, prefix: string, windowIndex: number): string {
  const digest = createHmac('sha256', SECRET)
    .update(`${persona}:${windowIndex}`)
    .digest('base64url')
    .slice(0, 22);
  return `demo_${prefix}_${digest}`;
}

/** The key set for a window — defaults to the current one. */
export function keysFor(windowIndex: number = currentWindow().index) {
  return PERSONA_DIRECTORY.map((p) => ({
    persona: p.persona,
    name: p.name,
    summary: p.summary,
    key: keyFor(p.persona, p.prefix, windowIndex),
  }));
}

/** The current key for one persona. The harnesses derive keys exactly as a visitor does;
 *  a hardcoded key is one that stops working at the next boundary. */
export function keyForPersona(persona: PersonaName): string {
  return keysFor().find((k) => k.persona === persona)!.key;
}

/** Shape of a demo key, used to tell "not one of ours" from "one of ours, but wrong". */
const KEY_SHAPE = /^demo_[a-z]+_[A-Za-z0-9_-]{22}$/;

/**
 * Verify a presented credential, and say precisely why it failed.
 *
 * The taxonomy lets an operator tell a broken refresh loop (`expired`) from someone
 * guessing keys (`invalid_signature`) from a caller pointed at the wrong API
 * (`malformed`); undifferentiated 401 counts cannot say which fire is burning. The
 * framework logs the reason and still answers with a uniform 401 — except `expired`,
 * which is safe to disclose and tells an agent to re-fetch `/keys`.
 */
export function verifyKey(
  presented: string | null,
  now: Date = new Date(),
): { persona: PersonaName } | { reason: VerifyFailure; detail: string } {
  if (!presented) return { reason: 'no_credential', detail: 'no Authorization header' };
  if (!KEY_SHAPE.test(presented)) {
    return { reason: 'malformed', detail: 'not shaped like a demo key' };
  }

  const window = currentWindow(now);
  const withinGrace = now.getTime() - window.index * WINDOW_MS < GRACE_MS;

  if (keysFor(window.index).some((k) => k.key === presented)) {
    return { persona: personaOf(presented, window.index) };
  }
  if (withinGrace && keysFor(window.index - 1).some((k) => k.key === presented)) {
    return { persona: personaOf(presented, window.index - 1) };
  }

  // Well-formed, not current, outside the grace. If it came from a recent window it has
  // simply expired, which is worth saying: the fix is one request.
  for (let back = 1; back <= 12; back += 1) {
    if (keysFor(window.index - back).some((k) => k.key === presented)) {
      return { reason: 'expired', detail: `key from window -${back}` };
    }
  }
  return { reason: 'invalid_signature', detail: 'no window derives this key' };
}

export type VerifyFailure = 'no_credential' | 'malformed' | 'expired' | 'invalid_signature';

function personaOf(key: string, windowIndex: number): PersonaName {
  return keysFor(windowIndex).find((k) => k.key === key)!.persona as PersonaName;
}

/** Exposed so `/keys` can tell a caller how long the overlap lasts. */
export const GRACE_SECONDS = GRACE_MS / 1000;
