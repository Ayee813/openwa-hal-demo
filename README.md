# HAL Express — ແຈ້ງບິນ WhatsApp

ພະນັກງານສາຂາ HAL **ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ HAL Admin ຂອງຕົນເອງ**, ເຫັນເຄື່ອງທີ່ຮອດສາຂາ
(ດຶງສົດຈາກ HAL API), ເລືອກບິນ ແລ້ວສົ່ງ WhatsApp ແຈ້ງລູກຄ້າ ຈາກເບີຂອງສາຂາ
ຜ່ານ OpenWA (`~/openwa/OpenWA`, docker `openwa-api`).

Next.js 16 + Supabase (Postgres) + OpenWA.

## ການເຮັດວຽກ

- **Login (`/login`)**: ສົ່ງ email/ລະຫັດ ໄປ `POST /api/admin/sign-in` ຂອງ HAL ຈາກ server.
  Token ຂອງ HAL ເກັບໃນ cookie `hal_session` (httpOnly, ເຂົ້າລະຫັດ AES-256-GCM ດ້ວຍ
  `SESSION_SECRET`), browser ອ່ານບໍ່ໄດ້. ສາຂາມາຈາກ `authUser.branch_id`.
- **ເຄື່ອງຮອດສາຂາ (`/bills`)**: ດຶງຈາກ HAL `holding-shipments` (status `arrived_status`)
  ຕາມຊ່ວງວັນທີ. ຄົ້ນຫາ (ເບີໂທ / ເລກບິນ / ຊື່), ປ່ຽນໜ້າ, ເລືອກ / ເລືອກທັງໝົດ,
  ສົ່ງທີ່ເລືອກ, ສົ່ງທັງໝົດ (ທຸກໜ້າໃນຊ່ວງວັນທີ), ສົ່ງ ຫຼື ສົ່ງຄືນເທື່ອລະບິນ,
  ເບິ່ງລາຍລະອຽດ + ຕົວຢ່າງຂໍ້ຄວາມ, ສະຖານະ WhatsApp ຂອງແຕ່ລະບິນ.
- **WhatsApp (`/whatsapp`)**: QR login ຂອງສາຂາ (session OpenWA `hal-branch-<branch_id>`),
  ເບີພະນັກງານ, ຈຳນວນມື້ໃຫ້ມາຮັບ.

Supabase ເກັບສະເພາະຂໍ້ມູນຂອງລະບົບນີ້ (ຂຽນຈາກ server ດ້ວຍ secret key, ກອງຕາມ
`branch_id` ຂອງ session): `branches` (WhatsApp + ຕັ້ງຄ່າ), `message_logs` (ບິນໃດສົ່ງແລ້ວ,
ກັນສົ່ງຊ້ຳ), `message_templates`.

ການສົ່ງ (`lib/notify.ts`): server ດຶງບິນຈາກ HAL ຄືນໃໝ່ດ້ວຍ token ຂອງຜູ້ໃຊ້ (browser ສົ່ງໄດ້ແຕ່
ເລກບິນ, ບໍ່ແມ່ນເບີ ຫຼື ຂໍ້ຄວາມ) → ບັນທຶກ `queued` → ສົ່ງເທື່ອລະຂໍ້ຄວາມ ຫ່າງກັນ 3–6 ວິນາທີ
→ `sent` / `no_whatsapp` / `failed`, ແລ້ວ poll OpenWA ເພື່ອ `delivered` / `read`.
ມີເພດານຕໍ່ວັນຕໍ່ສາຂາ.

## Layout

```
app/(auth)/               login page + signIn / signOut (HAL)
app/(app)/bills/          ເຄື່ອງຮອດສາຂາ: page.tsx (HAL fetch) + bills-table.tsx
app/(app)/whatsapp/       QR + settings
app/(app)/actions.ts      sendBills, billStatuses, WhatsApp + settings actions
lib/hal.ts                HAL API client (server-only): signIn, holdingPage, holdingAll
lib/session.ts            encrypted session cookie, requireSession / requireBranch
lib/bill.ts               Bill type + date helpers (shared with the browser)
lib/notify.ts             queue + send + status sync of WhatsApp messages
lib/openwa.ts             OpenWA REST client (server-only)
lib/message.ts            message template rendering
lib/phone.ts              Lao phone → WhatsApp id (97364057 → 8562097364057@c.us)
lib/bills-source.ts       bills from HAL, or from demo_bills for the dev account
lib/demo.ts               mock bill generator of the dev account
lib/supabase/admin.ts     secret-key client (server-only)
supabase/migrations/      0001–0008 (0006 drops the first version's auth + demo tables, 0007 adds demo_bills, 0008 per-branch message)
public/hal-logo.png       HAL Express logo
```

## Setup

`.env.local` (template: `.env.example`):

| | |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | the database (server-only) |
| `HAL_API_URL` | `https://hal.hal-logistics.la` |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `OPENWA_URL` | `http://127.0.0.1:2785` |
| `OPENWA_API_KEY` | `docker exec openwa-api cat data/.api-key` |
| `DEV_LOGIN_EMAIL`, `DEV_LOGIN_PASSWORD` | optional development account (leave empty in production) |

## Commands

| | |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` / `pnpm start` | production build / server |
| `pnpm tunnel` | share the running app at a public `https://*.trycloudflare.com` URL |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | checks, unit tests |
| `pnpm db:push` | apply migrations to the hosted DB |

The CLI commands read the project ref, DB password and access token from
`.env.local`. See [DEPLOYMENT.md](DEPLOYMENT.md) for the first-time setup.

## Accounts

Sign in with a real **HAL Admin** account that belongs to a branch: bills come
live from HAL.

For development, set `DEV_LOGIN_EMAIL` and `DEV_LOGIN_PASSWORD` in `.env.local`.
Signing in with that email never reaches HAL; it opens the demo branch
"ທົດລອງ (DEV)" (id 999999), with its own WhatsApp session and message log.
There, **Generate ບິນ** makes mock parcels sent to numbers you choose (use your
own: messages really go out), and **ລຶບຂໍ້ມູນທົດລອງ** clears them. Empty
`DEV_LOGIN_EMAIL` turns the account off, including cookies already issued.
