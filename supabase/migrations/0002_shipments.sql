-- Shipments pulled from the HAL API (see data/demo order*).
-- Keyed on HAL's own id so re-importing the same page is an upsert, not a
-- duplicate. The full record is kept in `raw`; the columns are the parts worth
-- filtering and summing on.

create table shipments (
  id                   bigint primary key,           -- HAL shipment id
  shipment_number      text   not null unique,       -- 'XKG08162158241'
  shipment_type        text,                         -- 'express'
  shipment_pay_type    text,                         -- 'origin_freight_fees'
  shipment_status_id   int,
  status_step          text,                         -- 'success'
  status_name          text,                         -- 'Success'
  pieces               int,
  total_freight        numeric(14, 2),
  total_price          numeric(14, 2),
  sender_customer_id   bigint,
  sender_name          text,
  receiver_customer_id bigint,
  receiver_name        text,
  start_branch_id      int,
  end_branch_id        int,
  start_date_actual    timestamptz,
  end_date_actual      timestamptz,
  hal_created_at       timestamptz,
  hal_updated_at       timestamptz,
  raw                  jsonb  not null,
  imported_by          uuid references profiles (id) on delete set null,
  imported_at          timestamptz not null default now()
);

create index on shipments (hal_created_at desc);
create index on shipments (status_step);
create index on shipments (sender_customer_id);
create index on shipments (start_branch_id, end_branch_id);

alter table shipments enable row level security;

create policy shipments_read on shipments
  for select to authenticated
  using ((select is_active_user()));

create policy shipments_admin_write on shipments
  for all to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));
