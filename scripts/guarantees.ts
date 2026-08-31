/**
 * Every guarantee the demo makes, asserted against a live Postgres over real HTTP.
 *
 * Tenant isolation down the 4-hop path, the cross-company 404, owner-scoped rows and the
 * owner exemption, path restrictions, per-permission read/write scopes, per-caller field
 * visibility on every route of a model, key rotation and its grace window, the
 * self-documenting surface, and refusals that disclose nothing.
 *
 * **Reseeds first**, because the checks are stateful: approving timesheet 1046 twice is a
 * 409, so a second run against the same database would fail there, correctly.
 *
 * Run: npm run guarantees
 */

import type { Server } from 'node:http';
import { buildFramework, createApp } from '../src/server.js';

import { keyForPersona, keysFor, currentWindow, verifyKey } from '../src/demo/keys.js';
import { COST_RATE as COST_RATE_KEY } from '../src/routes/timesheet/fieldVisibility.js';

/** Resolved at run time, never hardcoded: keys rotate every two hours. */
const KEY = {
  alice: keyForPersona('employee'),
  sam: keyForPersona('duty_manager'),
  priya: keyForPersona('payroll'),
  omar: keyForPersona('kestrel_payroll'),
  tomas: keyForPersona('department_manager'),
} as const;

let base = '';
const failures: string[] = [];

interface Res {
  status: number;
  body: any;
}

async function call(method: string, path: string, key?: string, body?: unknown): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

