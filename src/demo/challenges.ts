/**
 * The published challenges, as data: seven reads and one seven-step write sequence.
 *
 * DEMO-ONLY: an API does not normally ship its own exercises.
 *
 * ONE definition, TWO consumers: `scripts/replay.ts` runs both sets against a live server
 * and asserts every expectation; `routes/challenges.ts` serves them at `GET /challenges`,
 * so the walkthrough a visitor is told to work through is the one the harness proves. A
 * challenge the API does not honour fails the run before it can reach a reader.
 *
 * ── Why the two sets are shaped differently ─────────────────────────────────────────
 * A read consumes nothing, so the seven below are repeatable in any order by any number
 * of visitors at once. A write cannot be: a timesheet approves exactly once, so a write
 * challenge naming a fixed id passes for whoever reaches it first and 409s for everyone
 * after — and for the same visitor on a second run. The sequence therefore MINTS its row
 * at step 1 and threads that `{id}` through the six steps below it. The one fixed id it
 * names is a refusal, which consumes no state.
 *
 * These are the `/demo` page's two sections, ids and numbers verbatim, so an agent can
 * match a payload entry to the anchor a reader was linked to.
 *
 * It lives here rather than in `scripts/` because it is served: `src/routes/` still
 * imports nothing from the harness, and `src/demo/` is where the demo's own scaffolding
 * belongs. It is excluded from the application line count for the same reason.
 */

import type { JsonObject } from 'pgrm';

export interface Step {
  /** Persona NAME, as published by `GET /keys` — never a key. Keys rotate every two
   *  hours, so a harness that hardcodes one stops working at the next boundary; the
   *  runner resolves the current key at send time, exactly as a visitor does. */
  as: string;
  method: 'GET' | 'POST';
  path: string;
  body?: JsonObject;
  /** What the reader should notice. Rendered under the response. */
  note?: string;
  expectStatus: number;
  /** Extra assertion on the parsed body. Return a reason string on failure. */
  expectBody?: (data: any) => string | null;
  /** Take a value from this step's response; later paths substitute it for `{id}`. */
  capture?: (data: any) => string;
}

export interface ReadChallenge {
  /** The `/demo` page anchor, verbatim. Published marketing copy deep-links `#challenge-N`
   *  on its own schedule, so an id is never renumbered — `3b` was inserted between 3 and 4
   *  rather than shifting four ids and breaking every live link. */
  id: string;
  /** What the page shows and a visitor counts: `1`…`6`, with `3b` between 3 and 4. */
  number: string;
  title: string;
  premise: string;
  steps: Step[];
  moral: string;
}

export interface WriteStep extends Step {
  /** Position. The sequence is ORDERED: step 1 mints the id every `{id}` here resolves to. */
  n: number;
  title: string;
}

const idsOf = (data: any): string[] =>
  (Array.isArray(data) ? data : []).map((r: any) => String(r.id)).sort();

const pathsOf = (d: any): string[] => Object.keys(d?.paths ?? {}).sort();

// ── Set 1 — the reads. No state consumed, so order does not matter and neither does ──
//            how many times you run them ─────────────────────────────────────────────

