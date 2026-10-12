# OpenWA HAL Demo — ແຈ້ງບິນ HAL Express ຜ່ານ WhatsApp

Demo: ເມື່ອພັດສະດຸຮອດສາຂາປາຍທາງ, ພະນັກງານສະແກນເຄື່ອງເຂົ້າ ແລ້ວລະບົບສົ່ງ WhatsApp
ແຈ້ງຜູ້ຮັບຈາກເບີຂອງສາຂາ ຜ່ານ OpenWA (`~/openwa/OpenWA`, docker `openwa-api`).

Next.js 16 + Supabase (Auth, Postgres with RLS, Edge Functions).

## Roles

- **admin** (`/admin`): ພາບລວມທຸກສາຂາ, ບິນທັງໝົດ + ນຳເຂົ້າ HAL JSON, ສ້າງສາຂາ/ບັນຊີ,
  ຜູກ session WhatsApp, ປະຫວັດຂໍ້ຄວາມ, ແກ້ແມ່ແບບຂໍ້ຄວາມ.
- **branch** (`/branch`): ເຫັນສະເພາະບິນທີ່ປາຍທາງແມ່ນສາຂາຕົນ (RLS).
  - ລາຍການບິນ: tabs ຕາມສະຖານະ, ເລືອກ/ເລືອກທັງໝົດ, preview ແລ້ວສົ່ງ, ສົ່ງເຕືອນ,
    ໝາຍ “ຮັບແລ້ວ”, Generate ບິນ demo, ລຶບບິນ demo.
  - ສະແກນ: ເປີດກ້ອງ (ອ່ານ barcode ຈິງຖ້າ browser ມີ `BarcodeDetector`),
    ປຸ່ມ “ຈຳລອງສະແກນ”, ພິມເລກບິນເອງ. ຖ້າເປີດ auto, ສະແກນແລ້ວສົ່ງທັນທີ.
  - WhatsApp: QR login ຂອງສາຂາ (session OpenWA `hal-branch-<id>`), ຕັ້ງຄ່າ auto,
    ເບີພະນັກງານ, ຈຳນວນມື້ໃຫ້ມາຮັບ.

## Flow ຂອງບິນ

`in_transit` (ກຳລັງມາ) → scan → `arrived` → ສົ່ງ WhatsApp ສຳເລັດ → `notified` → `picked_up`.
ບິນທີ່ນຳເຂົ້າຈາກ HAL ທີ່ຈັດສົ່ງແລ້ວ ເປັນ `delivered` ແລະ ສົ່ງບໍ່ໄດ້.

ການສົ່ງ (`lib/notify.ts`): ບັນທຶກ `message_logs` ເປັນ `queued` → ຫຼັງ response ສົ່ງເທື່ອລະຂໍ້ຄວາມ
ຫ່າງກັນ 3–6 ວິນາທີ (ກວດເບີມີ WhatsApp ກ່ອນ) → `sent` / `no_whatsapp` / `failed`.
ໜ້າລາຍການບິນ poll OpenWA ທຸກ 5 ວິນາທີ ເພື່ອອັບເດດ `delivered` / `read`
(ບໍ່ໃຊ້ webhook ເພາະ OpenWA ມີ SSRF guard ບລັອກ localhost). ມີເພດານຕໍ່ວັນຕໍ່ສາຂາ.

OpenWA ຖືກເອີ້ນຈາກ Next.js server ເທົ່ານັ້ນ (Edge Function ໃນ cloud ເຂົ້າ localhost ບໍ່ໄດ້).

## Layout

```
app/                      pages; (auth)/ holds login + sign-in/out actions
lib/env.ts                fails fast on missing NEXT_PUBLIC_* vars
lib/supabase/client.ts    browser client (publishable key, RLS)
lib/supabase/server.ts    server client acting as the signed-in user (RLS)
lib/supabase/admin.ts     secret-key client — server-only, bypasses RLS
lib/supabase/middleware.ts + proxy.ts   session refresh, redirect to /login
lib/auth.ts               getProfile() / requireProfile(role)
lib/types.ts              Database types, shared with the Edge Functions
lib/openwa.ts             OpenWA REST client (server-only)
lib/notify.ts             queue + send + status sync of WhatsApp messages
lib/message.ts            message template rendering (shared with the browser preview)
lib/phone.ts              Lao phone → WhatsApp id (97364057 → 8562097364057@c.us)
app/branch/               bills, scan, whatsapp pages + actions.ts
app/admin/                dashboard, bills, branches, messages, template + actions.ts
supabase/migrations/      0001 profiles + roles, 0002 shipments, 0003 branches + messaging
supabase/functions/       create-member, import-shipments (+ _shared)
scripts/                  supabase.sh (CLI wrapper), check-secrets.sh, create-admin.mjs
```

## Commands

| | |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` | secret-leak check + production build |
| `pnpm typecheck` / `pnpm lint` | |
| `pnpm test` | unit tests (phone numbers, message rendering) |
| `pnpm sb:link` | link to the project in `SUPABASE_PROJECT_REF` |
| `pnpm db:push` | apply migrations to the hosted DB |
| `pnpm functions:deploy [name]` | deploy Edge Functions (all, or one) |
| `pnpm functions:secrets` | upload `supabase/functions/.env` |
| `pnpm types:gen` | generate `lib/database.types.ts` |
| `pnpm deploy:supabase` | link + db push + functions deploy |
| `pnpm create:admin` | create/repair an admin account |

The CLI commands read the project ref, DB password and access token from
`.env.local`. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full first-time setup.

## Accounts

Demo accounts. Sign in at http://localhost:3000/login.

| Role | Branch | Email |
|---|---|---|
| admin | — | yongyeelove813@gmail.com |
| branch | ນາຄ່ອນ (#410) | yongyeevuesengchan@gmail.com |
| admin | — | admin@hal-demo.la |
| branch | ນາຄ່ອນ (#410) | nakhon@hal-demo.la |
| branch | ຕານມີໄຊ (#53) | tanmixay@hal-demo.la |

Create more, or reset a password (re-running is safe):

```bash
ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_NAME=… pnpm create:admin
# a branch account from the CLI (or use /admin/branches):
ADMIN_ROLE=branch ADMIN_BRANCH_ID=410 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_NAME=… pnpm create:admin
```

## OpenWA

`.env.local` needs `OPENWA_URL` (default `http://127.0.0.1:2785`) and
`OPENWA_API_KEY` (`docker exec openwa-api cat data/.api-key`).
