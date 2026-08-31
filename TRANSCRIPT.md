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

## Challenge 2 — Same request, different answers

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
      "createdAt": "2026-08-31T03:26:33.828Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
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
      "createdAt": "2026-08-31T03:26:33.828Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
      "tenantId": 3
    }
  ],
  "meta": {
    "requestId": "ae79caa2-ce81-4a53-b3be-0efb1cb458b4",
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
      "createdAt": "2026-08-31T03:26:33.828Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
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
      "createdAt": "2026-08-31T03:26:33.828Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
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
      "createdAt": "2026-08-31T03:26:33.828Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
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
      "createdAt": "2026-08-31T03:26:33.828Z",
      "lastUpdatedById": null,
      "lastUpdatedByDisplayName": "System",
      "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
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

**What this proves.** Alice and Sam differ by exactly one permission — `customapis_admin_timesheets`. Neither the route nor the query changed, and no filtering code exists in the application.

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
    "requestId": "32088d71-e17f-42cf-90be-b363e7e1d82c"
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
    "createdAt": "2026-08-31T03:26:33.828Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "f47f7089-4072-42e1-a07b-35cacd1e22a5"
  }
}
```

> The same id, one permission later.

**What this proves.** Row privacy is the presence of an `owner_id` column. There is no configuration for it and no code in this repo that reads it.

## Challenge 3b — Reach the next department

Tomas manages Front of House. The Kitchen is a sibling department — same company, same location, one step across.

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
    "createdAt": "2026-08-31T03:26:33.828Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "e7e9fc86-1683-4603-b6df-81ff9ec01bc4"
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
    "requestId": "40d88221-1db2-4891-a427-801e92e1b18c"
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
    "createdAt": "2026-08-31T03:26:33.828Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "723dbfb0-2d1c-48fd-92b0-73195047fb4c"
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
    "createdAt": "2026-08-31T03:26:33.828Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "13ef8771-fa4b-4333-914c-69bf5fe9679c"
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
    "createdAt": "2026-08-31T03:26:33.828Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "45152073-8ca3-4651-8c41-53035dc613d8"
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
    "createdAt": "2026-08-31T03:26:33.828Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
    "tenantId": 1
  },
  "meta": {
    "requestId": "5645d806-c346-419a-b379-e87c93fcf660"
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
    "requestId": "aed5f3f9-590a-4c0a-a181-69a02e59838a"
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
    "createdAt": "2026-08-31T03:26:33.828Z",
    "lastUpdatedById": null,
    "lastUpdatedByDisplayName": "System",
    "lastUpdatedAt": "2026-08-31T03:26:33.828Z",
    "tenantId": 2
  },
  "meta": {
    "requestId": "a760a9d6-3176-4221-bbe5-037ae2d3f525"
  }
}
```

> The key works. The row was the problem.

**What this proves.** The id is valid and the row exists. You cannot tell either of those things from the response — and a timesheet reaches its company through four derived joins, not a tenant column.

## Challenge 6 — 403 vs 404 — the security model, in two responses

One key, two refusals, two different codes.

**POST /timesheets/1046/approve** — as Alice Nguyen → **403**

```bash
curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d '{"auditMessage":"looks fine to me"}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets/1046/approve"
```

```json
{
  "error": {
    "code": "permission_denied",
    "message": "Permission denied for this operation.",
    "requestId": "14449b12-db9f-4582-9af1-530301798f0d"
  }
}
```

> Alice holds no approve permission at all — decided from one check, before any row is loaded.

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
    "requestId": "fb4a3950-9f2b-43e5-a77a-093160af967c"
  }
}
```

> Alice holds read permission. This row is not hers.

**What this proves.** **403 means the permission is missing. 404 means everything else** — not yours, not your department, not your company, never existed. All four are the same response, so the boundary cannot be mapped by probing it.

## Challenge 7 — Do the write you should

Approval is a real write: in a transaction, on a locked row, audited on commit, and it demands a written reason. **You make the row it acts on**, so nothing here depends on what another visitor did first.

**POST /timesheets** — as Alice Nguyen → **201**

```bash
curl -sS -H "Authorization: Bearer $DEMO_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":81,"workDate":"2026-08-12","startAt":"2026-08-12T07:00:00Z","endAt":"2026-08-12T15:00:00Z","hours":8,"status":"submitted","note":"Shift I am about to have approved"}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets"
```

```json
{
  "data": {
    "id": 5001,
    "employeeId": 81,
    "workDate": "2026-08-12",
    "startAt": "2026-08-12T07:00:00.000Z",
    "endAt": "2026-08-12T15:00:00.000Z",
    "hours": "8.00",
    "status": "submitted",
    "note": "Shift I am about to have approved",
    "createdById": 41,
    "createdByDisplayName": "Alice Nguyen",
    "createdAt": "2026-08-31T03:26:44.691Z",
    "lastUpdatedById": 41,
    "lastUpdatedByDisplayName": "Alice Nguyen",
    "lastUpdatedAt": "2026-08-31T03:26:44.691Z",
    "ownerId": 41,
    "ownerDisplayName": "Alice Nguyen",
    "tenantId": 3
  },
  "meta": {
    "requestId": "4d1de9b5-d4d2-4ad8-821e-d7548eb024f3"
  }
}
```

> Your own row, in the Scratch Sandbox — the only company any key can write to. `ownerId` is stamped from the caller, so it belongs to Alice.

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
    "requestId": "60ba24fd-beeb-4dba-8092-9f1278729e8c"
  }
}
```

