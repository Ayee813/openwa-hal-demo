# Setting up and deploying

All commands run from the project root. Staff sign in with their HAL account;
Supabase is only the server's database (branches, message log, template).

## 1. Fill in `.env.local`

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Dashboard → Project Settings → API Keys → *Secret keys* (server-only, never `NEXT_PUBLIC_`) |
| `SUPABASE_PROJECT_REF` | Dashboard → Project Settings → General → *Project ID* |
| `SUPABASE_DB_PASSWORD` | The database password (reset it under Settings → Database if unknown) |
| `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens>, or run `supabase login` once and leave it empty |
| `HAL_API_URL` | `https://hal.hal-logistics.la` |
| `SESSION_SECRET` | `openssl rand -base64 48` (changing it signs everyone out) |
| `OPENWA_URL` | `http://127.0.0.1:2785` |
| `OPENWA_API_KEY` | `docker exec openwa-api cat data/.api-key` |

## 2. Database

```bash
pnpm sb:link            # supabase link --project-ref $SUPABASE_PROJECT_REF
pnpm db:push            # applies supabase/migrations/*.sql
```

Preview without applying: `pnpm db:push --dry-run`.

## 3. WhatsApp gateway

Start OpenWA (`~/openwa/OpenWA`, docker container `openwa-api`). Each branch
links its own WhatsApp number by scanning the QR on the **WhatsApp** page.

## 4. Run it

```bash
pnpm dev                 # http://localhost:3000
pnpm build && pnpm start # production
pnpm tunnel              # share it at a https://*.trycloudflare.com URL
```

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

Keep `lib/types.ts` in step, or switch it to the generated file.
