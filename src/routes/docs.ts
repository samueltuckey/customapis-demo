/**
 * `/openapi.json`, `/docs.md` and `/llms.txt` — the API describing itself.
 *
 * None of this is written by hand. All three are projections of the same route registry
 * that serves the requests, generated per request, so they cannot drift. Field names come
 * through the same name map the pipeline uses, docs included — which is what makes a
 * generated client match the API it was generated from.
 *
 * Express handlers rather than pgrm routes, for the same reason `/health` is: an OpenAPI
 * document wrapped in `{ data, meta }` is not one any tool will read.
 *
 * ── The trap this file exists to avoid ──────────────────────────────────────────────
 * pgrm filters docs by viewer, and no viewer means only *open* routes — a valid 200 with
 * `paths: {}`, which reads as an API with no endpoints. So an unauthenticated fetch here
 * returns the **unfiltered** spec and says so; adding a key narrows it to what that key
 * can call. Both views tell the reader how to get the other one.
 */

import type { RequestHandler } from 'express';
import { generateOpenApi, generateHumanDocs, type DocViewer, type PgrmFramework } from 'pgrm';
import { verifyKey } from '../demo/keys.js';
import { personaHolds, personaDisplayName, PERSONA_PROFILES } from '../plugins/getAppUser.js';

const TITLE = 'Custom APIs — timesheet demo';
const APP = 'customapis';

/** An "everything" viewer. NOT the same as passing no viewer, which means the PUBLIC
 *  projection — open routes only. An empty `DocViewer` means "sees everything". */
const UNFILTERED: DocViewer = {};

/** Who is asking, if they said. Accepts `?key=` as well as a bearer header, because a
 *  browser address bar cannot send headers and these pages are meant to be opened. */
function viewerFor(req: { query?: Record<string, unknown>; headers?: Record<string, unknown> }): {
  viewer: DocViewer;
  persona?: string;
} {
  const fromQuery = typeof req.query?.key === 'string' ? req.query.key : null;
  const auth = req.headers?.['authorization'];
  const fromHeader =
    typeof auth === 'string' ? (/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1] ?? null) : null;

  const presented = fromQuery ?? fromHeader;
  if (!presented) return { viewer: UNFILTERED };

  const result = verifyKey(presented);
  // An unusable key falls back to the public view rather than an error: these pages are
  // discovery, and a 401 from the documentation is a dead end for whoever is exploring.
  if ('reason' in result) return { viewer: UNFILTERED };

  return {
    viewer: { holds: (permission) => personaHolds(result.persona, permission) },
    persona: result.persona,
  };
}

function howToNarrow(persona: string | undefined): string {
  if (persona) {
    const name = personaDisplayName(persona) ?? persona;
    return (
      `You are seeing the view for ${name} (\`${persona}\`): only the routes this key can ` +
      `actually call. Routes it cannot call are omitted entirely — a consumer cannot be ` +
      `tempted by an endpoint it would be refused. Drop the \`?key=\` parameter to see the ` +
      `full public surface instead.`
    );
  }
  return (
    'You are seeing the PUBLIC view: every route this API exposes, whether or not you ' +
    'could call it. To see **your own** documentation — only the routes your key can ' +
    'call — append `?key=<your key>` to this URL, or send it as a bearer token. Get a ' +
    'key from `GET /keys`; it is public and needs no signup. The two views are worth ' +
    'diffing: what disappears is what that key is not allowed to do.'
  );
}

/**
 * The hand-written routes, described by hand. Declared routes document themselves; a raw
 * handler is described through `customFragments` and merges into the same spec. `/me`
 * matters most — it is where the docs send an agent first.
 */
const CUSTOM_ROUTES: Record<string, Record<string, any>> = {
  '/me': {
    get: {
      summary: 'Who this key is, what it can reach, and what it will be refused',
      description:
        'The `cannot` array is a pre-commitment: each entry names an outcome and the ' +
        'status code to expect. Attempt them — that is what the demo is for.',
      responses: { '200': { description: 'Identity, scope, permissions, and refusals to expect' } },
    },
  },
  '/challenges': {
    get: {
      summary: 'Seven read challenges and a seven-step write sequence. Public',
      description:
        'Each step names the persona, the method, the path, the body where there is one, ' +
        'and the status to expect. The reads are repeatable in any order; the write ' +
        'sequence is ordered and mints its own row at step 1, so it is repeatable too. ' +
        'This is the walkthrough the demo is scored on.',
      security: [],
      responses: {
        '200': { description: '`reads` and `writeSequence`, each step with its expected status' },
      },
    },
  },
  '/keys': {
    get: {
      summary: 'The current demo key set. Public — start here',
      description:
        'Keys rotate every two hours on clock-aligned boundaries; the previous set keeps ' +
        'working for 15 minutes past one. No signup, no credential required.',
      security: [],
      responses: { '200': { description: 'The current window and one key per persona' } },
    },
  },
  '/events/recent': {
    get: {
      summary: 'Recent domain events — what a subscriber would have received',
      description: 'Emitted after commit. A rolled-back transaction never appears here.',
      security: [],
      responses: { '200': { description: 'The most recent events, newest first' } },
    },
  },
};

