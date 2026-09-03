/**
 * `GET /challenges` — a starting point for an agent testing this API.
 *
 * Each entry is a request to make, the status it should answer with, and the context to
 * read it by, so an agent can work the API without inventing its own exercises.
 *
 * It serves the SAME two sets `scripts/replay.ts` asserts, so a challenge published here
 * that the API does not honour fails the run before it can reach a reader.
 *
 * Reads and the write sequence are separate keys because they carry different contracts:
 * reads are order-free and endlessly repeatable, writes are ordered and stay repeatable
 * because step 1 mints the row the rest act on.
 *
 * DEMO-ONLY: an API does not normally ship its own exercises.
 */

import type { PgrmFramework, RequestContext } from 'pgrm';
import {
  READ_CHALLENGES,
  WRITE_SEQUENCE_MORAL,
  WRITE_SEQUENCE_PREMISE,
  WRITE_SEQUENCE_TITLE,
  writeSequence,
  type Step,
} from '../challenges.js';

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
    description:
      'Seven read challenges and a seven-step write sequence, with the status to expect ' +
      'at every step. Public, like `/keys`.',
  });
}

// ── Code ───────────────────────────────────────────────────────────────────────────

/** The wire shape of a step: the assertion closures stay behind, the expectation ships. */
const publish = (step: Step) => ({
  as: step.as,
  method: step.method,
  path: step.path,
  ...(step.body ? { body: step.body } : {}),
  expectStatus: step.expectStatus,
  ...(step.capture ? { capturesId: true } : {}),
  ...(step.note ? { note: step.note } : {}),
});

function listChallenges(ctx: RequestContext): void {
  // Once per request: it stamps today's date into step 1, and two calls could straddle
  // midnight UTC and publish a sequence whose count and steps disagreed.
  const sequence = writeSequence();

  ctx.response = {
    howToRun:
      'Get a key per persona from `GET /keys` and send it as `Authorization: Bearer <key>`; ' +
      '`as: "public"` means send no credential at all. The seven under `reads` are ' +
      'independent — run them in any order, as often as you like, nothing is consumed. The ' +
      'seven under `writeSequence` are one ordered run: step 1 creates a timesheet and ' +
      'returns its id, and every later `{id}` is that id. Never substitute a fixed id there ' +
      '— a row approves once, so a hardcoded one works for exactly one run.',
    reads: {
      count: READ_CHALLENGES.length,
      order: 'any — no challenge depends on another, and none of them writes',
      repeatable:
        'always. Every step is a read, so the seventh run answers exactly like the first, ' +
        'and two visitors running at once cannot disturb each other.',
      challenges: READ_CHALLENGES.map((challenge) => ({
        // `id` is the `/demo` page anchor and `number` is what a reader counts. They skip:
        // challenge 4 of 7 is `3b`, because renumbering would break every published link.
        id: challenge.id,
        number: challenge.number,
        title: challenge.title,
        premise: challenge.premise,
        steps: challenge.steps.map(publish),
        moral: challenge.moral,
      })),
    },
    writeSequence: {
      count: sequence.length,
      title: WRITE_SEQUENCE_TITLE,
      order: 'as numbered — step n depends on the row step 1 made',
      repeatable:
        'always, and that is the point. Step 1 mints a fresh timesheet and every later step ' +
        'threads that id, so nothing here re-approves a row somebody already approved. The ' +
        'only fixed id in the sequence (1041, at step 4) is a refusal and consumes no state.',
      provisioning: 'step 1 — `POST /timesheets` returns the `{id}` steps 2, 3, 5, 6 and 7 use',
      premise: WRITE_SEQUENCE_PREMISE,
      steps: sequence.map((step) => ({
        n: step.n,
        title: step.title,
        ...publish(step),
      })),
      moral: WRITE_SEQUENCE_MORAL,
    },
  };
}
