-- Mock bills for the development account (DEV_LOGIN_EMAIL in .env.local).
-- The dev account belongs to its own branch, so its bills, WhatsApp session
-- and message log never mix with a real HAL branch. Real staff keep reading
-- their bills live from HAL; nothing here is shown to them.
--
-- Server-only like the other tables: RLS on, no policies.

create table demo_bills (
  id               bigint generated always as identity primary key,
  branch_id        int         not null references branches (id) on delete cascade,
  bill_number      text        not null,
  tracking_id      text,
  receiver_name    text,
  receiver_phone   text,
  sender_name      text,
  sender_phone     text,
  start_branch     text,
  start_branch_tel text,
  pay_type         text,
  total_freight    numeric,
  cod_amount       numeric,
  weight_kg        numeric,
  size_cm          numeric,
  arrived_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (branch_id, bill_number)
);

create index on demo_bills (branch_id, arrived_at desc);

alter table demo_bills enable row level security;
