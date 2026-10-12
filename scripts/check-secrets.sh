#!/usr/bin/env bash
#
# Fails the build if the secret key leaks into code that ships to the browser.
#
# `lib/supabase/admin.ts` is the only module allowed to touch SUPABASE_SECRET_KEY,
# and only server code (route handlers, server actions) may import it.
set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

# Every "use client" module, plus components/, is client-reachable.
client_files=$(
  {
    grep -rlE --include='*.ts' --include='*.tsx' '^["'"'"']use client["'"'"']' \
      app components lib 2>/dev/null || true
    [ -d components ] && find components -name '*.ts*' || true
  } | sort -u
)

for f in $client_files; do
  if matches=$(grep -n -e 'SECRET_KEY' -e 'supabase/admin' -e 'createAdminClient' -e 'OPENWA_API_KEY' -e 'lib/openwa' -e 'lib/notify' "$f"); then
    echo "Secret-key reference found in client-reachable code: $f"
    echo "$matches"
    FAILED=1
  fi
done

# A NEXT_PUBLIC_ prefix on the secret would inline it into the JS bundle.
if grep -rn 'NEXT_PUBLIC_SUPABASE_SECRET' . \
     --include='*.ts' --include='*.tsx' --include='*.env*' \
     --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=scripts \
     2>/dev/null; then
  echo "SUPABASE_SECRET_KEY must never carry a NEXT_PUBLIC_ prefix"
  FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "check-secrets: FAILED"
  exit 1
fi

echo "check-secrets: ok"