export function openApiDoc(framework: PgrmFramework): RequestHandler {
  return (req, res) => {
    const { routes, runtime } = framework.getRegistry();
    const { viewer, persona } = viewerFor(req);
    // No filtering here and no securityScheme override: visibility now resolves the
    // auto-derived permission names at boot (`resolvedPermissions`), and the scheme's
    // description is projected from `auth.credential` + `auth.howToObtain` — declared
    // once in `createFramework`, so this projection and docs.md cannot disagree.
    const doc = generateOpenApi([...routes], runtime, {
      title: TITLE,
      viewer,
      description: `${howToNarrow(persona)}\n\nGenerated from the live route registry on every request.`,
      // Declared routes document themselves; raw handlers are described here and merged
      // into the same spec. `/me` is the first route an agent reads, so it matters that
      // it lands in the document.
      customFragments: CUSTOM_ROUTES,
    });
    res.type('application/json').send(JSON.stringify(doc, null, 2));
  };
}

export function humanDocs(framework: PgrmFramework): RequestHandler {
  return (req, res) => {
    const { routes, runtime } = framework.getRegistry();
    const { viewer, persona } = viewerFor(req);
    const bundle = generateHumanDocs([...routes], runtime, { title: TITLE, viewer });
    res.type('text/markdown').send(renderMarkdown(bundle, persona));
  };
}

/** `/llms.txt` — the convention that tells an agent where the good stuff is. */
export function llmsTxt(baseUrl: () => string): RequestHandler {
  return (_req, res) => {
    const base = baseUrl();
    res.type('text/plain').send(
      `# Custom APIs — timesheet demo

> A live multi-tenant timesheet API. Keys are public, rotate every two hours, and need no
> signup. Every persona sees a different slice of the same data, and the interesting
> outcomes are the refusals.

## Start here
- ${base}/keys        Public. The current key set. Fetch this first.
- ${base}/me          Who your key is, what it can reach, and what it will be REFUSED.
- ${base}/challenges  Public. Seven reads and a seven-step write sequence — see below.
- ${base}/docs.md     Full documentation. Add ?key=<your key> to see only your own routes.

## Auth
Every API call needs \`Authorization: Bearer <key>\` — any key from /keys, no signup.
Keys rotate every two hours; the previous set works for 15 minutes past a boundary.

## The challenges, and why they are two sets
\`reads\` — seven challenges, ids challenge-1 … challenge-6 (challenge-3b sits between 3
and 4 and is never renumbered). Nothing is consumed, so run them in any order, as often
as you like, alongside anyone else doing the same.
\`writeSequence\` — seven steps, in order. Step 1 POSTs a timesheet and returns its id;
every later {id} is that id. It is repeatable for exactly that reason: a timesheet
approves once, so nothing here re-approves a row it did not make. Do not swap in a fixed
id — that works for one run and 409s forever after.

## Read scope is not write scope
The curated companies (Harbourline, Kestrel) are read-only for EVERY key. Each key's
write permissions point only at the shared Scratch Sandbox (company 3). A write against
curated data is a 404 by design — the refusal does not admit the row exists.

## Machine-readable
- ${base}/openapi.json            Every route this API exposes.
- ${base}/openapi.json?key=<key>  Only the routes that key can call. Diff them.

## Try to break it
The demo is built so the interesting result is a refusal. Fetch a colleague's timesheet, a
different department's, a different company's, and one that never existed — all four
return an identical 404. You are meant to attempt this; nothing here is real data.
`,
    );
  };
}

/**
 * What the access management system says this deployment grants: which permissions, at
 * which tenants. Here that answer is a fixture — `personas.json`, delivered by the
 * `getAppUser` plugin — and the same one the pipeline enforces from, so this table cannot
 * drift from what a key can actually do: a grant change reshapes it on the next request.
 */
