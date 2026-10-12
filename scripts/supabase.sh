#!/usr/bin/env bash
#
# Thin wrapper around the Supabase CLI that reads the project ref, DB password
# and access token from .env.local, so none of them have to be typed (or end up
# in shell history).
#
#   pnpm sb:link             link this folder to the hosted project
#   pnpm db:push             apply supabase/migrations to the hosted database
#   pnpm functions:deploy    deploy every function in supabase/functions
#   pnpm functions:secrets   upload supabase/functions/.env as function secrets
#   pnpm types:gen           regenerate lib/database.types.ts from the live schema
#   pnpm deploy:supabase     link + db push + functions deploy, in that order
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

functions_deploy() {
  # No name = every function under supabase/functions (folders starting with
  # `_` are shared code and skipped). `--use-api` bundles server-side, so Docker
  # is not needed.
  supabase functions deploy "$@" --project-ref "$REF" --use-api
}

functions_secrets() {
  if [ ! -f supabase/functions/.env ]; then
    echo "supabase/functions/.env not found (copy supabase/functions/.env.example)" >&2
    exit 1
  fi
  supabase secrets set --env-file supabase/functions/.env --project-ref "$REF"
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
  functions-deploy)  functions_deploy "$@" ;;
  functions-secrets) functions_secrets ;;
  types)             types_gen ;;
  all)               link && db_push && functions_deploy ;;
  *)
    echo "usage: scripts/supabase.sh {link|db-push|functions-deploy [name]|functions-secrets|types|all}" >&2
    exit 1
    ;;
esac
