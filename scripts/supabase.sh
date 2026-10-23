#!/usr/bin/env bash
#
# Thin wrapper around the Supabase CLI that reads the project ref, DB password
# and access token from .env.local, so none of them have to be typed (or end up
# in shell history).
#
#   pnpm sb:link             link this folder to the hosted project
#   pnpm db:push             apply supabase/migrations to the hosted database
#   pnpm types:gen           regenerate lib/database.types.ts from the live schema
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$REF" ] || [ "$REF" = "your-project-ref" ]; then
  echo "SUPABASE_PROJECT_REF is not set in .env.local" >&2
  exit 1
fi

# Empty values would make the CLI think a token/password was given.
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || unset SUPABASE_ACCESS_TOKEN
[ -n "${SUPABASE_DB_PASSWORD:-}" ] || unset SUPABASE_DB_PASSWORD

link() {
  supabase link --project-ref "$REF" ${SUPABASE_DB_PASSWORD:+--password "$SUPABASE_DB_PASSWORD"}
}

db_push() {
  supabase db push --linked ${SUPABASE_DB_PASSWORD:+--password "$SUPABASE_DB_PASSWORD"} "$@"
}

types_gen() {
  supabase gen types typescript --project-id "$REF" --schema public \
    > lib/database.types.ts
  echo "wrote lib/database.types.ts"
}

cmd="${1:-}"
shift || true

case "$cmd" in
  link)              link ;;
  db-push)           db_push "$@" ;;
  types)             types_gen ;;
  *)
    echo "usage: scripts/supabase.sh {link|db-push|types}" >&2
    exit 1
    ;;
esac
