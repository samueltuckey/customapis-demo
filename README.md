# Custom APIs — timesheet demo

A live, public demo API for [customapis.co](https://customapis.co), and the complete source of the
application behind it.

It is a small multi-tenant timesheet system for two fictional companies. You can call it, probe it,
and try to get at data you shouldn't. That last part is the point.

---

## Read it, don't run it

**You cannot `git clone` this and start it**, because it depends on `pgrm` — the framework
underneath — which isn't published. Saying so up front, because otherwise you'd find out at
`npm install` and conclude the repo was abandoned.

Turn that around and it's the pitch:

> This repository is the entire application. Every route, every permission rule, every line of
> business logic that produces the API is here. What isn't here
> is the framework — that's the product. You can't run this, but you can read it, and you can call
> the live API from anything you like.

The runnable artifact is the API itself. CORS is open to all origins on purpose, so you can build
something against it from a browser without asking anyone's permission.

---

## The live API

**<https://timesheetdemo.customapis.co>**

Public, no signup. Everything linked below opens in a browser; the rest need a key from `/keys`.

| | |
|---|---|
| [`/keys`](https://timesheetdemo.customapis.co/keys) | The current key set, one per persona |
| [`/challenges`](https://timesheetdemo.customapis.co/challenges) | Seven reads and a seven-step write sequence, as data: persona, request, body and expected status for every step |
| [`/docs.md`](https://timesheetdemo.customapis.co/docs.md) | Human documentation, projected through the permissions of the key you pass |
| [`/openapi.json`](https://timesheetdemo.customapis.co/openapi.json) | The same route registry, as OpenAPI |
| [`/llms.txt`](https://timesheetdemo.customapis.co/llms.txt) | Orientation for agents |
| [`/events/recent`](https://timesheetdemo.customapis.co/events/recent) | Committed events, newest first. `wss://timesheetdemo.customapis.co/events/live` is the same stream, live |
| [`/health`](https://timesheetdemo.customapis.co/health) | Liveness |
| `/me` | Who your key is, what it reaches, and what it will be refused |
| `/timesheets` `/employees` `/invoices` | The application |
| `/activity` | Your company's audit trail, as an ordinary search route |

List routes are declared `SEARCH` and mount as `GET`, so every resource above is a `GET`.

---

## Start here

Keys are public and rotate every two hours. Load the current set:

```bash
eval "$(curl -sS ${API:-https://timesheetdemo.customapis.co}/keys | jq -r \
  '.data.keys[] | "export DEMO_" + (.persona|ascii_upcase) + "=" + .key')"

curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  https://timesheetdemo.customapis.co/me
```

`GET /me` tells you who that key is, what it can reach — and, unusually, **what it will be refused**,
with the status code to expect. That list is a pre-commitment: everything in it is attempted by the
test suite, so if the demo were lying, the tests would fail before this file was published.

Then read the documentation the API generates about itself:

```bash
curl -sS https://timesheetdemo.customapis.co/docs.md                     # everything
curl -sS "https://timesheetdemo.customapis.co/docs.md?key=$DEMO_EMPLOYEE"  # only what YOU can call
```

**Diff those two.** What disappears is what that key is not allowed to do — a consumer never sees an
endpoint it would be refused. Same for `/openapi.json`, and `/llms.txt` is there for agents.

The challenges are served as data at `GET /challenges` — **seven reads and a seven-step write
sequence**, with persona, request, body and expected status for every step — so an agent pointed at
this API runs the intended set rather than inventing its own. The split is not cosmetic: the reads
consume nothing, so they repeat in any order forever, while a timesheet approves exactly once, so
the write sequence creates its own row at step 1 and threads that id through the rest rather than
naming a row somebody else already approved.

If you would rather read than call, `GET /challenges` names every request, the persona it runs as
and the status it should answer with — the same array `scripts/replay.ts` asserts, so a challenge
the API stopped honouring fails the run before it could be published. `npm run transcript` writes
the full captured exchange to `TRANSCRIPT.md` if you want the response bodies too; it is not
committed, because a machine-generated log longer than the application is the wrong thing to put
in front of someone here to see how little code there is.

---

## The seven things worth seeing

Each is one request. None of them required code in this repository.

**1. The same request, three answers.** `GET /timesheets` as Alice, then as the duty manager, then
as payroll. Her own rows; everyone's rows; everyone's rows *with* cost rates. One unchanged request,
no filtering code anywhere in this repo.

**2. Four different refusals that look identical.** Ask for a colleague's timesheet, another
department's, another company's, and one that never existed. Every one is the same terse 404. You
cannot map the boundary by probing it, and you cannot tell whether the record exists.

**3. One permission is the whole difference between two people.** Alice and the duty manager are
employees of the same company on the same route with the same tenant scope. He holds
`customapis_admin_timesheets`; she doesn't. That is the entire difference between "your timesheets"
and "everyone's timesheets".

**4. Scope that narrows in the middle of a join.** The department manager reads Front of House and
gets a 404 on the Kitchen — same company, same location, one department across. `timesheet` has no
department column: its department is two joins away, on the path to the company.

**5. A field that is absent, not null.** Fetch the same timesheet as payroll and as the duty manager
and compare. `costRate` isn't hidden or redacted — it isn't there. A hidden field and an unset field
are indistinguishable on the wire, so the absence discloses nothing.

**6. Documentation that is a function of your permissions.** Fetch `/openapi.json` with no key,
then with Alice's, then with payroll's. Alice's has no `/invoices` and no approve route; payroll's
has invoices and still no approve. None of it is written by hand — it's a projection of the same
route registry that serves the requests, so it cannot drift from the API.

**7. The tenant the API worked out for you.** Every row carries `tenantId`, resolved through four
joins from a table that has no company column. That value is the framework's answer to "which
company does this row belong to", and it is the thing every scoping decision above is made against.

---

## Guided tour

| Look at | Because |
|---|---|
| [`src/server.ts`](src/server.ts) | **Start here.** The whole application is one `createFramework` object. Read what is *not* in it |
| [`src/routes/timesheet.ts`](src/routes/timesheet.ts) | The whole timesheet resource — four routes, one guard. No tenant filter anywhere, because there is nowhere to put one; and the named business action is an ordinary route, fifteen lines of rule, with the transaction, the row lock, the audit entry and the required reason all not ours |
| [`src/plugins/getIdentityUser.ts`](src/plugins/getIdentityUser.ts) | Verification — proves the credential, every request, never cached |
| [`src/plugins/getAppUser.ts`](src/plugins/getAppUser.ts) | Resolution — the only place authorization is decided, and it never touches a credential |
| [`src/demo/personas.json`](src/demo/personas.json) | The answer an access-management system would return. Data, not code |
| [`src/routes/activity.ts`](src/routes/activity.ts) | The audit API is an ordinary search route, not a special case |
| [`src/routes/me.ts`](src/routes/me.ts) | The endpoint that publishes its own limits |
| [`src/routes/docs.ts`](src/routes/docs.ts) | Docs generated per caller — and the empty-shell trap it exists to avoid |
| [`db/schema.sql`](db/schema.sql) | Where the tenancy actually comes from — every foreign key is doing double duty |

**The directories mean something:**

- **`src/routes/`** and **`src/plugins/`** are the application. `plugins/` holds the three seams —
  verify a credential, resolve a principal, publish committed events — and their shapes are the
  production shapes.
- **`src/demo/`** is scaffolding, quarantined on purpose ([README](src/demo/README.md)): a stand-in
  IdP, a fixture where your access-management system would be, a socket and a REST route so a
  browser can watch events arrive. **If you want to know how much code a real system needs, read
  the first two and ignore this one.**
- **`src/model/`** is generated from the database and hand-edited by nobody
  ([README](src/model/README.md)).
- **`scripts/`** is the harness, not the application ([README](scripts/README.md)) — it replays the
  published challenges and writes the transcript. The guarantees are asserted against the deployed
  host instead, from `customapis-infra`.

"How little code" is a claim about `src/routes/` and `src/plugins/`. Measure it yourself:

```bash
find src/routes src/plugins src/server.ts src/cors.ts -name '*.ts' | xargs wc -l | tail -1
```

The boundary is visible in the imports: `plugins/getAppUser.ts` calls `demo/personas.json` where a
real deployment calls your IAM. Everything left of that arrow is the framework's contract.

---

## What the framework does that you can't see here

The absence is the argument. None of this is in this repository:

- Tenant scoping, derived from foreign keys rather than declared
- The four-hop path from a timesheet to its company, worked out at boot
- Loading a row under lock inside the transaction that will change it
- The rule that a permission you lack is 403 and everything else is 404
- Audit rows with field-level diffs, written on commit
- OpenAPI and human-readable docs generated from the same route declarations
- Per-window credential rotation, verification failure classification, event delivery ordering

Most of what is left is declaration. The **actual business rules are a state-machine guard on
approval and a per-caller field check** — both are in
[`timesheet.ts`](src/routes/timesheet.ts), and reading that one file is seeing them both.

---

## What we cut corners on

```bash
grep -rn "DEMO-ONLY" src/ db/
```

That finds every compromise made for the sake of being a demo, each with a one-line reason. Public
keys, an unscoped event broadcast, a bounded table pretending to be a broker, pinned primary keys,
and `Access-Control-Allow-Origin: *` on an API that mutates state.

**Two things deliberately don't appear in that list: tenant isolation and the 403/404 rule.** Nothing
about them is demo-grade — they're the framework behaving exactly as it would in production, which
is the only reason any of this proves anything.

---

## Reporting a problem

This README invites you to probe a live system, so it owes you somewhere to send what you find.

**If you get at data a key should not reach** — a row from the wrong company, a `costRate` you
should not see, an approval outside your write scope — that is a genuine isolation failure and the
most useful thing anyone could report. Email **security@customapis.co** with the request you sent
and the `x-api-request-id` from the response header; CORS exposes it precisely so a browser client
can quote it. Please don't open a public issue for that one.

Everything else — a wrong status code, docs that disagree with the API, a broken link in here —
is an ordinary issue.

Expect a reply within three working days. This is a small project run by one person; there is no
bounty, and there is genuine gratitude.

**Not a bug, and please don't report it:** `npm install` failing, `pgrm` not resolving, the demo
keys being public, the HMAC secret being in the source, `Access-Control-Allow-Origin: *`, the event
socket showing you other companies' events, or anyone being able to write to the Scratch Sandbox.
The first two are the point of the section at the top; the rest are marked `DEMO-ONLY` in the source
with the reason — `grep -rn "DEMO-ONLY" src/ db/` finds every one.

---

## Running it, if you have the framework

You cannot install this from a clean clone (see "Read it, don't run it" above). With the framework
tarball alongside:

```bash
npm install
npm run dev        # Postgres in Docker + schema + seed, then the API on :3000
npm run verify     # typecheck, pgrm check, challenges replayed
npm run transcript # regenerate TRANSCRIPT.md from a passing run
```

`npm run dev` is idempotent — re-run any time to get back to a known state.

---

## Licence

Source-available, not open source: you may read, quote and discuss this freely; you may not copy it
into another project. See [LICENSE](./LICENSE). It is a reference, not a template.