function deploymentSection(): string[] {
  const personaRows = Object.values(PERSONA_PROFILES).map((p) => {
    const reads = p.readCompanies.join(', ') || '—';
    const writes = p.writeCompanies.join(', ') || '— (read-only)';
    return `| ${p.displayName} | ${p.company.name} | ${reads} | ${writes} |`;
  });
  return [
    '## This deployment',
    '',
    'Three companies share this API, and **read scope and write scope are separate axes** — holding',
    'a permission somewhere does not say where you hold it:',
    '',
    '- **Company 1 — Harbourline Hospitality** and **Company 2 — Kestrel Facilities Group**: curated',
    '  demo data, **read-only for every key**. A write against them is a 404 by permission — the',
    '  refusal does not admit the row exists, and it is not a bug.',
    '- **Company 3 — Scratch Sandbox**: the only writable company, shared by every visitor. Nothing',
    '  written there is precious — writes and approvals are meant to be attempted, and the whole',
    '  database rebuilds daily at 04:00 UTC. The published write sequence provisions the row it',
    '  acts on, so it never depends on what another visitor did. Entries in `GET /activity` can',
    '  outlive the rows they describe — a 404 on one of them means the rebuild has been through,',
    '  not that you were refused.',
    '',
    '| Key | Home company | Reads companies | Writes companies |',
    '|---|---|---|---|',
    ...personaRows,
    '',
    'So the duty manager can *see* every Harbourline timesheet but can *approve* only sandbox ones —',
    'try both; `GET /me` pre-commits each key to its refusals.',
    '',
  ];
}

function renderMarkdown(bundle: ReturnType<typeof generateHumanDocs>, persona?: string): string {
  const { layer0, layer1, layer2 } = bundle;
  const out: string[] = [
    `# ${layer0.title}`,
    '',
    howToNarrow(persona),
    '',
    '## The challenges',
    '',
    '`GET /challenges` serves them as data — persona, request, body and expected status for',
    'every step. Public, no key needed. Start there if you were told to work through them.',
    '',
    '- **Seven reads** (`reads`, ids `challenge-1` … `challenge-6`, with `challenge-3b` between',
    '  3 and 4). No state is consumed, so run them in any order and as often as you like.',
    '- **A seven-step write sequence** (`writeSequence`), in order. Step 1 creates a timesheet',
    '  and returns its id; every later `{id}` is that id. That is what makes the writes',
    '  repeatable — a timesheet approves exactly once, so a step naming a fixed id would pass',
    '  for the first visitor and 409 for everyone after.',
    '',
    ...deploymentSection(),
  ];

  // The header contract: how to authenticate — projected from
  // `auth.credential`, the same value openapi.json derives its scheme from — plus
  // every request/response header a caller must know.
  out.push('## Headers', '', layer0.headers.auth, '');
  if (layer0.headers.request.length > 0) {
    out.push('| Request header | When | Meaning |', '|---|---|---|');
    for (const h of layer0.headers.request) out.push(`| \`${h.name}\` | ${h.requirement} | ${h.note} |`);
    out.push('');
  }
  if (layer0.headers.response.length > 0) {
    out.push('| Response header | When | Meaning |', '|---|---|---|');
    for (const h of layer0.headers.response) out.push(`| \`${h.name}\` | ${h.requirement} | ${h.note} |`);
    out.push('');
  }

  out.push('## Conventions', '');
  for (const line of layer0.conventions) out.push(`- ${line}`);
  out.push('', '## Errors', '', '| Status | Code | Meaning |', '|---|---|---|');
  for (const e of layer0.errorCodes) out.push(`| ${e.status} | \`${e.code}\` | ${e.meaning} |`);
  out.push('', `> ${layer0.disclosureRule}`, '');

  out.push('## Entities', '', '| Entity | Tenant scoping | |', '|---|---|---|');
  for (const e of layer0.entityMap) {
    out.push(`| \`${e.entity}\` | ${e.tenantScoping} | ${e.line} |`);
  }
  if (layer0.relationships.length > 0) {
    out.push('', '### Relationships', '');
    for (const r of layer0.relationships) out.push(`- ${r}`);
  }

  out.push('', '## Routes', '', '| | Route | What it does |', '|---|---|---|');
  for (const entry of layer1) {
    const owner = entry.ownerScoped ? ' *(owner-scoped — results are per-caller)*' : '';
    // SEARCH is a logical verb that mounts as HTTP GET — say so, or an agent that takes
    // the column literally issues a real SEARCH verb and misreads the 404.
    const verb =
      entry.method === entry.httpMethod
        ? `\`${entry.method}\``
        : `\`${entry.method}\` (HTTP \`${entry.httpMethod}\`)`;
    out.push(`| ${verb} | \`${entry.path}\` | ${entry.summary}${owner} |`);
  }
  out.push('');

  for (const entry of layer1) {
    const detail = layer2[entry.id];
    if (!detail) continue;
    out.push(`### \`${detail.method} ${detail.path}\``, '', detail.purpose, '');
    out.push(`Permission: \`${detail.permission}\``, '');
    if (detail.filterableFields?.length) {
      out.push('| Filter | Operators |', '|---|---|');
      for (const f of detail.filterableFields) {
        out.push(`| \`${f.field}\` | ${f.operators.join(', ')} |`);
      }
      out.push('');
    }
    out.push('<details><summary>Full detail</summary>', '', '```json',
             JSON.stringify(detail, null, 2), '```', '', '</details>', '');
  }

  return `${out.join('\n')}\n`;
}