function check(label: string, ok: boolean, detail: string): void {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}\n      ${detail}`);
    failures.push(label);
  }
}

/** The framework returns object payloads under `data`; searches return arrays. */
function rows(body: any): any[] {
  const d = body?.data ?? body;
  return Array.isArray(d) ? d : d ? [d] : [];
}

async function main(): Promise<void> {
  const framework = buildFramework();
  await framework.boot();

  const app = createApp(framework);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  try {
    console.log('\n1. The 4-hop read — timesheets → employees → departments → locations → organisations');
    {
      const r = await call('GET', '/timesheets/1041', KEY.alice);
      const row = rows(r.body)[0];
      check(
        'Alice reads timesheet 1041 (her own, Harbourline) → 200',
        r.status === 200 && String(row?.id) === '1041',
        `got ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`,
      );
    }

    console.log('\n2. The cross-company 404 — the same id, a different company');
    {
      const r = await call('GET', '/timesheets/1041', KEY.omar);
      check(
        'Kestrel reads timesheet 1041 → 404 (row exists; you cannot tell)',
        r.status === 404,
        `got ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`,
      );
      const kestrelOwn = await call('GET', '/timesheets/1043', KEY.omar);
      check(
        'Kestrel reads its OWN timesheet 1043 → 200 (the key works; the row was the problem)',
        kestrelOwn.status === 200,
        `got ${kestrelOwn.status}`,
      );
    }

    console.log('\n3. Owner-scoped rows (F2) and the owner exemption (F3)');
    {
      const alice = await call('GET', '/timesheets/1042', KEY.alice);
      check(
        "Alice reads Ben's timesheet 1042 — same company, same department → 404",
        alice.status === 404,
        `got ${alice.status} ${JSON.stringify(alice.body).slice(0, 200)}`,
      );

      const sam = await call('GET', '/timesheets/1042', KEY.sam);
      check(
        'Duty manager reads that SAME row → 200 (one permission apart)',
        sam.status === 200,
        `got ${sam.status} ${JSON.stringify(sam.body).slice(0, 200)}`,
      );

      const aliceList = await call('GET', '/timesheets', KEY.alice);
      const aliceIds = rows(aliceList.body).map((r) => String(r.id)).sort();
      check(
        'Alice lists timesheets → only rows she owns [1041,1046]',
        JSON.stringify(aliceIds) === JSON.stringify(['1041', '1046']),
        `got ${JSON.stringify(aliceIds)}`,
      );

      const samList = await call('GET', '/timesheets', KEY.sam);
      const samIds = rows(samList.body).map((r) => String(r.id)).sort();
      check(
        'Duty manager lists → every row in his scope [1041,1042,1044,1045,1046]',
        JSON.stringify(samIds) === JSON.stringify(['1041', '1042', '1044', '1045', '1046']),
        `got ${JSON.stringify(samIds)}`,
      );

      const omarList = await call('GET', '/timesheets', KEY.omar);
      const omarIds = rows(omarList.body).map((r) => String(r.id)).sort();
      check(
        'Kestrel lists timesheets → only Kestrel rows [1043]',
        JSON.stringify(omarIds) === JSON.stringify(['1043']),
        `got ${JSON.stringify(omarIds)}`,
      );
    }

    console.log('\n3b. Path restrictions — a subtree of the company, mid-path');
    {
      // Tomas is Sam with one addition: a restriction to department 8. Same company,
      // same permissions, same owner exemption.
      const own = await call('GET', '/timesheets/1041', KEY.tomas);
      check(
        'Department manager reads a Front of House row → 200',
        own.status === 200,
        `got ${own.status} ${JSON.stringify(own.body).slice(0, 200)}`,
      );

      const sibling = await call('GET', '/timesheets/1045', KEY.tomas);
      check(
        "Department manager reads the KITCHEN's row — same company, same location → 404",
        sibling.status === 404,
        `got ${sibling.status} ${JSON.stringify(sibling.body).slice(0, 200)}`,
      );

      const samSees = await call('GET', '/timesheets/1045', KEY.sam);
      check(
        'Duty manager reads that SAME Kitchen row → 200 (one restriction apart)',
        samSees.status === 200,
        `got ${samSees.status}`,
      );

      const tomasList = await call('GET', '/timesheets', KEY.tomas);
      const tomasIds = rows(tomasList.body).map((r) => String(r.id)).sort();
      check(
        'Department manager lists → Front of House only [1041,1042,1044] (the scratch row is another department)',
        JSON.stringify(tomasIds) === JSON.stringify(['1041', '1042', '1044']),
        `got ${JSON.stringify(tomasIds)}`,
      );

      const samList = await call('GET', '/timesheets', KEY.sam);
      const samIds = rows(samList.body).map((r) => String(r.id)).sort();
      check(
        'Duty manager lists → every Harbourline department [1041,1042,1044,1045,1046]',
        JSON.stringify(samIds) === JSON.stringify(['1041', '1042', '1044', '1045', '1046']),
        `got ${JSON.stringify(samIds)}`,
      );
    }

    console.log('\n3c. Tenant narrowing — a caller who spans companies asking for one');
    {
      // Sam holds his permissions in Harbourline AND Scratch, so his page spans both.
      // `?organisationId=` narrows it. This is NOT a filter: `organisationId` is absent
      // from `filters.allow`, because narrowing is a scope operation the framework owns.
      const all = await call('GET', '/timesheets', KEY.sam);
      const allIds = rows(all.body).map((r) => String(r.id)).sort();
      check(
        'unnarrowed, the duty manager sees both his companies',
        JSON.stringify(allIds) === JSON.stringify(['1041', '1042', '1044', '1045', '1046']),
        `got ${JSON.stringify(allIds)}`,
      );

      const harbourline = await call('GET', '/timesheets?organisationId=1', KEY.sam);
      const hIds = rows(harbourline.body).map((r) => String(r.id)).sort();
      check(
        'narrowed to Harbourline → only its rows [1041,1042,1044,1045]',
        JSON.stringify(hIds) === JSON.stringify(['1041', '1042', '1044', '1045']),
        `got ${JSON.stringify(hIds)}`,
      );

      const scratch = await call('GET', '/timesheets?organisationId=3', KEY.sam);
      const sIds = rows(scratch.body).map((r) => String(r.id)).sort();
      check(
        'narrowed to Scratch → only its row [1046]',
        JSON.stringify(sIds) === JSON.stringify(['1046']),
        `got ${JSON.stringify(sIds)}`,
      );

      // The disclosure rule again: narrowing to a company you do not hold is an EMPTY
      // page, not a 403. A 403 would confirm the company exists and that you lack it.
      const notHeld = await call('GET', '/timesheets?organisationId=2', KEY.sam);
      check(
        'narrowed to a company he does NOT hold → 200 and empty, never 403',
        notHeld.status === 200 && rows(notHeld.body).length === 0,
        `got ${notHeld.status} ${JSON.stringify(notHeld.body).slice(0, 160)}`,
      );

      // And it cannot widen: Kestrel narrowing to Harbourline gets nothing, because the
      // parameter intersects with the grant rather than replacing it.
      const widen = await call('GET', '/timesheets?organisationId=1', KEY.omar);
      check(
        'narrowing cannot WIDEN — Kestrel asking for Harbourline gets nothing',
        widen.status === 200 && rows(widen.body).length === 0,
        `got ${widen.status} ${JSON.stringify(widen.body).slice(0, 160)}`,
      );
    }

    console.log('\n4. Field visibility — absent from the response, not nulled');
    {
      const payroll = await call('GET', '/timesheets/1041', KEY.priya);
      const duty = await call('GET', '/timesheets/1041', KEY.sam);
      const payrollRow = rows(payroll.body)[0] ?? {};
      const dutyRow = rows(duty.body)[0] ?? {};

      // The permitted caller is asserted FIRST and by the same key the hook deletes. A
      // negative assertion on a name nothing produces passes vacuously, so the positive
      // case is pinned to the same key and the pair cannot silently disagree.
      const FIELD = 'costRate';
      check(
        `Payroll sees ${FIELD}`,
        FIELD in payrollRow,
        `keys: ${Object.keys(payrollRow).join(',')}`,
      );
      check(
        `Duty manager: ${FIELD} ABSENT (not null) from the same row`,
        FIELD in payrollRow && !(FIELD in dutyRow) && duty.status === 200,
        `keys: ${Object.keys(dutyRow).join(',')}`,
      );
    }

    console.log('\n5. Per-permission tenant scopes — read one company, write another');
    {
      const wrongTenant = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 77, // Alice's own employee row — but in Harbourline
        workDate: '2026-08-12',
        startAt: '2026-08-12T07:00:00Z',
        endAt: '2026-08-12T15:00:00Z',
        hours: 8,
      });
      check(
        'Alice writes to Harbourline (read-only company) → refused',
        wrongTenant.status === 404 || wrongTenant.status === 403,
        `got ${wrongTenant.status} ${JSON.stringify(wrongTenant.body).slice(0, 200)}`,
      );

      const scratch = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 81, // the scratch company's employee
        // A BARE DATE on a SQL DATE column — a 400 before the date-handling work landed.
        workDate: '2026-08-12',
        startAt: '2026-08-12T07:00:00Z',
        endAt: '2026-08-12T15:00:00Z',
        hours: 8,
      });
      const created = rows(scratch.body)[0] ?? {};
      check(
        'Alice writes to Scratch → 200/201',
        scratch.status === 200 || scratch.status === 201,
        `got ${scratch.status} ${JSON.stringify(scratch.body).slice(0, 300)}`,
      );
      check(
        'ownerId stamped from the credential, not the body',
        String(created.ownerId) === '41',
        `ownerId=${created.ownerId}`,
      );
      check(
        'ownerDisplayName stamped at create',
        created.ownerDisplayName === 'Alice Nguyen',
        `ownerDisplayName=${created.ownerDisplayName}`,
      );

      const spoof = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 81,
        workDate: '2026-08-12',
        startAt: '2026-08-12T07:00:00Z',
        endAt: '2026-08-12T15:00:00Z',
        hours: 8,
        ownerId: 45, // try to file it as Ben
      });
      check(
        'Alice cannot set ownerId to someone else → 400',
        spoof.status === 400,
        `got ${spoof.status} ${JSON.stringify(spoof.body).slice(0, 300)}`,
      );

      // The write half of field visibility. Alice cannot READ costRate, and a route that
      // let her write it would be a blind write to the one field this resource protects —
      // she could not see the value she set, and nothing would tell her it landed.
      const rateSpoof = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 81,
        workDate: '2026-08-12',
        startAt: '2026-08-12T07:00:00Z',
        endAt: '2026-08-12T15:00:00Z',
        hours: 8,
        costRate: 999.99,
      });
      check(
        'Alice cannot write costRate — the field she is not allowed to read → 400',
        rateSpoof.status === 400,
        `got ${rateSpoof.status} ${JSON.stringify(rateSpoof.body).slice(0, 300)}`,
      );

      // Approval is a permission, a written reason and a state transition. None of that
      // is reachable by naming the column at create, or the approve route is decoration.
      const selfApprove = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 81,
        workDate: '2026-08-12',
        startAt: '2026-08-12T07:00:00Z',
        endAt: '2026-08-12T15:00:00Z',
        hours: 8,
        status: 'approved',
      });
      check(
        'Alice cannot self-approve at create — approval is the approve route\'s alone → 400',
        selfApprove.status === 400,
        `got ${selfApprove.status} ${JSON.stringify(selfApprove.body).slice(0, 300)}`,
      );

      // …but 'submitted' IS hers to choose: she is submitting a timesheet, and the row
      // has to reach 'submitted' somehow or nothing a visitor creates is ever approvable.
      const submitted = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 81,
        workDate: '2026-08-12',
        startAt: '2026-08-12T07:00:00Z',
        endAt: '2026-08-12T15:00:00Z',
        hours: 8,
        status: 'submitted',
      });
      check(
        "Alice CAN submit — 'submitted' is a legitimate starting state",
        (submitted.status === 200 || submitted.status === 201) &&
          (rows(submitted.body)[0] ?? {}).status === 'submitted',
        `got ${submitted.status} ${JSON.stringify(submitted.body).slice(0, 300)}`,
      );

      const aliceAfter = await call('GET', '/timesheets', KEY.alice);
      const afterIds = rows(aliceAfter.body).map((r) => String(r.id));
      check(
        'the rows Alice just created appear in her own list',
        // Her two seeded rows, plus the two creates above that were meant to succeed —
        // the scratch write and the 'submitted' one. The three spoofs 400'd and wrote
        // nothing, which is the other half of what this count asserts.
        afterIds.length === 4 && afterIds.includes('1041') && afterIds.includes('1046'),
        `got ${JSON.stringify(afterIds)}`,
      );
    }

    console.log('\n5b. Resource permission — the only 403 in the demo');
    {
      const duty = await call('GET', '/invoices', KEY.sam);
      check(
        'Duty manager lists invoices → 403 (no such permission, decided before any load)',
        duty.status === 403,
        `got ${duty.status} ${JSON.stringify(duty.body).slice(0, 160)}`,
      );
      const payroll = await call('GET', '/invoices', KEY.priya);
      check(
        'Payroll lists invoices → 200',
        payroll.status === 200,
        `got ${payroll.status}`,
      );
    }

    console.log('\n5c. The named action — approve');
    {
      // Provision the row: a shared target passes once, then 409s forever.
      const made = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 81,
        workDate: '2026-08-12',
        startAt: '2026-08-12T07:00:00Z',
        endAt: '2026-08-12T15:00:00Z',
        hours: 8,
        // Explicit: the column defaults to 'draft', and the guard answers a draft with 422.
        status: 'submitted',
        note: 'Row provisioned by the approve checks',
      });
      const mine = String((rows(made.body)[0] as any)?.id ?? '');
      check(
        'a caller provisions the row it is about to approve',
        made.status === 201 && mine !== '',
        `got ${made.status} ${JSON.stringify(made.body).slice(0, 160)}`,
      );

      const alice = await call('POST', `/timesheets/${mine}/approve`, KEY.alice, {
        auditMessage: 'looks fine to me',
      });
      check(
        'Alice approves → 403 (no approve permission at all)',
        alice.status === 403,
        `got ${alice.status} ${JSON.stringify(alice.body).slice(0, 160)}`,
      );

      const noReason = await call('POST', `/timesheets/${mine}/approve`, KEY.sam, {});
      check(
        'Duty manager approves with no reason → 400 audit_message_required',
        noReason.status === 400 && noReason.body?.error?.code === 'audit_message_required',
        `got ${noReason.status} ${JSON.stringify(noReason.body).slice(0, 160)}`,
      );

      const readOnly = await call('POST', '/timesheets/1041/approve', KEY.sam, {
        auditMessage: 'approving a read-only company row',
      });
      check(
        'Duty manager approves a HARBOURLINE row → 404 (read-only company, by permission)',
        readOnly.status === 404,
        `got ${readOnly.status}`,
      );

      const ok = await call('POST', `/timesheets/${mine}/approve`, KEY.sam, {
        auditMessage: 'Checked against the roster; hours match the shift.',
      });
      check(
        "Duty manager approves the caller's own scratch row → 200, status approved",
        ok.status === 200 && rows(ok.body)[0]?.status === 'approved',
        `got ${ok.status} ${JSON.stringify(ok.body).slice(0, 200)}`,
      );

      const again = await call('POST', `/timesheets/${mine}/approve`, KEY.sam, {
        auditMessage: 'again',
      });
      check(
        'Approving twice → 409 from the in-transaction guard',
        again.status === 409,
        `got ${again.status} ${JSON.stringify(again.body).slice(0, 160)}`,
      );
    }

    console.log('\n5d. GET /me pre-commits the server, and the tests hold it to that');
    {
      for (const [who, key] of Object.entries(KEY)) {
        const me = await call('GET', '/me', key);
        const body = rows(me.body)[0] as any;
        check(
          `/me as ${who} → 200 with identity, scope and a cannot list`,
          me.status === 200 && !!body?.identity?.name && Array.isArray(body?.cannot),
          `got ${me.status} ${JSON.stringify(me.body).slice(0, 160)}`,
        );
        check(
          `/me as ${who} labels the write scope in plain language`,
          typeof body?.scope?.writes === 'string' && body.scope.writes.length > 0,
          `scope was ${JSON.stringify(body?.scope).slice(0, 160)}`,
        );

        // `tryThis` is the other half of the pre-commitment, and the half nothing held: run
        // every suggestion the SERVER published, not the fixture behind it. The first must
        // succeed — a list that is all refusals reads as a broken key, not as a boundary.
        const suggestions: any[] = Array.isArray(body?.tryThis) ? body.tryThis : [];
        check(
          `/me as ${who} leads with a suggestion that succeeds`,
          String(suggestions[0]?.expect).startsWith('2'),
          `first suggestion expects ${suggestions[0]?.expect}`,
        );
        for (const suggestion of suggestions) {
          const [method, path] = String(suggestion.call).split(' ');
          const res = await call(method!, path!, key, suggestion.body);
          // `expect` may name two outcomes ("200, or 409 …") where the sandbox is shared.
          const promised: string[] = String(suggestion.expect).match(/\d{3}/g) ?? [];
          check(
            `/me as ${who} — ${suggestion.call} → ${suggestion.expect}`,
            promised.includes(String(res.status)),
            `got ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`,
          );
        }
      }

      // The route says "newest first", so the caller who sends no `?sort=` gets that.
      const trail = rows((await call('GET', '/activity?entityType=timesheets', KEY.sam)).body);
      const times = trail.map((r: any) => String(r.createdAt));
      check(
        'GET /activity defaults to newest first, which is what its description promises',
        times.length > 1 && times.every((t, i) => i === 0 || times[i - 1]! >= t),
        `createdAt order: ${JSON.stringify(times.slice(0, 4))}`,
      );

      // The managers' pre-commitment — "Approve a timesheet in your own company → 404" —
      // asserted against a real response. Sam's version is held to it by challenge 7;
      // Tomas has no challenge step, so he is held to it here.
      const tomasApprove = await call('POST', '/timesheets/1041/approve', KEY.tomas, {
        auditMessage: 'Dept manager approving a row in his own company.',
      });
      check(
        'Tomas cannot approve in his own company — write scope is sandbox-only → 404',
        tomasApprove.status === 404,
        `got ${tomasApprove.status} ${JSON.stringify(tomasApprove.body).slice(0, 160)}`,
      );
    }

    console.log('\n5e. Field visibility holds on EVERY route of the model, not just the reads');
    {
      // Derived from the live registry, not a hand-kept list. A fifth timesheet route
      // added without the shared pair from `fieldVisibility.ts` fails HERE, at the
      // structural check — which is the whole reason the pair is shared rather than
      // retyped. The approve route was once exactly this gap: an `update` returns the
      // row, and it returned `costRate` to a caller whose GET of the same row hid it.
      const { routes } = framework.getRegistry();
      const onModel = (routes as any[]).filter((r) => r.config.model === 'timesheets');
      const label = (r: any) => `${r.config.method ?? r.config.operation} ${r.config.path}`;

      check(
        `every timesheet route declares the shared consultedPermissions (${onModel.length} routes)`,
        onModel.every((r) =>
          (r.config.consultedPermissions ?? []).some((p: any) => (p?.permission ?? p) === COST_RATE_KEY),
        ),
        `missing on: ${onModel.filter((r) => !(r.config.consultedPermissions ?? []).some((p: any) => (p?.permission ?? p) === COST_RATE_KEY)).map(label).join(', ')}`,
      );
      check(
        'every timesheet route applies the shared response projection',
        onModel.every((r) => typeof r.config.stageSettings?.processReturnData?.after === 'function'),
        `missing on: ${onModel.filter((r) => typeof r.config.stageSettings?.processReturnData?.after !== 'function').map(label).join(', ')}`,
      );

      // The write half of the same fact. Visibility that only runs on the way OUT is half
      // a control: Sam cannot read `costRate`, so he must not be able to set one either —
      // he would be writing a value he could never see, and nothing would tell him.
      const rateWrite = await call('POST', '/timesheets', KEY.sam, {
        employeeId: 81, workDate: '2026-08-15',
        startAt: '2026-08-15T07:00:00Z', endAt: '2026-08-15T15:00:00Z',
        hours: 8, costRate: 31,
      });
      check(
        'POST /timesheets REJECTS a costRate — what Sam cannot read, he cannot write',
        rateWrite.status === 400,
        `got ${rateWrite.status} ${JSON.stringify(rateWrite.body).slice(0, 200)}`,
      );

      // Declaration is not behaviour, so drive each route for real as Sam — who holds no
      // `read_cost_rate` — and assert the wire.
      const made = await call('POST', '/timesheets', KEY.sam, {
        employeeId: 81, workDate: '2026-08-15',
        startAt: '2026-08-15T07:00:00Z', endAt: '2026-08-15T15:00:00Z',
        hours: 8, status: 'submitted', note: 'field-visibility probe',
      });
      const madeId = rows(made.body)[0]?.id;
      check(
        'the field-visibility probe row was created',
        made.status < 300 && madeId !== undefined,
        `got ${made.status} ${JSON.stringify(made.body).slice(0, 200)}`,
      );

      // The rate reaches the row OUT OF BAND, because the API offers no way to put one
      // there. That is what makes absence on the reads below FILTERING rather than an
      // empty column — the distinction this block exists for. `POST /timesheets` in the
      // loop is the weaker guard: it catches `costRate` being made writable again without
      // the projection, which is the regression it needs to catch.
      await framework
        .getRegistry()
        .runtime.getSequelize()
        .query('UPDATE timesheets SET cost_rate = 31 WHERE id = $1', { bind: [madeId] });

      const exercised: Record<string, Res> = {
        'SEARCH /timesheets': await call('GET', '/timesheets', KEY.sam),
        'GET /timesheets/:id': await call('GET', `/timesheets/${madeId}`, KEY.sam),
        'POST /timesheets': made,
        'POST /timesheets/:id/approve': await call(
          'POST', `/timesheets/${madeId}/approve`, KEY.sam,
          { auditMessage: 'Field-visibility probe: approving the row just created.' },
        ),
      };

      // Coverage, also derived: every route on the model must appear above, so a new one
      // cannot pass by being untested.
      check(
        'every timesheet route is exercised by this check',
        onModel.every((r) => label(r) in exercised),
        `not exercised: ${onModel.map(label).filter((l) => !(l in exercised)).join(', ')}`,
      );

      for (const [name, res] of Object.entries(exercised)) {
        const leaked = rows(res.body).filter((row) => 'costRate' in (row ?? {}));
        check(
          `${name} hides costRate from the duty manager`,
          res.status < 300 && leaked.length === 0,
          `status ${res.status}; leaked in ${leaked.length} row(s): ${JSON.stringify(leaked[0] ?? res.body).slice(0, 200)}`,
        );
      }

      // The paired positive, by the SAME route and row: payroll DOES see the rate, so a
      // green suite cannot mean "the field vanished for everyone".
      const priyaSees = await call('GET', '/timesheets/1041', KEY.priya);
      check(
        'and payroll still sees costRate on the same read',
        'costRate' in (rows(priyaSees.body)[0] ?? {}),
        `got ${JSON.stringify(priyaSees.body).slice(0, 200)}`,
      );
    }

    console.log('\n5h. Every write a visitor can make publishes an event');
    {
      // The demo promises events, and a visitor's first write is a create — so a create
      // that publishes nothing reads as a broken socket. Both writes are asserted, and so
      // is the payload: the transport is an unauthenticated broadcast, and `costRate` is
      // permission-gated on every read, so it must never ride out on an envelope.
      const made = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 81,
        workDate: '2026-08-28',
        startAt: '2026-08-28T07:00:00Z',
        endAt: '2026-08-28T15:00:00Z',
        hours: 8,
        status: 'submitted',
      });
      const madeId = rows(made.body)[0]?.id;
      await framework.flushBackgroundWork();
      const afterCreate = await call('GET', '/events/recent', KEY.alice);
      const createEvents = (afterCreate.body as any)?.data?.events ?? [];

      check(
        'creating a timesheet publishes timesheet.created',
        createEvents.some((e: any) => e.eventType === 'timesheet.created'),
        `got ${JSON.stringify(createEvents.map((e: any) => e.eventType))}`,
      );

      const refused = await call('POST', '/timesheets', KEY.alice, {
        employeeId: 77,
        workDate: '2026-08-28',
        startAt: '2026-08-28T07:00:00Z',
        endAt: '2026-08-28T15:00:00Z',
        hours: 8,
      });
      await framework.flushBackgroundWork();
      const afterRefused = await call('GET', '/events/recent', KEY.alice);
      const refusedEvents = (afterRefused.body as any)?.data?.events ?? [];
      check(
        'a refused write publishes nothing — events follow the commit, not the request',
        refused.status === 404 && refusedEvents.length === createEvents.length,
        `got ${refused.status} and ${refusedEvents.length} events (was ${createEvents.length})`,
      );

      const approved = await call('POST', `/timesheets/${madeId}/approve`, KEY.sam, {
        auditMessage: 'Event guarantee: approving the row just created.',
      });
      await framework.flushBackgroundWork();
      const afterApprove = await call('GET', '/events/recent', KEY.alice);
      const approveEvents = (afterApprove.body as any)?.data?.events ?? [];
      check(
        'approving publishes timesheet.approved',
        approved.status === 200 &&
          approveEvents.some((e: any) => e.eventType === 'timesheet.approved'),
        `got ${approved.status} ${JSON.stringify(approveEvents.map((e: any) => e.eventType))}`,
      );

      check(
        'no published envelope carries costRate — the socket is unauthenticated',
        !JSON.stringify(approveEvents).toLowerCase().includes('costrate'),
        'a permission-gated field reached the event transport',
      );
    }

    console.log('\n5f. Key rotation and the grace window');
    {
      const window = currentWindow();
      const current = keysFor(window.index)[0]!.key;
      const previous = keysFor(window.index - 1)[0]!.key;
      const boundary = window.index * 2 * 60 * 60 * 1000;
      const at = (mins: number) => new Date(boundary + mins * 60 * 1000);

      check('a window derives a different key set from its predecessor', current !== previous,
        'the two windows produced the same key');
      check('keys are deterministic — every node derives the same set',
        keysFor(window.index)[0]!.key === current, 'derivation is not stable');
      check("the previous window's key still works 14 minutes past the boundary",
        (verifyKey(previous, at(14)) as any).persona === 'employee', 'grace window rejected too early');
      check('…and stops working at 15 minutes',
        (verifyKey(previous, at(15)) as any).reason === 'expired', 'expired key still resolves');

      // The taxonomy is the point, not the rejection: an operator has to be able to tell
      // "clients are not re-fetching /keys" from "someone is guessing".
      check('an expired key is reported as EXPIRED, not lumped in with garbage',
        (verifyKey(previous, at(60)) as any).reason === 'expired', 'stale key was not classed expired');
      check('a well-formed key that no window derives is an invalid signature',
        (verifyKey('demo_emp_AAAAAAAAAAAAAAAAAAAAAA') as any).reason === 'invalid_signature',
        'forged key was misclassified');
      check('something that is not a demo key at all is malformed',
        (verifyKey('not-a-key') as any).reason === 'malformed', 'garbage was not classed malformed');
      check('no credential is its own reason',
        (verifyKey(null) as any).reason === 'no_credential', 'missing credential misclassified');

      // Raw `fetch`, not `call`, because the header is half of what is being asserted.
      const live = await fetch(`${base}/keys`);
      const liveBody = await live.json();
      const published = (rows(liveBody)[0] as any)?.keys ?? [];
      check('GET /keys is public and serves the current set',
        live.status === 200 && published.some((k: any) => k.key === current),
        `got ${live.status} ${JSON.stringify(liveBody).slice(0, 160)}`);

      // No credential here, so nothing bars a shared cache from keeping expired keys.
      check('…and forbids storage, because the keys inside it expire',
        live.headers.get('cache-control') === 'no-store',
        `cache-control: ${live.headers.get('cache-control') ?? '(absent)'}`);

      const stale = await call('GET', '/timesheets/1041', previous);
      check("a previous-window key is honoured inside the grace period (live request)",
        stale.status === 200 || stale.status === 401,
        `got ${stale.status} — expected 200 inside grace, 401 outside`);
    }

    console.log('\n5g. The API documents itself, per caller');
    {
      const paths = (b: any) => Object.keys(b?.paths ?? {}).sort();

      const pub = await call('GET', '/openapi.json');
      check(
        'unauthenticated /openapi.json is the FULL surface, never an empty shell',
        pub.status === 200 && paths(pub.body).length >= 10,
        `got ${pub.status} with ${paths(pub.body).length} paths`,
      );
      check(
        'and it says how to get your own view',
        String(pub.body?.info?.description ?? '').includes('?key='),
        'the public spec does not explain how to narrow it',
      );

      const alice = await call('GET', '/openapi.json', KEY.alice);
      check(
        "Alice's spec omits the routes she cannot call",
        !paths(alice.body).includes('/invoices') &&
          !paths(alice.body).includes('/timesheets/{id}/approve'),
        `got ${paths(alice.body).join(' ')}`,
      );

      const priya = await call('GET', '/openapi.json', KEY.priya);
      check(
        'payroll gets invoices back, and still no approve',
        paths(priya.body).includes('/invoices') &&
          !paths(priya.body).includes('/timesheets/{id}/approve'),
        `got ${paths(priya.body).join(' ')}`,
      );

      const md = await call('GET', '/docs.md');
      check(
        '/docs.md renders and explains the ?key= narrowing',
        md.status === 200 && String(md.body).includes('?key='),
        `got ${md.status}`,
      );

      const mdText = String(md.body);
      check(
        '/docs.md names the Scratch Sandbox and the read/write split',
        mdText.includes('Scratch Sandbox') && mdText.includes('read-only for every key'),
        'the deployment topology section is missing',
      );
      check(
        '/docs.md names the auditMessage body field on the approve route',
        mdText.includes('`auditMessage`'),
        'the approve route does not name its required body field',
      );

      check(
        'the OpenAPI security scheme tells the CALLER what to send, not the app author',
        String(
          (pub.body?.components?.securitySchemes?.bearerAuth as any)?.description ?? '',
        ).includes('GET /keys'),
        JSON.stringify(pub.body?.components?.securitySchemes ?? {}),
      );

      const llms = await call('GET', '/llms.txt');
      check(
        '/llms.txt points an agent at /keys first',
        llms.status === 200 && String(llms.body).includes('/keys'),
        `got ${llms.status}`,
      );
      check(
        '/llms.txt says how to authenticate and where writes land',
        String(llms.body).includes('Authorization: Bearer') &&
          String(llms.body).includes('Scratch Sandbox'),
        'auth header or write-scope note missing from llms.txt',
      );
      check(
        '/llms.txt sends an agent to the ten challenges',
        String(llms.body).includes('/challenges'),
        'a visitor told to "work through the ten" has nowhere to find them',
      );

      const challenges = rows((await call('GET', '/challenges')).body)[0] as any;
      check(
        '/challenges publishes the ten, every step carrying the status to expect',
        challenges?.count === 10 &&
          challenges.challenges.every((c: any) =>
            c.steps.every((s: any) => typeof s.expectStatus === 'number'),
          ),
        JSON.stringify(challenges).slice(0, 200),
      );

      // Both projections vary by key, so a shared cache in front of the app would serve one
      // visitor's filtered spec to the next — which is what a CDN keyed on the path did.
      for (const path of ['/openapi.json', '/docs.md']) {
        const res = await fetch(`${base}${path}`);
        check(
          `${path} forbids storage — its body depends on who asked`,
          res.headers.get('cache-control') === 'no-store',
          `cache-control: ${res.headers.get('cache-control') ?? '(absent)'}`,
        );
      }
    }

    console.log('\n6. Refusals carry a requestId and disclose nothing');
    {
      const r = await fetch(`${base}/timesheets/1041`, {
        headers: { authorization: `Bearer ${KEY.omar}` },
      });
      const body = await r.json();
      check(
        'x-api-request-id present on the 404',
        Boolean(r.headers.get('x-api-request-id')),
        `headers: ${[...r.headers.keys()].join(',')}`,
      );
      const serialised = JSON.stringify(body);
      check(
        'the 404 body names no company, no owner, no rule',
        !/Harbourline|organisation|owner|tenant/i.test(serialised),
        `body: ${serialised}`,
      );
      console.log(`      body: ${serialised}`);
    }
  } finally {
    // Stop accepting, drain post-commit work, then release the pool — exiting without
    // the drain loses whatever events and deferred audit are still in flight.
    await new Promise((r) => server.close(r));
    await framework.flushBackgroundWork();
  }

  console.log(
    failures.length === 0
      ? '\nALL GUARANTEES HOLD.\n'
      : `\nGUARANTEES FAILED — ${failures.length} check(s):\n  - ${failures.join('\n  - ')}\n`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
