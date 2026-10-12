# Connecting and deploying to Supabase

Work through this in order. All commands run from the project root.

## 1. Fill in your keys

```bash
cp .env.example .env.local   # already done once; just edit it
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Dashboard → Project Settings → API Keys → *Publishable key* |
| `SUPABASE_SECRET_KEY` | Same page → *Secret keys* (server-only, never `NEXT_PUBLIC_`) |
| `SUPABASE_PROJECT_REF` | Dashboard → Project Settings → General → *Project ID* |
| `SUPABASE_DB_PASSWORD` | The database password (reset it under Settings → Database if unknown) |
| `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens> — or run `supabase login` once and leave it empty |

`NEXT_PUBLIC_*` values are **inlined at build time** — rebuild after changing them.

## 2. Link, push the schema, deploy the functions

```bash
pnpm sb:link            # supabase link --project-ref $SUPABASE_PROJECT_REF
pnpm db:push            # applies supabase/migrations/*.sql
pnpm functions:deploy   # deploys create-member and import-shipments
```

Or all three at once: `pnpm deploy:supabase`.

Deploy a single function: `pnpm functions:deploy import-shipments`.
Preview migrations without applying: `pnpm db:push --dry-run`.

If a function needs its own secrets (API tokens etc.), put them in
`supabase/functions/.env` (see `.env.example` next to it) and run
`pnpm functions:secrets`.

## 3. Create the first admin

```bash
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='a-real-password' \
ADMIN_NAME='Your Name' \
pnpm create:admin
```

Idempotent — re-run it to reset a password or repair a missing profile row.
Further accounts: the `create-member` function (admin only).

## 4. Auth settings in the dashboard

Authentication → URL Configuration: set **Site URL** and **Redirect URLs** to
your production origin.

Authentication → Providers → Email: **turn off "Enable sign ups"**. Accounts
are admin-created; RLS keeps a self-signed-up user out anyway (no `profiles`
row), but there is no reason to leave the door open.

## 5. Run it

```bash
pnpm dev                 # http://localhost:3000
pnpm build && pnpm start # production
```

Sign in as the admin, then import `data/demo order` from the home page — it goes
through the `import-shipments` Edge Function into the `shipments` table.

Production must be served over **HTTPS**: the session cookie is `Secure`, and a
browser drops it over plain `http://` (except on `localhost`), which looks like
"login does nothing".

## Changing the schema later

```bash
supabase migration new <name>   # creates supabase/migrations/<timestamp>_<name>.sql
# edit it, then
pnpm db:push
pnpm types:gen                  # writes lib/database.types.ts from the live schema
```

Keep `lib/types.ts` in step (or switch it to the generated file) — the Edge
Functions import their types from there too.

## Local stack (optional, needs Docker)

```bash
supabase start          # local Postgres/Auth/Studio, applies migrations + seed.sql
supabase functions serve
```
