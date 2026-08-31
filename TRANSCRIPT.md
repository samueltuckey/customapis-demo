# Captured transcript

**Generated, not written.** Every request and response below was captured from a real run against the live API by `scripts/replay.ts`, and every outcome was asserted before this file was produced — if one of them had disagreed, this file would not exist. Regenerate it with `npm run transcript` rather than editing it.

## Start here

The keys rotate every two hours, so none is written down. Load the current set into your shell — this is also the fastest way to learn that the endpoint exists:

```bash
eval "$(curl -sS https://timesheetdemo.customapis.co/keys | jq -r \
  '.data.keys[] | "export DEMO_" + (.persona|ascii_upcase) + "=" + .key')"
```

| Persona | Shell variable | Sees |
|---|---|---|
| Alice Nguyen | `$DEMO_EMPLOYEE` | Sees only the timesheets she owns |
| Sam Okafor | `$DEMO_DUTY_MANAGER` | Sees everyone's timesheets in Company A; approvals land in the shared sandbox |
| Tomas Ferreira | `$DEMO_DEPARTMENT_MANAGER` | Sees everyone's timesheets, but only in Front of House |
| Priya Raman | `$DEMO_PAYROLL` | Everything in Company A, including cost rates and invoices |
| Omar Haddad | `$DEMO_KESTREL_PAYROLL` | Everything in Company B, and nothing at all from Company A |

## Challenge 1 — Who am I?

Every key answers the same question differently. `/me` reports the identity, the companies in scope, the permissions held — and, unusually, what the key will be **refused**.

