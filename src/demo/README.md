# `src/demo` — the scaffolding, quarantined

Everything in this directory exists **because this is a demo**, and none of it should be
copied into anything real. It is in its own folder so that the rest of `src/` can be read
as an application rather than as an application with demo code threaded through it.

The split is the honest version of the pitch. If you want to know how much code a real
system built on this framework needs, read `src/routes/` and `src/plugins/` and ignore
this directory entirely.

| File | Stands in for | What a real system has |
|---|---|---|
| `keys.ts` | Credential issuance | An IdP. Tokens are issued, stored hashed, and never returned by an API |
| `personas.json` | Your access-management system | A service that owns roles and grants, called over HTTP |
| `websocket.ts` | A subscriber | An authenticated subscription, filtered per subscriber |
| `challenges.ts` | *(nothing)* | Seven reads and the seven-step write sequence, as data — asserted by `scripts/replay.ts`, served by the route below |
| `routes/keys.ts` | *(nothing)* | No real API serves credentials |
| `routes/events.ts` | *(nothing)* | No real consumer polls a REST endpoint for events |
| `routes/challenges.ts` | *(nothing)* | No real API ships its own exercises |

## Why the seams are *not* in here

`src/plugins/getIdentityUser.ts` and `getAppUser.ts` stayed outside this folder on
purpose. **Those are the real integration points** — their shapes are exactly what a
production deployment implements, and they are the two files worth studying if you are
evaluating the framework. What they call is what is fake:

```
src/plugins/getIdentityUser.ts   →  src/demo/keys.ts        (verify a token → verify a demo key)
src/plugins/getAppUser.ts        →  src/demo/personas.json  (call your IAM → read a fixture)
```

Read that as the boundary of the demo. Everything left of the arrow is the framework's
contract; everything right of it is a stand-in for infrastructure this demo does not
have.

## The one that matters

`websocket.ts` broadcasts every event to every listener with **no tenant filter**. The
framework scopes queries against a *caller*; a broadcast socket has no caller, so nothing
scopes it. That is fine in one shared sandbox of synthetic data behind published keys, and
it is a tenant breach anywhere else.

It carries that warning at the top of the file as well as here, because it is the file in
this repository most likely to be copied by someone who assumed the framework's isolation
came along with it.

```bash
grep -rn "DEMO-ONLY" src/
```

finds every compromise in the repository, each with its reason.
