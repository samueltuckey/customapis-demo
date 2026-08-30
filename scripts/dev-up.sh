#!/usr/bin/env bash
# Bring the demo up from nothing: Postgres, schema, seed, API.
#
# Safe to re-run — it recreates the schema and reseeds every time, which is the point:
# the demo's challenges are stateful (approving a timesheet is one-shot by design), so
# a known starting state is worth more than preserving whatever the last run did.
set -euo pipefail

CONTAINER=${DEMO_DB_CONTAINER:-customapis_demo_db}
PORT=${DEMO_DB_PORT:-55432}
PSQL="docker exec -i $CONTAINER psql -U demo -d customapis_demo -q -v ON_ERROR_STOP=1"

echo "==> Postgres"
if [ -z "$(docker ps -q -f name="^${CONTAINER}$")" ]; then
  if [ -n "$(docker ps -aq -f name="^${CONTAINER}$")" ]; then
    docker start "$CONTAINER" >/dev/null
    echo "    started existing container $CONTAINER"
  else
    docker run -d --name "$CONTAINER" \
      -e POSTGRES_PASSWORD=demo -e POSTGRES_USER=demo -e POSTGRES_DB=customapis_demo \
      -p "${PORT}:5432" postgres:16 >/dev/null
    echo "    created container $CONTAINER on :${PORT}"
  fi
else
  echo "    already running"
fi

# Wait for a REAL query against the target database, not `pg_isready`. On a cold
# container pg_isready reports ready while initdb is still creating the database, so a
# script that trusts it races and fails on the first statement.
printf "    waiting"
ready=""
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" psql -U demo -d customapis_demo -c 'SELECT 1' >/dev/null 2>&1; then
    ready=1; break
  fi
  printf "."; sleep 1
done
[ -n "$ready" ] || { echo; echo "Postgres did not become ready in 60s"; exit 1; }
echo " ready"

echo "==> Schema"
$PSQL < db/schema.sql 2>&1 | grep -v NOTICE || true
echo "==> Audit table (framework infrastructure)"
# APPLIED from the committed file, never regenerated here. `db/audit_log.sql` and
# `src/model/` are generated output that is checked in; rewriting them on every bring-up
# dirtied the tree after an ordinary `npm run dev`, and the deploy refuses a dirty tree.
# `npm run generate` regenerates both, deliberately.
$PSQL < db/audit_log.sql >/dev/null
echo "==> Seed"
$PSQL < db/seed.sql >/dev/null

echo
echo "Ready. Start the API with:  npm start"
echo "  API      http://localhost:3000"
echo "  Keys     http://localhost:3000/keys      (public — start here)"
echo "  Docs     http://localhost:3000/docs.md   (add ?key=… for one persona's view)"
echo "  Events   ws://localhost:3000/events/live"
