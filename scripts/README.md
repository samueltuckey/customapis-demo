# `scripts/` — the harness, not the application

None of it is code you would write. There is no application logic in here, no route, no permission
rule; every line is an assertion about behaviour the framework produces, or the local bring-up that
lets you watch it. If you came to see how much code a system built on this framework needs, this is
the directory to skip — `src/routes/` and `src/plugins/` are the answer, and neither imports
anything from here.

| File | What it is |
|---|---|
| `replay.ts` | Runs the seven reads and the seven-step write sequence, asserts every response, and writes `TRANSCRIPT.md` from the same pass |
| `dev-up.sh` | Local bring-up: Postgres in Docker, schema, seed |

## The other harness, and where it went

`guarantees.ts` used to sit here: every guarantee the demo makes, asserted against a local Postgres
over real HTTP. It is now `scripts/check-guarantees.ts` in `customapis-infra`, run at the end of
`deploy.sh` against the deployed hostname alongside `check-persona-isolation.sh`.

It moved because it was never code a customer would write, and because a guarantee asserted against
the deployment is worth more than one asserted against a fixture reseeded moments earlier. Being
URL-driven cost it the checks that could only be made from inside the process — the key-derivation
and grace-window unit tests, and the registry sweep that read every route's declared hooks. What
replaced them is asserted on the wire: the refusal taxonomy stays off it, and route coverage is
derived from `/openapi.json`, so a fifth timesheet route still cannot pass by being untested.

## Why the overlap is deliberate

The challenges are **published** — as data, at `GET /challenges`, which is why they live in
[`src/demo/challenges.ts`](../src/demo/challenges.ts) rather than here. Each entry carries the
prose a reader sees alongside the assertion, so a challenge that claims a 404 and gets a 200 fails
the run and neither the transcript nor a corrected route can be published. The prose cannot drift
from the behaviour because they are the same object.

`replay.ts` runs that published set, and the infra harness covers what a walkthrough should not have
to: narrowing that cannot widen, `ownerId` refused from the request body, `costRate` refused at
create by a caller who cannot read it, `status: "approved"` refused at create, and every `tryThis`
suggestion `/me` publishes replayed against a real response. A reader should be able to run the
published set and believe it without taking the rest on trust.

## Where the numbers come from

The claim in the README is about the application, not the repository:

```bash
find src/routes src/plugins src/server.ts src/cors.ts -name '*.ts' | xargs wc -l | tail -1
wc -l scripts/*.ts src/demo/challenges.ts | tail -1
```

The second number used to be the larger of the two. It stopped being larger when the guarantees
moved out — which is the point of them living where they are run.
