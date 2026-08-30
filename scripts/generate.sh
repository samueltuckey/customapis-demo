#!/usr/bin/env bash
# Regenerate the two things in this repo that are machine-written: the audit table's DDL
# and `src/model/`.
#
# SEPARATE from `dev-up.sh` on purpose. Both outputs are COMMITTED, and regenerating them
# on every bring-up left the working tree dirty after an ordinary `npm run dev` — which
# the deploy then refuses, because it tags the image with the demo's git SHA and a dirty
# tree makes that tag a lie. Run this when the schema changes, and commit what it emits.
set -euo pipefail

PORT=${DEMO_DB_PORT:-55432}

echo "==> db/audit_log.sql (framework infrastructure)"
npx pgrm db sql audit_log 2>/dev/null > db/audit_log.sql

echo "==> src/model/ from the live schema"
npx pgrm generate models --url="postgres://demo:demo@localhost:${PORT}/customapis_demo" --out=src/model 2>&1 | tail -1

echo
git --no-pager diff --stat -- db/audit_log.sql src/model/ || true
echo "Review the diff above and commit it."
