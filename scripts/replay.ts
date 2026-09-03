/**
 * Replays the published challenges — seven reads and the seven-step write sequence —
 * against a live server, asserts every expectation, and writes `TRANSCRIPT.md` from the
 * same pass.
 *
 * ONE script, TWO modes. Bare, it only asserts — that is what `npm run verify` runs, and
 * it leaves the working tree alone. With `--write` it also renders `TRANSCRIPT.md`, which
 * is NOT committed: it ran longer than the application it documents, and `GET /challenges`
 * already names every request and the status it should answer with. Generate it when you
 * want the response bodies; it is gitignored.
 *
 * The transcript is **generated, never maintained** — regenerate it rather than editing
 * it, because a transcript that disagrees with the live demo is worse than no transcript
 * at all. If any assertion fails, nothing is written: a published transcript can never
 * claim an outcome the API did not produce.
 *
 * Keys rotate, so no key is embedded. Every curl block is written against shell
 * variables, with a bootstrap line at the top of the transcript that fetches them from
 * the public `/keys` endpoint — which also teaches the reader that the endpoint exists,
 * in the course of using it.
 *
 * **Nothing here re-approves a row it did not make**, so this is re-runnable — twice
 * against the same database and both pass. The reads consume nothing and the write
 * sequence provisions its own row at step 1. Reseeding is for a clean transcript, not
 * correctness.
 *
 * Run: npm run replay      (assert only)
 *      npm run transcript  (assert, then rewrite TRANSCRIPT.md)
 */

import { writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { buildFramework, createApp } from '../src/server.js';
import {
  READ_CHALLENGES,
  WRITE_SEQUENCE_MORAL,
  WRITE_SEQUENCE_PREMISE,
  WRITE_SEQUENCE_TITLE,
  writeSequence,
  type Step,
} from '../src/demo/challenges.js';
import { PERSONA_DIRECTORY, keyForPersona, type PersonaName } from '../src/demo/keys.js';

const BASE_URL = process.env.DEMO_BASE_URL ?? 'https://timesheetdemo.customapis.co';

/** Writing is opt-in. Every run rewrites the file with fresh timestamps and fresh ids, so a
 *  harness that wrote unconditionally left the tree dirty after every `npm run verify` — and
 *  the deploy refuses a dirty tree, because the image tag is the demo's git SHA. */
const WRITE = process.argv.includes('--write');

/** Persona key → the shell variable the bootstrap line defines for it. */
const SHELL_VAR = new Map<string, string>(
  PERSONA_DIRECTORY.map((p) => [p.persona, `DEMO_${p.persona.toUpperCase()}`]),
);
const NAME_OF = new Map<string, string>(PERSONA_DIRECTORY.map((p) => [p.persona, p.name]));

interface Captured extends Step {
  /** Write-sequence steps only: they are numbered and titled, reads are not. */
  n?: number;
  title?: string;
  status: number;
  responseBody: unknown;
  requestId: string | null;
}

/** A unit of replay: its own captured id, so a `{id}` can never leak between units. The
 *  reads never mint one; the write sequence is the only unit that does. */
interface Run {
  key: string;
  heading: string;
  premise: string;
  steps: Step[];
  moral: string;
}

/** Called once per run, not at import: the sequence stamps today's date into step 1. */
const runs = (): Run[] => [
  ...READ_CHALLENGES.map((c) => ({
    key: c.id,
    heading: `Challenge ${c.number} — ${c.title}`,
    premise: c.premise,
    steps: c.steps,
    moral: c.moral,
  })),
  {
    key: 'write-sequence',
    heading: `The write sequence — ${WRITE_SEQUENCE_TITLE}`,
    premise: WRITE_SEQUENCE_PREMISE,
    steps: writeSequence(),
    moral: WRITE_SEQUENCE_MORAL,
  },
];

const failures: string[] = [];

/** Swap live keys for the shell variable that holds them. Persona NAMES stay: they are what
 *  makes the transcript readable. A key in a published transcript is confusing rather than
 *  harmful — it has expired by the time anyone reads it — but it dates the file. */
function redact(text: string): string {
  let out = text;
  for (const [persona, variable] of SHELL_VAR) {
    out = out.split(keyForPersona(persona as PersonaName)).join(`$${variable}`);
  }
  return out;
}

function pretty(body: unknown): string {
  const json = JSON.stringify(body, null, 2) ?? 'null';
  const capped = json.length > 1400 ? `${json.slice(0, 1400)}\n  … truncated for the page` : json;
  return redact(capped);
}

function curlFor(step: Step, path: string): string {
  const variable = SHELL_VAR.get(step.as);
  const lines = variable
    ? [`curl -sS -H "Authorization: Bearer $${variable}" \\`]
    : ['curl -sS \\'];
  if (step.body) {
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${JSON.stringify(step.body)}' \\`);
  }
  if (step.method !== 'GET') lines.push(`  -X ${step.method} \\`);
  lines.push(`  "${BASE_URL}${path}"`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  const framework = buildFramework();
  await framework.boot();
  const app = createApp(framework);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const captured = new Map<string, Captured[]>();
  const plan = runs();

  try {
    for (const run of plan) {
      const steps: Captured[] = [];
      // Per unit: leaking across them would restore the ordering dependency.
      let capturedId: string | null = null;

      for (const step of run.steps) {
        const path = capturedId === null ? step.path : step.path.replace('{id}', capturedId);
        if (path.includes('{id}')) {
          throw new Error(`${run.key}: ${step.path} has no captured value to fill`);
        }

        const res = await fetch(`${origin}${path}`, {
          method: step.method,
          headers: {
            // `public` means send no credential — the unauthenticated view is a first-class
            // case here, not an error case (challenge 6).
            ...(step.as === 'public'
              ? {}
              : { authorization: `Bearer ${keyForPersona(step.as as PersonaName)}` }),
            ...(step.body ? { 'content-type': 'application/json' } : {}),
          },
          ...(step.body ? { body: JSON.stringify(step.body) } : {}),
        });
        const text = await res.text();
        let parsed: any = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = text;
        }

        const where = `${run.key}: ${step.method} ${path} as ${step.as}`;
        if (res.status !== step.expectStatus) {
          failures.push(`${where} — expected ${step.expectStatus}, got ${res.status}`);
        } else if (step.expectBody) {
          const reason = step.expectBody(parsed?.data ?? parsed);
          if (reason) failures.push(`${where} — ${reason}`);
        }

        if (step.capture && res.status === step.expectStatus) {
          capturedId = step.capture(parsed?.data ?? parsed);
        }

        steps.push({
          ...step,
          path,
          status: res.status,
          responseBody: parsed,
          requestId: res.headers.get('x-api-request-id'),
        });
        process.stdout.write(res.status === step.expectStatus ? '.' : 'F');
      }
      captured.set(run.key, steps);
    }
  } finally {
    await new Promise((r) => server.close(r));
    await framework.flushBackgroundWork();
  }

  process.stdout.write('\n');

  if (failures.length > 0) {
    console.error(
      `\nREPLAY FAILED — ${failures.length} assertion(s). TRANSCRIPT.md NOT written:\n  - ${failures.join('\n  - ')}\n`,
    );
    process.exit(1);
  }

  const steps = [...captured.values()].reduce((n, s) => n + s.length, 0);
  const summary =
    `${READ_CHALLENGES.length} read challenges + a ${captured.get('write-sequence')?.length}-step ` +
    `write sequence, ${steps} requests, all asserted`;

  if (!WRITE) {
    console.log(`${summary}. TRANSCRIPT.md left alone — rerun with \`npm run transcript\` to rewrite it.`);
    return;
  }

  writeFileSync('TRANSCRIPT.md', render(plan, captured), 'utf8');
  console.log(`TRANSCRIPT.md written — ${summary}.`);
}

function render(plan: Run[], captured: Map<string, Captured[]>): string {
  const out: string[] = [];

  out.push('# Captured transcript');
  out.push('');
  out.push(
    '**Generated, not written.** Every request and response below was captured from a real run ' +
      'against the live API by `scripts/replay.ts`, and every outcome was asserted before this file ' +
      'was produced — if one of them had disagreed, this file would not exist. Regenerate it with ' +
      '`npm run transcript` rather than editing it.',
  );
  out.push('');
  out.push('## Start here');
  out.push('');
  out.push(
    'The keys rotate every two hours, so none is written down. Load the current set into your ' +
      'shell — this is also the fastest way to learn that the endpoint exists:',
  );
  out.push('');
  out.push('```bash');
  out.push(`eval "$(curl -sS ${BASE_URL}/keys | jq -r \\`);
  out.push(`  '.data.keys[] | "export DEMO_" + (.persona|ascii_upcase) + "=" + .key')"`);
  out.push('```');
  out.push('');
  out.push('| Persona | Shell variable | Sees |');
  out.push('|---|---|---|');
  for (const p of PERSONA_DIRECTORY) {
    out.push(`| ${p.name} | \`$DEMO_${p.persona.toUpperCase()}\` | ${p.summary} |`);
  }
  out.push('');

  for (const run of plan) {
    out.push(`## ${run.heading}`);
    out.push('');
    out.push(run.premise);
    out.push('');
    for (const step of captured.get(run.key) ?? []) {
      const who = NAME_OF.get(step.as) ?? 'no key at all';
      // The write sequence numbers and titles its steps; a read challenge does not.
      if (step.n) out.push(`### Step ${step.n} — ${step.title}`, '');
      out.push(`**${step.method} ${step.path}** — as ${who} → **${step.status}**`);
      out.push('');
      out.push('```bash');
      out.push(curlFor(step, step.path));
      out.push('```');
      out.push('');
      out.push('```json');
      out.push(pretty(step.responseBody));
      out.push('```');
      out.push('');
      if (step.note) {
        out.push(`> ${step.note}`);
        out.push('');
      }
    }
    out.push(`**What this proves.** ${run.moral}`);
    out.push('');
  }

  return `${out.join('\n')}\n`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