> No reason supplied. One line of route config makes this impossible to skip.

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
    "requestId": "b0743be3-faa6-45f2-81bf-9accb0f7b711"
  }
}
```

> Companies A and B are read-only — by permission, not convention. Note the 404: you are not told that writes are disallowed here.

**POST /timesheets/5001/approve** — as Sam Okafor → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  -H "Content-Type: application/json" \
  -d '{"auditMessage":"Checked against the roster; hours match the shift."}' \
  -X POST \
  "https://timesheetdemo.customapis.co/timesheets/5001/approve"
```

```json
{
  "data": {
    "id": 5001,
    "employeeId": 81,
    "workDate": "2026-08-12",
    "startAt": "2026-08-12T07:00:00.000Z",
    "endAt": "2026-08-12T15:00:00.000Z",
    "hours": "8.00",
    "status": "approved",
    "note": "Shift I am about to have approved",
    "ownerId": 41,
    "ownerDisplayName": "Alice Nguyen",
    "createdById": 41,
    "createdByDisplayName": "Alice Nguyen",
    "createdAt": "2026-08-31T03:26:44.691Z",
    "lastUpdatedById": 42,
    "lastUpdatedByDisplayName": "Sam Okafor",
    "lastUpdatedAt": "2026-08-31T03:26:45.086Z",
    "tenantId": 3
  },
  "meta": {
    "requestId": "158ba3f2-9f47-4647-9b87-eebeca42765b"
  }
}
```

> Your row, with a reason. He does not own it — Alice does — so this reaches it only through his owner exemption. The reason is now in the trail forever.

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
    "requestId": "c037eea3-0a84-4fe8-b948-de786f540997"
  }
}
```

> The rule runs inside the transaction on a locked row, so two approvals cannot race.

**What this proves.** The application supplied about ten lines of rule. The transaction, the lock, the audit row and the required reason came from the route declaration.

## Challenge 8 — Show the trail

Every committed change, with the diff and the reason.

**GET /activity?entityType=timesheets** — as Sam Okafor → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_DUTY_MANAGER" \
  "https://timesheetdemo.customapis.co/activity?entityType=timesheets"
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
          "to": "2026-08-31T03:26:45.086Z",
          "from": "2026-08-31T03:26:44.691Z"
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
      "userMessage": "Checked against the roster; hours match the shift.",
      "correlationId": "158ba3f2-9f47-4647-9b87-eebeca42765b",
      "userAgentRequestId": null,
      "context": {},
      "createdAt": "2026-08-31T03:26:45.069Z"
    }
  ],
  "meta": {
    "requestId": "1a375864-c371-49ed-8ac1-72c55095b0b1",
    "page": {
      "limit": 25,
      "offset": 0
    }
  }
}
```

> The approval, its field-level diff, and the reason it required.

**GET /activity?entityType=timesheets** — as Omar Haddad → **200**

```bash
curl -sS -H "Authorization: Bearer $DEMO_KESTREL_PAYROLL" \
  "https://timesheetdemo.customapis.co/activity?entityType=timesheets"
```

```json
{
  "data": [],
  "meta": {
    "requestId": "bafc9783-b0ba-4a87-bbb7-8ab842a49149",
    "page": {
      "limit": 25,
      "offset": 0
    }
  }
}
```

> Kestrel sees an empty trail. The audit API is tenant-scoped like everything else.

**What this proves.** `/activity` is an ordinary search route on a framework-shipped model — filters, paging, tenant scoping and documentation all inherited. **The audit API is not a special case.**

## Challenge 9 — Read the documentation your key can see

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

