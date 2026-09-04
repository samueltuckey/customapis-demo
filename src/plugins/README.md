# `src/plugins` — real seams, working implementations

These are the framework's **pluggable seams**: the places pgrm deliberately has no
opinion, and hands the decision to the application. The interfaces are the real ones, and
a production system implements exactly these. So does this one — every file here is a
working implementation rather than a mock. These plugins were built for demo purposes, not a
production api, and each carries a `DEMO-ONLY` block describing the decisions made for the demo.

Read those blocks. These three files are where the demo looks most like an application,
which is also where copying it without reading would cost the most.

| File | The seam | What a real system does instead |
|---|---|---|
| `getIdentityUser.ts` | **Verify** the credential | Verifies a JWT against your IdP's JWKS, or a session id against your store |
| `getAppUser.ts` | **Resolve** the principal + permissions | **Calls your Access Management system.** See below — this is the important one |
| `publisher.ts` | **Publish** committed events | Hands them to a broker. No-op by default, so this seam is optional in a way the other two are not |

**The two auth files are the whole integration surface**, and their shapes are the
production shapes. What they *call* is the fake part, and it lives in
[`../demo/`](../demo/README.md) — `keys.ts` instead of an IdP, `personas.json` instead of
your access-management service. The arrow between the two folders is the boundary.

`publisher.ts` is different in kind: nothing behind it is faked, because it *is* the
implementation. What it writes to — a table and an in-process socket — is sized for a demo,
and the DEMO-ONLY block says exactly how. Shape yours for a broker; the seam is identical.

## Authentication is two steps, and they are two files

Worth understanding before reading either, because the split is the design:

- **`getIdentityUser.ts` proves the credential.** Runs on *every* request, never cached —
  an expired credential has to stop working when it expires, not when a cache entry ages
  out. It answers one question: is this genuine, and whose is it. No database, no
  permissions. It also classifies *why* verification failed (`expired`,
  `invalid_signature`, `malformed`, `no_credential`), which is what lets an operator tell
  clients-not-refreshing from someone-guessing. The reason reaches the log; the caller
  gets a uniform 401 — except `expired`, which is safe to disclose and tells an agent to
  re-fetch `/keys`.
- **`getAppUser.ts` resolves it.** Receives the *verified* subject, so it never reads a
  header and cannot be fooled by one. Cached against `(provider, subject)`, which means a
  rotated key reuses the entry rather than re-paying for the lookup.

## `getAppUser.ts` — the one to read carefully

This is the only place in the application where authorization is decided, and its shape
is genuinely the production shape: pgrm hands it the boot-known **manifest** of every
permission any route can ask about, and it answers, for each one, *which companies does
this caller hold it in* — optionally narrowed to a subtree of the tenant path. One round
trip per request; everything after it is answered from memory.

**In a real deployment that function calls your Access Management service.** The
permissions, the tenants and the path restrictions come back over the wire from the
system that already owns roles and grants. That is the whole integration: one function,
one call, plain data.

**In this demo it answers from `personas.json`**, because there is no IAM to call and five
fictional people to represent. That separation is deliberate: the fixture is *data*, and
keeping it out of the source means `getAppUser.ts` is more concise — read the bearer token,
resolve the persona, map the manifest to grants. What is left in the file is the whole
integration.

Everything in `personas.json` outside a persona's `demo` block is the shape an access
management system returns. The `demo` block — `cannot`, `tryThis` — is page furniture for
`GET /me`, and has no equivalent in a real system.

What it demonstrates that is real, and worth taking away:

- **Permissions are scoped per permission, not per user.** Alice *reads* Harbourline and
  *writes* only to the sandbox, because those are two different grants. That is what makes
  "companies A and B are read-only" a fact about permissions rather than a rule someone
  has to remember.
- **There is no wildcard.** A grant is always a finite list of places. "All tenants"
  cannot be expressed, so it cannot be granted by accident.
- **One permission is the whole difference between two personas** — `customapis_admin_timesheets`
  separates the employee from the duty manager, and one `restrictions` entry separates
  the duty manager from the department manager.

## Everything marked `DEMO-ONLY`

Each file carries markers on the parts that are deliberately wrong for production, with
the reason. `grep -rn "DEMO-ONLY" src/` finds every one. The most important is in
`publisher.ts`, and it is not about scale: the framework scopes queries against a
*caller*, and a broadcast socket has no caller, so nothing scopes it. In a shared sandbox
of synthetic data that is fine. Anywhere else it is a tenant breach.