export const READ_CHALLENGES: ReadChallenge[] = [
  {
    id: 'challenge-1',
    number: '1',
    title: 'Who am I?',
    premise:
      'Every key answers the same question differently. `/me` reports the identity, the companies ' +
      'in scope, the permissions held — and, unusually, what the key will be **refused**.',
    steps: [
      {
        as: 'employee',
        method: 'GET',
        path: '/me',
        expectStatus: 200,
        expectBody: (d) =>
          d?.identity?.name === 'Alice Nguyen' ? null : `identity was ${d?.identity?.name}`,
        note: 'The `cannot` array is a pre-commitment. Everything in it is attempted below.',
      },
      {
        as: 'department_manager',
        method: 'GET',
        path: '/me',
        expectStatus: 200,
        expectBody: (d) =>
          Array.isArray(d?.scope?.departments) ? null : 'expected a restricted department list',
        note: 'The department manager reports a narrowed scope; every other persona reports "all departments".',
      },
    ],
    moral:
      'The server publishes its own limits. An agent reads `cannot` to know what to attempt, which ' +
      'is how this demo generates refusals instead of role-play.',
  },
  {
    id: 'challenge-2',
    number: '2',
    title: "Same search request, different results for each user's access",
    premise:
      'One unchanged request — `GET /timesheets` — sent by three keys in the same company.',
    steps: [
      {
        as: 'employee',
        method: 'GET',
        path: '/timesheets',
        expectStatus: 200,
        // The property, not a set of ids: visitors' rows persist in the shared sandbox.
        expectBody: (d) => {
          const list = Array.isArray(d) ? d : [];
          if (!idsOf(d).includes('1041')) return `missing her own row: ${JSON.stringify(idsOf(d))}`;
          const notHers = list.filter((r: any) => r.ownerDisplayName !== 'Alice Nguyen');
          return notHers.length === 0
            ? null
            : `saw rows she does not own: ${JSON.stringify(notHers.map((r: any) => String(r.id)))}`;
        },
        note: 'Alice: only rows she owns — however many the sandbox has accumulated.',
      },
      {
        as: 'duty_manager',
        method: 'GET',
        path: '/timesheets',
        expectStatus: 200,
        // 1041 is Alice's, 1042 is Ben's, 1045 is the Kitchen: owner and department both.
        expectBody: (d) => {
          const ids = idsOf(d);
          const missing = ['1041', '1042', '1045'].filter((id) => !ids.includes(id));
          return missing.length === 0 ? null : `cannot see ${missing.join(', ')}`;
        },
        note: "Sam: everyone's, across every department.",
      },
      {
        as: 'payroll',
        method: 'GET',
        path: '/timesheets',
        expectStatus: 200,
        expectBody: (d) => {
          const ids = idsOf(d);
          const missing = ['1041', '1042', '1045'].filter((id) => !ids.includes(id));
          if (missing.length > 0) return `cannot see ${missing.join(', ')}`;
          return (Array.isArray(d) ? d : []).every((r: any) => 'costRate' in r)
            ? null
            : 'expected costRate on every row';
        },
        note: 'Payroll: the same rows as Sam, plus `costRate`.',
      },
    ],
    // Not "Alice and Sam differ by one permission": they differ by two. Only one of them
    // changes this endpoint — the other is what lets Sam approve.
    moral:
      'On this endpoint the whole difference is one permission: `customapis_admin_timesheets` is ' +
      'what turns "your timesheets" into everyone\'s. Sam holds one other that Alice does not — ' +
      '`customapis_update_timesheets` — and it only matters when he approves something. Neither ' +
      'the route nor the query changed, and no filtering code exists in the application.',
  },
  {
    id: 'challenge-3',
    number: '3',
    title: "Reach your colleague's row",
    premise:
      'Alice and Ben are in the same company and the same department. Only `owner_id` separates ' +
      'their timesheets.',
    steps: [
      {
        as: 'employee',
        method: 'GET',
        path: '/timesheets/1042',
        expectStatus: 404,
        note: "Alice has read permission. The row simply isn't hers.",
      },
      {
        as: 'duty_manager',
        method: 'GET',
        path: '/timesheets/1042',
        expectStatus: 200,
        note: 'The same id, one permission later.',
      },
    ],
    moral:
      'Row privacy is the presence of an `owner_id` column. There is no configuration for it and no ' +
      'code in this repo that reads it.',
  },
  {
    id: 'challenge-3b',
    number: '3b',
    title: 'Reach the next department',
    premise:
      'Tomas manages Front of House. The Kitchen is a sibling department — same company, same ' +
      'location, one step across. (Numbered `3b` because it was added after the others: the ' +
      'anchors are deep-linked from published copy, and renumbering would silently break them.)',
    steps: [
      {
        as: 'department_manager',
        method: 'GET',
        path: '/timesheets/1041',
        expectStatus: 200,
        note: 'Front of House: fine.',
      },
      {
        as: 'department_manager',
        method: 'GET',
        path: '/timesheets/1045',
        expectStatus: 404,
        note: 'The Kitchen: nothing. Same company, same location.',
      },
      {
        as: 'duty_manager',
        method: 'GET',
        path: '/timesheets/1045',
        expectStatus: 200,
        note: 'Sam, who holds no department restriction, reads it.',
      },
    ],
    moral:
      'The restriction names a department, but `timesheet` has no department column — its ' +
      'department is two joins away, on the path to the company. The scope narrowed in the middle ' +
      'of a relational path that the framework derived.',
  },
  {
    id: 'challenge-4',
    number: '4',
    title: 'Field visibility',
    premise: 'The same record, fetched by two keys in the same company.',
    steps: [
      {
        as: 'payroll',
        method: 'GET',
        path: '/timesheets/1041',
        expectStatus: 200,
        expectBody: (d) => ('costRate' in (d ?? {}) ? null : 'costRate missing for payroll'),
        note: 'Payroll sees `costRate`.',
      },
      {
        as: 'duty_manager',
        method: 'GET',
        path: '/timesheets/1041',
        expectStatus: 200,
        expectBody: (d) => (!('costRate' in (d ?? {})) ? null : 'costRate leaked to the duty manager'),
        note: 'Sam does not. Compare the two bodies: the field is **absent**, not null.',
      },
    ],
    moral:
      'A hidden field and an unset field are indistinguishable on the wire, so the absence itself ' +
      'discloses nothing.',
  },
  {
    id: 'challenge-5',
    number: '5',
    title: 'Cross-company',
    premise: 'Timesheet 1041 belongs to Harbourline. Ids come from one global sequence, so it ' +
      'belongs to exactly one company in the whole deployment.',
    steps: [
      {
        as: 'payroll',
        method: 'GET',
        path: '/timesheets/1041',
        expectStatus: 200,
        note: 'Harbourline payroll: the record.',
      },
      {
        as: 'kestrel_payroll',
        method: 'GET',
        path: '/timesheets/1041',
        expectStatus: 404,
        note: 'Kestrel payroll: nothing. Identical permissions, different company.',
      },
      {
        as: 'kestrel_payroll',
        method: 'GET',
        path: '/timesheets/1043',
        expectStatus: 200,
        note: 'The key works. The row was the problem.',
      },
    ],
    moral:
      'The id is valid and the row exists. You cannot tell either of those things from the ' +
      'response — and a timesheet reaches its company through four derived joins, not a tenant ' +
      'column.',
  },
  {
    id: 'challenge-6',
    number: '6',
    title: 'Read the documentation your key can see',
    premise:
      'The API documents itself, generated from the same route registry that serves the ' +
      'requests — so it cannot drift. What it shows you depends on who is asking.',
    steps: [
      {
        as: 'public',
        method: 'GET',
        path: '/openapi.json',
        expectStatus: 200,
        expectBody: (d) =>
          pathsOf(d).includes('/invoices') && pathsOf(d).includes('/timesheets/{id}/approve')
            ? null
            : `public spec was missing routes: ${pathsOf(d).join(' ')}`,
        note:
          'No credential. The **full** surface — every route this API exposes. Note that ' +
          'this is deliberate: a permission-filtered spec fetched without a key returns an ' +
          'empty document, and a real evaluator once concluded the API had no endpoints.',
      },
      {
        as: 'employee',
        method: 'GET',
        path: '/openapi.json',
        expectStatus: 200,
        expectBody: (d) => {
          const p = pathsOf(d);
          if (p.includes('/invoices')) return 'Alice was shown invoices she cannot read';
          if (p.includes('/timesheets/{id}/approve')) return 'Alice was shown the approve route';
          return null;
        },
        note: "Alice's view. No invoices, no approve — she holds neither permission.",
      },
      {
        as: 'payroll',
        method: 'GET',
        path: '/openapi.json',
        expectStatus: 200,
        expectBody: (d) => {
          const p = pathsOf(d);
          if (!p.includes('/invoices')) return 'payroll was denied its invoice routes';
          if (p.includes('/timesheets/{id}/approve')) return 'payroll was shown the approve route';
          return null;
        },
        note: 'Payroll gets invoices back and still no approve. Diff the three.',
      },
    ],
    moral:
      'A consumer cannot be tempted by an endpoint it would be refused, because it never ' +
      'sees one. The docs are a projection of the same permissions the pipeline enforces — ' +
      'and `?key=` is how any caller gets their own copy.',
  },
];

