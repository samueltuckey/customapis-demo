/**
 * The ten published challenges, as data.
 *
 * ONE definition, TWO consumers: `replay.ts` runs these against a live server, asserts
 * every expectation, and emits the captured transcript from the same pass. A transcript
 * generated separately from the tests is one that can disagree with them.
 *
 * The prose lives beside the assertion for the same reason. If a challenge claims a 404
 * and the server returns 200, the run fails; the transcript cannot be published saying
 * something the API does not do.
 */

export interface Step {
  /** Persona NAME, as published by `GET /keys` — never a key. Keys rotate every two
   *  hours, so a harness that hardcodes one stops working at the next boundary; the
   *  runner resolves the current key at send time, exactly as a visitor does. */
  as: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  /** What the reader should notice. Rendered under the response. */
  note?: string;
  expectStatus: number;
  /** Extra assertion on the parsed body. Return a reason string on failure. */
  expectBody?: (data: any) => string | null;
  /** Take a value from this step's response; later paths substitute it for `{id}`. */
  capture?: (data: any) => string;
}

export interface Challenge {
  /** Stable anchor. The demo page links to these by id, so never renumber — append a letter. */
  id: string;
  title: string;
  premise: string;
  steps: Step[];
  moral: string;
}

const idsOf = (data: any): string[] =>
  (Array.isArray(data) ? data : []).map((r: any) => String(r.id)).sort();

const pathsOf = (d: any): string[] => Object.keys(d?.paths ?? {}).sort();

export const CHALLENGES: Challenge[] = [
  {
    id: '1',
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
    id: '2',
    title: 'Same request, different answers',
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
    moral:
      'Alice and Sam differ by exactly one permission — `customapis_admin_timesheets`. Neither the ' +
      'route nor the query changed, and no filtering code exists in the application.',
  },
  {
    id: '3',
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
    id: '3b',
    title: 'Reach the next department',
    premise:
      'Tomas manages Front of House. The Kitchen is a sibling department — same company, same ' +
      'location, one step across.',
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
    id: '4',
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
    id: '5',
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
    id: '6',
    title: '403 vs 404 — the security model, in two responses',
    premise: 'One key, two refusals, two different codes.',
    steps: [
      {
        as: 'employee',
        method: 'POST',
        path: '/timesheets/1046/approve',
        body: { auditMessage: 'looks fine to me' },
        expectStatus: 403,
        note: 'Alice holds no approve permission at all — decided from one check, before any row is loaded.',
      },
      {
        as: 'employee',
        method: 'GET',
        path: '/timesheets/1042',
        expectStatus: 404,
        note: 'Alice holds read permission. This row is not hers.',
      },
    ],
    moral:
      '**403 means the permission is missing. 404 means everything else** — not yours, not your ' +
      'department, not your company, never existed. All four are the same response, so the ' +
      'boundary cannot be mapped by probing it.',
  },
  {
    id: '7',
    title: 'Do the write you should',
    premise:
      'Approval is a real write: in a transaction, on a locked row, audited on commit, and it ' +
      'demands a written reason. **You make the row it acts on**, so nothing here depends on ' +
      'what another visitor did first.',
    steps: [
      {
        as: 'employee',
        method: 'POST',
        path: '/timesheets',
        // 81 is the sandbox worker. 'submitted' is explicit: the default 'draft' 422s.
        body: {
          employeeId: 81,
          workDate: '2026-08-12',
          startAt: '2026-08-12T07:00:00Z',
          endAt: '2026-08-12T15:00:00Z',
          hours: 8,
          status: 'submitted',
          note: 'Shift I am about to have approved',
        },
        expectStatus: 201,
        expectBody: (d) => (d?.id ? null : 'create returned no id'),
        capture: (d) => String(d.id),
        note:
          'Your own row, in the Scratch Sandbox — the only company any key can write to. ' +
          '`ownerId` is stamped from the caller, so it belongs to Alice.',
      },
      {
        as: 'duty_manager',
        method: 'POST',
        path: '/timesheets/{id}/approve',
        body: {},
        expectStatus: 400,
        note: 'No reason supplied. One line of route config makes this impossible to skip.',
      },
      {
        as: 'duty_manager',
        method: 'POST',
        path: '/timesheets/1041/approve',
        body: { auditMessage: 'Approving a Harbourline row.' },
        expectStatus: 404,
        note: 'Companies A and B are read-only — by permission, not convention. Note the 404: you ' +
          'are not told that writes are disallowed here.',
      },
      {
        as: 'duty_manager',
        method: 'POST',
        path: '/timesheets/{id}/approve',
        body: { auditMessage: 'Checked against the roster; hours match the shift.' },
        expectStatus: 200,
        expectBody: (d) => (d?.status === 'approved' ? null : `status was ${d?.status}`),
        note:
          'Your row, with a reason. He does not own it — Alice does — so this reaches it only ' +
          'through his owner exemption. The reason is now in the trail forever.',
      },
      {
        as: 'duty_manager',
        method: 'POST',
        path: '/timesheets/{id}/approve',
        body: { auditMessage: 'And again.' },
        expectStatus: 409,
        note: 'The rule runs inside the transaction on a locked row, so two approvals cannot race.',
      },
    ],
    moral:
      'The application supplied about ten lines of rule. The transaction, the lock, the audit row ' +
      'and the required reason came from the route declaration.',
  },
  {
    id: '8',
    title: 'Show the trail',
    premise: 'Every committed change, with the diff and the reason.',
    steps: [
      {
        as: 'duty_manager',
        method: 'GET',
        path: '/activity?entityType=timesheets',
        expectStatus: 200,
        expectBody: (d) =>
          (Array.isArray(d) ? d : []).some((r: any) => r.userMessage)
            ? null
            : 'expected an audit row carrying the approval reason',
        note: 'The approval, its field-level diff, and the reason it required.',
      },
      {
        as: 'kestrel_payroll',
        method: 'GET',
        path: '/activity?entityType=timesheets',
        expectStatus: 200,
        expectBody: (d) =>
          (Array.isArray(d) ? d : []).length === 0 ? null : "Kestrel saw another company's trail",
        note: 'Kestrel sees an empty trail. The audit API is tenant-scoped like everything else.',
      },
    ],
    moral:
      '`/activity` is an ordinary search route on a framework-shipped model — filters, paging, ' +
      'tenant scoping and documentation all inherited. **The audit API is not a special case.**',
  },
  {
    id: '9',
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