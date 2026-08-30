# `src/model` — generated, not written

**Nothing in this directory was written by hand, and nothing in it should be.**

Every file here is output from:

```bash
npx pgrm generate models --url="$DATABASE_URL" --out=src/model
```

The database is the source of truth. `pgrm generate models` reads the live schema and
emits one Sequelize model per table, plus `index.ts` wiring the associations with the
deterministic `<table>__<fk_column>` alias names the framework expects, plus
`models-cheatsheet.md` and a drift snapshot.

## Why it is generated rather than written

The framework derives a great deal from these models — tenant paths, API field names,
the writable schema, permission strings, filter and sort surfaces, the OpenAPI
projection. Hand-writing them puts a second, editable copy of the schema in the repo,
and the two drift silently — association aliases stop matching, and primary keys get
declared in a way Postgres does not agree with.

So: **change the database, then regenerate.** Never the other way round, and never edit a
file in this directory to make something work — the fix belongs in `db/schema.sql`.

## What that means when you read this code

Some of it looks redundant, and is. `dbDefault({ … }, { expression: "'draft'::text" })`
records that a column *has* a database default without the ORM ever supplying the value,
so the write schema can make the field optional while Postgres still fills it in. That is
the generator being careful about which system owns a value, not belt-and-braces.

The customisation you are looking for is not here. It is in `src/routes/` (what the API
exposes) and `src/plugins/` (how identity, events and keys are resolved).
