# Reporting a security issue

This project publishes credentials and invites you to attack the API with them. That is the point,
so the bar for "a security issue" here is narrower than usual — and one category matters far more
than the rest.

## The one that matters

**A key reaching data it should not.** A row belonging to another company, a `costRate` on a key
without `customapis_read_cost_rate`, an approval landing outside your write scope, a refusal that
discloses whether a record exists. Tenant isolation and the 403/404 disclosure rule are the two
things in this demo that are *not* demo-grade — they are the framework behaving exactly as it would
in production. If you break one, you have found a real bug in a product, not a rough edge in a
sandbox.

**Email <security@customapis.co>.** Please include:

- the request — method, path, and which persona's key (the persona name, not the key itself)
- the `x-api-request-id` response header, which is exposed to browsers for exactly this
- what you got, and what you expected instead

Please don't open a public issue for this category. Everything is synthetic data, so there is no
user to protect — the ask is only that there is time to fix it before it is a talking point.

Expect a reply within three working days. This is a small project run by one person; there is no
bounty, and there is genuine gratitude.

## Not security issues

These are all working as designed, and each is marked `DEMO-ONLY` in the source with its reason —
`grep -rn "DEMO-ONLY" src/ db/` finds every one:

- **The keys are public.** `GET /keys` serves them to anyone, unauthenticated. They rotate every
  two hours because a scraped key should die on its own, not because they are secret.
- **The HMAC secret is in the source.** Hiding it would not make published keys any less published.
- **`Access-Control-Allow-Origin: *`**, on an API that accepts writes. Deliberate: every key is
  public and every row is synthetic.
- **The event socket broadcasts every event to every listener, unscoped.** The single most
  dangerous thing in the repository to copy, which is why it says so at the top of the file.
- **Anyone can write to the Scratch Sandbox.** It is shared, and it rebuilds daily.

## Not a security issue, and not a bug

`npm install` fails. The framework is not published; see the README.