// ── Set 2 — the write sequence. Ordered, and repeatable BECAUSE it is ordered: ────────
//            step 1 makes the row the other six act on ───────────────────────────────

export const WRITE_SEQUENCE_TITLE = 'Do the write, on a row you make';

export const WRITE_SEQUENCE_PREMISE =
  'Seven steps in order, against **a row step 1 creates for you**. Approval is a real write — in ' +
  'a transaction, on a locked row, audited on commit, and it demands a written reason — and it ' +
  'can happen to a row exactly once. So the sequence provisions its own row rather than naming ' +
  'one: every visitor gets the same seven statuses, however many times they run it, and nobody ' +
  'has to reseed anything first.';

export const WRITE_SEQUENCE_MORAL =
  'The application supplied about ten lines of rule. The transaction, the lock, the audit row and ' +
  'the required reason came from the route declaration. The two refusals differ on purpose: ' +
  '**403 means the permission is missing, 404 means everything else** — not yours, not your ' +
  'department, not your company, never existed. All of those are the same response, so the ' +
  'boundary cannot be mapped by probing it.';

/** Today, UTC. The `/demo` page ships a literal `{today}` token because it prerenders to
 *  static HTML; a live API has no such excuse, so the published body carries a real date a
 *  reader can paste unchanged. */
