# `scripts/` — the harness, not the application

None of it is code you would write. There is no application logic in here, no route, no permission
rule; every line is an assertion about behaviour the framework produces, or the local bring-up that
lets you watch it. If you came to see how much code a system built on this framework needs, this is
the directory to skip — `src/routes/` and `src/plugins/` are the answer, and neither imports
anything from here.

| File | What it is |
|---|---|
| `replay.ts` | Runs the seven reads and the seven-step write sequence, asserts every response, and writes `TRANSCRIPT.md` on `--write` (generated on demand, not committed) |
| `dev-up.sh` | Local bring-up: Postgres in Docker, schema, seed |

## Where the numbers come from

The claim in the README is about the application, not the repository:

```bash
find src/routes src/plugins src/server.ts src/cors.ts -name '*.ts' | xargs wc -l | tail -1
wc -l scripts/*.ts src/demo/challenges.ts | tail -1
```
