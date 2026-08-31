# `scripts/` — the harness, not the application

**The harness is bigger than the application it tests** — this directory plus the challenge data
it runs. That is not an accident and it is not padding: it is what it costs to make the README's
claims checkable rather than assertable. If you came to see how much code a system built on this
framework needs, this is the directory to skip — `src/routes/` and `src/plugins/` are the answer,
and neither imports anything from here.

None of it is code you would write. There is no application logic in here, no route, no permission
rule; every line is an assertion about behaviour the framework produces.

| File | What it is |
|---|---|
| `replay.ts` | Runs the seven reads and the seven-step write sequence, asserts every response, and writes `TRANSCRIPT.md` from the same pass |
| `guarantees.ts` | Every guarantee the demo makes, asserted against a live Postgres over real HTTP |
| `dev-up.sh` | Local bring-up: Postgres in Docker, schema, seed |

## Why two harnesses

They answer different questions and overlap on purpose.

The challenges themselves are **published** — as data, at `GET /challenges`, which is why they
live in [`src/demo/challenges.ts`](../src/demo/challenges.ts) rather than here. Each entry
carries the prose a reader sees alongside the assertion, so a challenge that claims a 404 and
gets a 200 fails the run and neither the transcript nor a corrected route can be published. The
prose cannot drift from the behaviour because they are the same object.

`guarantees.ts` is **not published**, and covers what a walkthrough should not have to: narrowing
that cannot widen, `ownerId` refused from the request body, `costRate` refused at create by a
caller who cannot read it, `status: "approved"` refused at create, the rotation grace window,
every `tryThis` suggestion `/me` publishes replayed against a real response, and the
registry-level check that *every* route on `timesheets` carries the field-visibility hook —
the one control the framework cannot derive, and so the one a future route could forget.

The overlap is deliberate. A reader should be able to run the published set and believe it without
taking the rest on trust — twice, on the same database, and get the same answers both times.

## Where the numbers come from

The claim in the README is about the application, not the repository:

```bash
find src/routes src/plugins src/server.ts src/cors.ts -name '*.ts' | xargs wc -l | tail -1
wc -l scripts/*.ts src/demo/challenges.ts | tail -1
```

The second number being larger than the first is the honest shape of a demo whose entire pitch is
that it is not lying.