const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Built per call, so step 1's `workDate` is never stale. Both consumers call this, which is
 * what keeps the sequence the API publishes identical to the one the harness asserts.
 */
export function writeSequence(): WriteStep[] {
  const day = today();
  return [
    {
      n: 1,
      title: 'Make a row of your own',
      as: 'employee',
      method: 'POST',
      path: '/timesheets',
      // 81 is the sandbox worker. `status` is load-bearing: the column defaults to
      // 'draft' and the approve guard 422s a draft, so step 5 fails without it.
      body: {
        employeeId: 81,
        workDate: day,
        startAt: `${day}T07:00:00Z`,
        endAt: `${day}T15:00:00Z`,
        hours: 8,
        status: 'submitted',
        note: 'Shift I am about to have approved',
      },
      expectStatus: 201,
      expectBody: (d) => (d?.id ? null : 'create returned no id'),
      capture: (d) => String(d.id),
      note:
        'Your own row, in the Scratch Sandbox — the only company any key can write to. ' +
        '`ownerId` is stamped by the server from the caller, so you cannot claim to be ' +
        'someone else by sending it. **Every step below uses the id this returns.**',
    },
    {
      n: 2,
      title: 'Approve it as the person who wrote it',
      as: 'employee',
      method: 'POST',
      path: '/timesheets/{id}/approve',
      body: { auditMessage: 'looks fine to me' },
      expectStatus: 403,
      note:
        'The only 403 in the demo. Alice holds no approve permission at all, so the refusal ' +
        'is decided before any row is loaded — it is about her, not about the row.',
    },
    {
      n: 3,
      title: 'Approve it without saying why',
      as: 'duty_manager',
      method: 'POST',
      path: '/timesheets/{id}/approve',
      body: {},
      expectStatus: 400,
      note:
        'A written reason is not optional, and it is not application code — one line of route ' +
        'config makes it mandatory.',
    },
    {
      // Harbourline is Sam's OWN company — read scope and write scope are separate axes.
      n: 4,
      title: 'Approve a row you can only read',
      as: 'duty_manager',
      method: 'POST',
      path: '/timesheets/1041/approve',
      body: { auditMessage: 'Approving a Harbourline row.' },
      expectStatus: 404,
      note:
        'Timesheet 1041 is in Harbourline — **Sam\'s own company**, and he reads it fine in ' +
        'challenge 4. The curated companies are read-only for every key, so the write is ' +
        'refused. Note the 404, not a 403: the refusal does not admit the row exists.',
    },
    {
      n: 5,
      title: 'Approve it properly',
      as: 'duty_manager',
      method: 'POST',
      path: '/timesheets/{id}/approve',
      body: { auditMessage: 'Checked against the roster; hours match.' },
      expectStatus: 200,
      expectBody: (d) => (d?.status === 'approved' ? null : `status was ${d?.status}`),
      note:
        'The row is Alice\'s, so Sam reaches it only through his owner exemption. In a ' +
        'transaction, on a locked row, audited on commit. The reason is in the trail forever.',
    },
    {
      n: 6,
      title: 'Approve it twice',
      as: 'duty_manager',
      method: 'POST',
      path: '/timesheets/{id}/approve',
      body: { auditMessage: 'And again.' },
      expectStatus: 409,
      note:
        'The guard runs inside the same transaction as the write, so two approvals cannot race ' +
        'each other. On your own row this is reproducible on demand.',
    },
    {
      n: 7,
      title: 'Read your own reason back',
      as: 'duty_manager',
      method: 'GET',
      path: '/activity?entityType=timesheets&entityId={id}',
      expectStatus: 200,
      expectBody: (d) =>
        (Array.isArray(d) ? d : []).some(
          (r: any) => r.userMessage === 'Checked against the roster; hours match.',
        )
          ? null
          : 'the reason from step 5 is not in the trail',
      note:
        "Your reason in the trail, with the field-level diff — not a stranger's. Scoped to your " +
        "row on purpose: unscoped, the shared sandbox would show other people's.",
    },
  ];
}
