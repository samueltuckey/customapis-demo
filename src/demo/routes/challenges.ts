/**
 * `GET /challenges` — the ten published challenges, as data an agent can execute.
 *
 * Visitors are handed a prompt saying "work through the ten challenges", and the ten
 * existed only inside `TRANSCRIPT.md` — a captured run, not a worklist — so every agent
 * invented its own and none ran the intended evaluation.
 *
 * It serves the SAME array `scripts/replay.ts` asserts, so a challenge published here
 * that the API does not honour fails the run before it can reach a reader.
 *
 * DEMO-ONLY: an API does not normally ship its own exercises.
 */

import type { PgrmFramework, RequestContext } from 'pgrm';
import { CHALLENGES } from '../challenges.js';

// ── Routes ─────────────────────────────────────────────────────────────────────────
export function registerChallengeRoutes(f: PgrmFramework): void {
  f.route({
    // ── Mandatory — `custom` has no canonical method or path, so both are declared ──
    //               (a standard operation derives both from the model) ─────────────
    operation: 'custom',
    method: 'GET',
    path: '/challenges',
    handler: listChallenges,

    // ── Optional — every line below is a CHOICE, not a requirement ─────────────────
    authenticate: false,
    requiredPermissions: 'none',
    description: 'The ten challenges this demo publishes, in order. Public, like `/keys`.',
  });
}

// ── Code ───────────────────────────────────────────────────────────────────────────

function listChallenges(ctx: RequestContext): void {
  ctx.response = {
    count: CHALLENGES.length,
    howToRun:
      'Get a key per persona from `GET /keys` and send it as `Authorization: Bearer <key>`; ' +
      '`as: "public"` means send no credential at all. Run each challenge in order — a ' +
      '`{id}` in a path is the id returned by the step above marked `capturesId`.',
    challenges: CHALLENGES.map((challenge, index) => ({
      // The number the visitor prompt counts to. `id` is the stable anchor and skips —
      // challenge 4 of 10 is id `3b`, because renumbering would break every deep link.
      number: index + 1,
      id: challenge.id,
      title: challenge.title,
      premise: challenge.premise,
      steps: challenge.steps.map((step) => ({
        as: step.as,
        method: step.method,
        path: step.path,
        ...(step.body ? { body: step.body } : {}),
        expectStatus: step.expectStatus,
        ...(step.capture ? { capturesId: true } : {}),
        ...(step.note ? { note: step.note } : {}),
      })),
      moral: challenge.moral,
    })),
  };
}