**GET /me** — as Alice Nguyen → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  "https://timesheetdemo.customapis.co/me"
```

```json
{
  "data": {
    "identity": {
      "name": "Alice Nguyen",
      "kind": "human",
      "actorId": 41
    },
    "company": {
      "id": 1,
      "name": "Harbourline Hospitality"
    },
    "scope": {
      "companies": [
        1,
        3
      ],
      "writeCompanies": [
        3
      ],
      "writes": "your writes land only in the shared Scratch Sandbox (company 3); the curated companies are read-only, so a write there is a 404",
      "writeEmployeeId": 81,
      "departments": "all departments in your companies",
      "rows": "owner-scoped: you see only timesheets you own"
    },
    "can": [
      {
        "permission": "customapis_create_timesheets",
        "plain": "Submit a new timesheet"
      },
      {
        "permission": "customapis_get_employees",
        "plain": "Read an employee by id"
      },
      {
        "permission": "customapis_get_timesheets",
        "plain": "Read a timesheet by id"
      },
      {
        "permission": "customapis_read_activity",
        "plain": "Read your company's audit trail"
      },
      {
        "permission": "customapis_search_employees",
        "plain": "List employees"
      },
      {
        "permission": "customapis_search_timesheets",
        "plain": "List timesheets"
      }
    ],
    "cannot": [
      {
        "plain": "See a colleague's timesheet",
        "why": "owner scope",
        "expec
  … truncated for the page
```

> The `cannot` array is a pre-commitment. Everything in it is attempted below.

**GET /me** — as Tomas Ferreira → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DEPARTMENT_MANAGER" \
  "https://timesheetdemo.customapis.co/me"
```

```json
{
  "data": {
    "identity": {
      "name": "Tomas Ferreira",
      "kind": "human",
      "actorId": 47
    },
    "company": {
      "id": 1,
      "name": "Harbourline Hospitality"
    },
    "scope": {
      "companies": [
        1,
        3
      ],
      "writeCompanies": [
        3
      ],
      "writes": "your writes land only in the shared Scratch Sandbox (company 3); the curated companies are read-only, so a write there is a 404",
      "writeEmployeeId": 81,
      "departments": [
        "8"
      ],
      "rows": "you see every timesheet within your scope, not just your own"
    },
    "can": [
      {
        "permission": "customapis_admin_timesheets",
        "plain": "See other people's timesheets, not just your own"
      },
      {
        "permission": "customapis_create_timesheets",
        "plain": "Submit a new timesheet"
      },
      {
        "permission": "customapis_get_employees",
        "plain": "Read an employee by id"
      },
      {
        "permission": "customapis_get_timesheets",
        "plain": "Read a timesheet by id"
      },
      {
        "permission": "customapis_read_activity",
        "plain": "Read your company's audit trail"
      },
      {
        "permission": "customapis_search_employees",
        "plain": "List employees"
      },
      {
        "permission": "customapis_search_timesheets",
        "plain": "List ti
  … truncated for the page
```

> The department manager reports a narrowed scope; every other persona reports "all departments".

**What this proves.** The server publishes its own limits. An agent reads `cannot` to know what to attempt, which is how this demo generates refusals instead of role-play.

## Challenge 2 — Same search request, different results for each user's access

One unchanged request — `GET /timesheets` — sent by three keys in the same company.

**GET /timesheets** — as Alice Nguyen → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  "https://timesheetdemo.customapis.co/timesheets"
```

```json
{
  "data": [
    {
      "id": 1041,
      "employeeId": 77,
      "workDate": "2026-08-10",
      "startAt": "2026-08-10T07:00:00.000Z",
      "endAt": "2026-08-10T15:00:00.000Z",
      "hours": "8.00",
      "status": "submitted",
      "note": "Morning service",
      "ownerId": 41,
      "ownerDisplayName": "Alice Nguyen",
      "createdById": null,
      "createdByDisplayName": "System",
      "createdAt": "2026-08-31T04:51:04.143Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
      "tenantId": 1
    },
    {
      "id": 1046,
      "employeeId": 81,
      "workDate": "2026-08-12",
      "startAt": "2026-08-12T07:00:00.000Z",
      "endAt": "2026-08-12T15:00:00.000Z",
      "hours": "8.00",
      "status": "submitted",
      "note": "Sandbox shift",
      "ownerId": 41,
      "ownerDisplayName": "Alice Nguyen",
      "createdById": null,
      "createdByDisplayName": "System",
      "createdAt": "2026-08-31T04:51:04.143Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
      "tenantId": 3
    }
  ],
  "meta": {
    "requestId": "05cc5743-0c51-4716-a789-0c2fa23dae72",
    "page": {
      "limit": 25,
      "offset": 0
    }
  }
}
```

> Alice: only rows she owns — however many the sandbox has accumulated.

**GET /timesheets** — as Sam Okafor → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  "https://timesheetdemo.customapis.co/timesheets"
```

```json
{
  "data": [
    {
      "id": 1041,
      "employeeId": 77,
      "workDate": "2026-08-10",
      "startAt": "2026-08-10T07:00:00.000Z",
      "endAt": "2026-08-10T15:00:00.000Z",
      "hours": "8.00",
      "status": "submitted",
      "note": "Morning service",
      "ownerId": 41,
      "ownerDisplayName": "Alice Nguyen",
      "createdById": null,
      "createdByDisplayName": "System",
      "createdAt": "2026-08-31T04:51:04.143Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
      "tenantId": 1
    },
    {
      "id": 1042,
      "employeeId": 78,
      "workDate": "2026-08-10",
      "startAt": "2026-08-10T15:00:00.000Z",
      "endAt": "2026-08-10T23:00:00.000Z",
      "hours": "8.00",
      "status": "submitted",
      "note": "Evening service",
      "ownerId": 45,
      "ownerDisplayName": "Ben Carter",
      "createdById": null,
      "createdByDisplayName": "System",
      "createdAt": "2026-08-31T04:51:04.143Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
      "tenantId": 1
    },
    {
      "id": 1044,
      "employeeId": 79,
      "workDate": "2026-08-11",
      "startAt": "2026-08-11T09:00:00.000Z",
      "endAt": "2026-08-11T17:00:00.000Z",
      "hours": "8.00",
      "status": "approved",
   
  … truncated for the page
```

> Sam: everyone's, across every department.

**GET /timesheets** — as Priya Raman → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_PAYROLL" \
  "https://timesheetdemo.customapis.co/timesheets"
```

```json
{
  "data": [
    {
      "id": 1041,
      "employeeId": 77,
      "workDate": "2026-08-10",
      "startAt": "2026-08-10T07:00:00.000Z",
      "endAt": "2026-08-10T15:00:00.000Z",
      "hours": "8.00",
      "status": "submitted",
      "costRate": "42.50",
      "note": "Morning service",
      "ownerId": 41,
      "ownerDisplayName": "Alice Nguyen",
      "createdById": null,
      "createdByDisplayName": "System",
      "createdAt": "2026-08-31T04:51:04.143Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
      "tenantId": 1
    },
    {
      "id": 1042,
      "employeeId": 78,
      "workDate": "2026-08-10",
      "startAt": "2026-08-10T15:00:00.000Z",
      "endAt": "2026-08-10T23:00:00.000Z",
      "hours": "8.00",
      "status": "submitted",
      "costRate": "39.00",
      "note": "Evening service",
      "ownerId": 45,
      "ownerDisplayName": "Ben Carter",
      "createdById": null,
      "createdByDisplayName": "System",
      "createdAt": "2026-08-31T04:51:04.143Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
      "tenantId": 1
    },
    {
      "id": 1044,
      "employeeId": 79,
      "workDate": "2026-08-11",
      "startAt": "2026-08-11T09:00:00.000Z",
      "endAt": "2026-08-11T17:00:00.000Z",

  … truncated for the page
```

> Payroll: the same rows as Sam, plus `costRate`.

**What this proves.** On this endpoint the whole difference is one permission: `customapis_admin_timesheets` is what turns "your timesheets" into everyone's. Sam holds one other that Alice does not — `customapis_update_timesheets` — and it only matters when he approves something. Neither the route nor the query changed, and no filtering code exists in the application.

## Challenge 3 — Reach your colleague's row

Alice and Ben are in the same company and the same department. Only `owner_id` separates their timesheets.

**GET /timesheets/1042** — as Alice Nguyen → **404**

```bash
curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  "https://timesheetdemo.customapis.co/timesheets/1042"
```

```json
{
  "error": {
    "code": "not_found",
    "message": "Not found.",
    "requestId": "38eb2593-ee1d-4aa0-966e-ed02ca855600"
  }
}
```

> Alice has read permission. The row simply isn't hers.

**GET /timesheets/1042** — as Sam Okafor → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  "https://timesheetdemo.customapis.co/timesheets/1042"
```

```json
{
  "data": {
    "id": 1042,
    "employeeId": 78,
    "workDate": "2026-08-10",
    "startAt": "2026-08-10T15:00:00.000Z",
    "endAt": "2026-08-10T23:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "note": "Evening service",
    "ownerId": 45,
    "ownerDisplayName": "Ben Carter",
    "createdById": null,
    "createdByDisplayName": "System",
    "createdAt": "2026-08-31T04:51:04.143Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "f6383e57-939b-4398-ae37-795c6cdbfae4"
  }
}
```

> The same id, one permission later.

**What this proves.** Row privacy is the presence of an `owner_id` column. There is no configuration for it and no code in this repo that reads it.

## Challenge 3b — Reach the next department

Tomas manages Front of House. The Kitchen is a sibling department — same company, same location, one step across. (Numbered `3b` because it was added after the others: the anchors are deep-linked from published copy, and renumbering would silently break them.)

**GET /timesheets/1041** — as Tomas Ferreira → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DEPARTMENT_MANAGER" \
  "https://timesheetdemo.customapis.co/timesheets/1041"
```

```json
{
  "data": {
    "id": 1041,
    "employeeId": 77,
    "workDate": "2026-08-10",
    "startAt": "2026-08-10T07:00:00.000Z",
    "endAt": "2026-08-10T15:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "note": "Morning service",
    "ownerId": 41,
    "ownerDisplayName": "Alice Nguyen",
    "createdById": null,
    "createdByDisplayName": "System",
    "createdAt": "2026-08-31T04:51:04.143Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "6d040a8f-7041-4497-9225-4614c60e3197"
  }
}
```

> Front of House: fine.

**GET /timesheets/1045** — as Tomas Ferreira → **404**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DEPARTMENT_MANAGER" \
  "https://timesheetdemo.customapis.co/timesheets/1045"
```

```json
{
  "error": {
    "code": "not_found",
    "message": "Not found.",
    "requestId": "2f6061b6-23ca-4011-b1c3-5f878dacc831"
  }
}
```

> The Kitchen: nothing. Same company, same location.

**GET /timesheets/1045** — as Sam Okafor → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  "https://timesheetdemo.customapis.co/timesheets/1045"
```

```json
{
  "data": {
    "id": 1045,
    "employeeId": 82,
    "workDate": "2026-08-11",
    "startAt": "2026-08-11T05:00:00.000Z",
    "endAt": "2026-08-11T13:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "note": "Breakfast prep",
    "ownerId": 46,
    "ownerDisplayName": "Nadia Rahman",
    "createdById": null,
    "createdByDisplayName": "System",
    "createdAt": "2026-08-31T04:51:04.143Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "c71b794c-7e72-4638-8763-811cc3984558"
  }
}
```

> Sam, who holds no department restriction, reads it.

**What this proves.** The restriction names a department, but `timesheet` has no department column — its department is two joins away, on the path to the company. The scope narrowed in the middle of a relational path that the framework derived.

## Challenge 4 — Field visibility

The same record, fetched by two keys in the same company.

**GET /timesheets/1041** — as Priya Raman → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_PAYROLL" \
  "https://timesheetdemo.customapis.co/timesheets/1041"
```

```json
{
  "data": {
    "id": 1041,
    "employeeId": 77,
    "workDate": "2026-08-10",
    "startAt": "2026-08-10T07:00:00.000Z",
    "endAt": "2026-08-10T15:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "costRate": "42.50",
    "note": "Morning service",
    "ownerId": 41,
    "ownerDisplayName": "Alice Nguyen",
    "createdById": null,
    "createdByDisplayName": "System",
    "createdAt": "2026-08-31T04:51:04.143Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "0a1f5d2a-ba60-4995-ac04-70a01e165750"
  }
}
```

> Payroll sees `costRate`.

**GET /timesheets/1041** — as Sam Okafor → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  "https://timesheetdemo.customapis.co/timesheets/1041"
```

```json
{
  "data": {
    "id": 1041,
    "employeeId": 77,
    "workDate": "2026-08-10",
    "startAt": "2026-08-10T07:00:00.000Z",
    "endAt": "2026-08-10T15:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "note": "Morning service",
    "ownerId": 41,
    "ownerDisplayName": "Alice Nguyen",
    "createdById": null,
    "createdByDisplayName": "System",
    "createdAt": "2026-08-31T04:51:04.143Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "e157d3bf-edc6-44b1-a7a7-c1bfaa63daa1"
  }
}
```

> Sam does not. Compare the two bodies: the field is **absent**, not null.

**What this proves.** A hidden field and an unset field are indistinguishable on the wire, so the absence itself discloses nothing.

## Challenge 5 — Cross-company

Timesheet 1041 belongs to Harbourline. Ids come from one global sequence, so it belongs to exactly one company in the whole deployment.

**GET /timesheets/1041** — as Priya Raman → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_PAYROLL" \
  "https://timesheetdemo.customapis.co/timesheets/1041"
```

```json
{
  "data": {
    "id": 1041,
    "employeeId": 77,
    "workDate": "2026-08-10",
    "startAt": "2026-08-10T07:00:00.000Z",
    "endAt": "2026-08-10T15:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "costRate": "42.50",
    "note": "Morning service",
    "ownerId": 41,
    "ownerDisplayName": "Alice Nguyen",
    "createdById": null,
    "createdByDisplayName": "System",
    "createdAt": "2026-08-31T04:51:04.143Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "1d34b14d-0765-4ef3-8001-056cddd26408"
  }
}
```

> Harbourline payroll: the record.

**GET /timesheets/1041** — as Omar Haddad → **404**

```bash
curl -sS -H "Authorization: Bearer $DEMO_KESTREL_PAYROLL" \
  "https://timesheetdemo.customapis.co/timesheets/1041"
```

```json
{
  "error": {
    "code": "not_found",
    "message": "Not found.",
    "requestId": "77c656ff-9acf-432f-9bd1-621ec47e628b"
  }
}
```

> Kestrel payroll: nothing. Identical permissions, different company.

**GET /timesheets/1043** — as Omar Haddad → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_KESTREL_PAYROLL" \
  "https://timesheetdemo.customapis.co/timesheets/1043"
```

```json
{
  "data": {
    "id": 1043,
    "employeeId": 80,
    "workDate": "2026-08-10",
    "startAt": "2026-08-10T06:00:00.000Z",
    "endAt": "2026-08-10T14:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "costRate": "37.25",
    "note": "Depot clean",
    "ownerId": null,
    "ownerDisplayName": "System",
    "createdById": null,
    "createdByDisplayName": "System",
    "createdAt": "2026-08-31T04:51:04.143Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T04:51:04.143Z",
    "tenantId": 2
  },
  "meta": {
    "requestId": "c1d11490-6d91-4b81-95f9-0d65930e5307"
  }
}
```

> The key works. The row was the problem.

**What this proves.** The id is valid and the row exists. You cannot tell either of those things from the response — and a timesheet reaches its company through four derived joins, not a tenant column.

## Challenge 6 — Read the documentation your key can see

The API documents itself, generated from the same route registry that serves the requests — so it cannot drift. What it shows you depends on who is asking.

**GET /openapi.json** — as no key at all → **200**

```bash
curl -sS \
  "https://timesheetdemo.customapis.co/openapi.json"
```

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "Custom APIs — timesheet demo",
    "version": "1.0.0",
    "description": "You are seeing the PUBLIC view: every route this API exposes, whether or not you could call it. To see **your own** documentation — only the routes your key can call — append `?key=<your key>` to this URL, or send it as a bearer token. Get a key from `GET /keys`; it is public and needs no signup. The two views are worth diffing: what disappears is what that key is not allowed to do.\n\nGenerated from the live route registry on every request."
  },
  "security": [
    {
      "bearerAuth": []
    }
  ],
  "paths": {
    "/timesheets": {
      "get": {
        "operationId": "search_timesheets",
        "summary": "SEARCH timesheets",
        "tags": [
          "timesheets"
        ],
        "responses": {
          "200": {
            "description": "Search results with pagination meta (§4.11, §8.4).",
            "headers": {
              "x-api-request-id": {
                "$ref": "#/components/headers/RequestId"
              },
              "x-ua-request-id": {
                "$ref": "#/components/headers/ClientRequestIdEcho"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas
  … truncated for the page
```

> No credential. The **full** surface — every route this API exposes. Note that this is deliberate: a permission-filtered spec fetched without a key returns an empty document, and a real evaluator once concluded the API had no endpoints.

**GET /openapi.json** — as Alice Nguyen → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  "https://timesheetdemo.customapis.co/openapi.json"
```

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "Custom APIs — timesheet demo",
    "version": "1.0.0",
    "description": "You are seeing the view for Alice Nguyen (`employee`): only the routes this key can actually call. Routes it cannot call are omitted entirely — a consumer cannot be tempted by an endpoint it would be refused. Drop the `?key=` parameter to see the full public surface instead.\n\nGenerated from the live route registry on every request."
  },
  "security": [
    {
      "bearerAuth": []
    }
  ],
  "paths": {
    "/timesheets": {
      "get": {
        "operationId": "search_timesheets",
        "summary": "SEARCH timesheets",
        "tags": [
          "timesheets"
        ],
        "responses": {
          "200": {
            "description": "Search results with pagination meta (§4.11, §8.4).",
            "headers": {
              "x-api-request-id": {
                "$ref": "#/components/headers/RequestId"
              },
              "x-ua-request-id": {
                "$ref": "#/components/headers/ClientRequestIdEcho"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
       
  … truncated for the page
```

> Alice's view. No invoices, no approve — she holds neither permission.

**GET /openapi.json** — as Priya Raman → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_PAYROLL" \
  "https://timesheetdemo.customapis.co/openapi.json"
```

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "Custom APIs — timesheet demo",
    "version": "1.0.0",
    "description": "You are seeing the view for Priya Raman (`payroll`): only the routes this key can actually call. Routes it cannot call are omitted entirely — a consumer cannot be tempted by an endpoint it would be refused. Drop the `?key=` parameter to see the full public surface instead.\n\nGenerated from the live route registry on every request."
  },
  "security": [
    {
      "bearerAuth": []
    }
  ],
  "paths": {
    "/timesheets": {
      "get": {
        "operationId": "search_timesheets",
        "summary": "SEARCH timesheets",
        "tags": [
          "timesheets"
        ],
        "responses": {
          "200": {
            "description": "Search results with pagination meta (§4.11, §8.4).",
            "headers": {
              "x-api-request-id": {
                "$ref": "#/components/headers/RequestId"
              },
              "x-ua-request-id": {
                "$ref": "#/components/headers/ClientRequestIdEcho"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
         
  … truncated for the page
```

> Payroll gets invoices back and still no approve. Diff the three.

**What this proves.** A consumer cannot be tempted by an endpoint it would be refused, because it never sees one. The docs are a projection of the same permissions the pipeline enforces — and `?key=` is how any caller gets their own copy.

## The write sequence — Do the write, on a row you make

Seven steps in order, against **a row step 1 creates for you**. Approval is a real write — in a transaction, on a locked row, audited on commit, and it demands a written reason — and it can happen to a row exactly once. So the sequence provisions its own row rather than naming one: every visitor gets the same seven statuses, however many times they run it, and nobody has to reseed anything first.

### Step 1 — Make a row of your own

**POST /timesheets** — as Alice Nguyen → **201**

```bash
curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":81,"workDate":"2026-08-31","startAt":"2026-08-31T07:00:00Z","endAt":"2026-08-31T15:00:00Z","hours":8,"status":"submitted","note":"Shift I am about to have approved"}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets"
```

```json
{
  "data": {
    "id": 5001,
    "employeeId": 81,
    "workDate": "2026-08-31",
    "startAt": "2026-08-31T07:00:00.000Z",
    "endAt": "2026-08-31T15:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "note": "Shift I am about to have approved",
    "createdById": 41,
    "createdByDisplayName": "Alice Nguyen",
    "createdAt": "2026-08-31T04:51:14.775Z",
    "lastUpdatedById": 41,
    "lastUpdatedByDisplayName": "Alice Nguyen",
    "lastUpdatedAt": "2026-08-31T04:51:14.775Z",
    "ownerId": 41,
    "ownerDisplayName": "Alice Nguyen",
    "tenantId": 3
  },
  "meta": {
    "requestId": "648cf442-e11a-4e7e-9605-d25e91a6e5d4"
  }
}
```

> Your own row, in the Scratch Sandbox — the only company any key can write to. `ownerId` is stamped by the server from the caller, so you cannot claim to be someone else by sending it. **Every step below uses the id this returns.**

### Step 2 — Approve it as the person who wrote it

**POST /timesheets/5001/approve** — as Alice Nguyen → **403**

```bash
curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d '{"auditMessage":"looks fine to me"}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets/5001/approve"
```

```json
{
  "error": {
    "code": "permission_denied",
    "message": "Permission denied for this operation.",
    "requestId": "63be02f4-d3aa-4f1b-8113-bb8a9859ac47"
  }
}
```

> The only 403 in the demo. Alice holds no approve permission at all, so the refusal is decided before any row is loaded — it is about her, not about the row.

### Step 3 — Approve it without saying why

**POST /timesheets/5001/approve** — as Sam Okafor → **400**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets/5001/approve"
```

```json
{
  "error": {
    "code": "audit_message_required",
    "message": "A \"auditMessage\" is required for this operation.",
    "requestId": "fbf4c4c8-158b-47fa-901b-36ab41ce05d6"
  }
}
```

> A written reason is not optional, and it is not application code — one line of route config makes it mandatory.

### Step 4 — Approve a row you can only read

**POST /timesheets/1041/approve** — as Sam Okafor → **404**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  -H "Content-Type: application/json" \
  -d '{"auditMessage":"Approving a Harbourline row."}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets/1041/approve"
```

```json
{
  "error": {
    "code": "not_found",
    "message": "Not found.",
    "requestId": "d347da94-1e65-4259-9fe0-afc105703e2f"
  }
}
```

> Timesheet 1041 is in Harbourline — **Sam's own company**, and he reads it fine in challenge 4. The curated companies are read-only for every key, so the write is refused. Note the 404, not a 403: the refusal does not admit the row exists.

### Step 5 — Approve it properly

**POST /timesheets/5001/approve** — as Sam Okafor → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  -H "Content-Type: application/json" \
  -d '{"auditMessage":"Checked against the roster; hours match."}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets/5001/approve"
```

```json
{
  "data": {
    "id": 5001,
    "employeeId": 81,
    "workDate": "2026-08-31",
    "startAt": "2026-08-31T07:00:00.000Z",
    "endAt": "2026-08-31T15:00:00.000Z",
    "hours": "8.00",
    "status": "approved",
    "note": "Shift I am about to have approved",
    "ownerId": 41,
    "ownerDisplayName": "Alice Nguyen",
    "createdById": 41,
    "createdByDisplayName": "Alice Nguyen",
    "createdAt": "2026-08-31T04:51:14.775Z",
    "lastUpdatedById": 42,
    "lastUpdatedByDisplayName": "Sam Okafor",
    "lastUpdatedAt": "2026-08-31T04:51:15.114Z",
    "tenantId": 3
  },
  "meta": {
    "requestId": "bdc96e1a-60a1-4b6c-8927-73a99c665760"
  }
}
```

> The row is Alice's, so Sam reaches it only through his owner exemption. In a transaction, on a locked row, audited on commit. The reason is in the trail forever.

### Step 6 — Approve it twice

**POST /timesheets/5001/approve** — as Sam Okafor → **409**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  -H "Content-Type: application/json" \
  -d '{"auditMessage":"And again."}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets/5001/approve"
```

```json
{
  "error": {
    "code": "conflict",
    "message": "This timesheet has already been approved.",
    "requestId": "36d603e9-fc34-4252-9f9e-658db99bdeb3"
  }
}
```

> The guard runs inside the same transaction as the write, so two approvals cannot race each other. On your own row this is reproducible on demand.

### Step 7 — Read your own reason back

**GET /activity?entityType=timesheets&entityId=5001** — as Sam Okafor → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  "https://timesheetdemo.customapis.co/activity?entityType=timesheets&entityId=5001"
```

```json
{
  "data": [
    {
      "id": 1,
      "tenantId": 3,
      "partitionValue": 3,
      "entityType": "timesheets",
      "entityId": 5001,
      "action": "update",
      "actorId": 42,
      "actorDisplayName": "Sam Okafor",
      "changes": {
        "status": {
          "to": "approved",
          "from": "submitted"
        },
        "lastUpdatedAt": {
          "to": "2026-08-31T04:51:15.114Z",
          "from": "2026-08-31T04:51:14.775Z"
        },
        "lastUpdatedById": {
          "to": 42,
          "from": "41"
        },
        "lastUpdatedByDisplayName": {
          "to": "Sam Okafor",
          "from": "Alice Nguyen"
        }
      },
      "systemMessage": "update timesheets",
      "userMessage": "Checked against the roster; hours match.",
      "correlationId": "bdc96e1a-60a1-4b6c-8927-73a99c665760",
      "userAgentRequestId": null,
      "context": {},
      "createdAt": "2026-08-31T04:51:15.080Z"
    }
  ],
  "meta": {
    "requestId": "0f52cbce-a73a-4bfb-ba09-f3d31b4c1a52",
    "page": {
      "limit": 25,
      "offset": 0
    }
  }
}
```

> Your reason in the trail, with the field-level diff — not a stranger's. Scoped to your row on purpose: unscoped, the shared sandbox would show other people's.

**What this proves.** The application supplied about ten lines of rule. The transaction, the lock, the audit row and the required reason came from the route declaration. The two refusals differ on purpose: **403 means the permission is missing, 404 means everything else** — not yours, not your department, not your company, never existed. All of those are the same response, so the boundary cannot be mapped by probing it.

