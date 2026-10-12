-- Branches, parcel arrival scanning and WhatsApp notifications.
--
-- Roles become admin / branch. A branch account belongs to one HAL branch and
-- only sees shipments whose destination (end_branch_id) is that branch.

alter type user_role rename value 'member' to 'branch';
alter table profiles alter column role set default 'branch';

-- ---------------------------------------------------------------------------
-- Branches (keyed on HAL's own branch id)
-- ---------------------------------------------------------------------------

create table branches (
  id            int primary key,                    -- HAL branch id
  name          text        not null,
  code          text,
  tel           text,
  district      text,
  province      text,
  staff_phone   text,                               -- shown in the message
  auto_send     boolean     not null default false, -- notify right after a scan
  pickup_days   int         not null default 7  check (pickup_days between 1 and 60),
  daily_limit   int         not null default 200 check (daily_limit between 1 and 2000),
  wa_session_id text unique,                        -- OpenWA session id
  wa_status     text        not null default 'not_connected',
  wa_phone      text,
  wa_name       text,
  wa_updated_at timestamptz,
  created_at    timestamptz not null default now()
);

alter table profiles add column branch_id int references branches (id) on delete set null;

-- Every branch seen in the shipments already imported.
insert into branches (id, name, code, tel, district, province)
select distinct on (id) id, name, code, tel, district, province
from (
  select (b->>'id')::int                          as id,
         b->>'name'                               as name,
         b->>'code'                               as code,
         b->>'tel'                                as tel,
         b->'village'->'district'->>'name'        as district,
         b->'province'->>'name'                   as province
  from shipments, lateral (values (raw->'end_branch'), (raw->'start_branch')) v(b)
  where b is not null and b ? 'id' and b ? 'name'
) s
on conflict (id) do nothing;

create or replace function my_branch_id()
returns int
language sql stable security definer set search_path = public
as $$
  select branch_id from profiles
  where id = (select auth.uid()) and is_active;
$$;

revoke execute on function my_branch_id() from anon;

-- A branch account may change its own settings and WhatsApp link, never the
-- HAL identity of the branch or its limits.
create or replace function branches_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select auth.uid()) is not null and not is_admin() then
    if (new.id, new.name, new.code, new.tel, new.district, new.province, new.daily_limit)
       is distinct from
       (old.id, old.name, old.code, old.tel, old.district, old.province, old.daily_limit) then
      raise exception 'Only an admin can change branch details';
    end if;
  end if;
  return new;
end;
$$;

create trigger branches_guard before update on branches
  for each row execute function branches_guard();

alter table branches enable row level security;

create policy branches_read on branches
  for select to authenticated
  using ((select is_admin()) or id = (select my_branch_id()));

create policy branches_update_own on branches
  for update to authenticated
  using ((select is_admin()) or id = (select my_branch_id()))
  with check ((select is_admin()) or id = (select my_branch_id()));

create policy branches_admin_insert on branches
  for insert to authenticated
  with check ((select is_admin()));

create policy branches_admin_delete on branches
  for delete to authenticated
  using ((select is_admin()));

-- ---------------------------------------------------------------------------
-- Shipments: arrival workflow
-- ---------------------------------------------------------------------------

create type parcel_status as enum
  ('in_transit', 'arrived', 'notified', 'picked_up', 'delivered');

create type message_status as enum
  ('queued', 'sent', 'delivered', 'read', 'failed', 'no_whatsapp');

-- Demo bills have no HAL id; they draw from a range HAL will not reach.
create sequence demo_shipment_id_seq start 9000000000;

alter table shipments
  alter column id set default nextval('demo_shipment_id_seq'),
  add column parcel_status       parcel_status  not null default 'in_transit',
  add column receiver_phone      text,
  add column weight_kg           numeric(10, 2),
  add column size_cm             numeric(10, 2),
  add column cod_amount          numeric(14, 2),
  add column arrived_at          timestamptz,
  add column scanned_by          uuid references profiles (id) on delete set null,
  add column pickup_deadline     date,
  add column picked_up_at        timestamptz,
  add column is_demo             boolean        not null default false,
  add column last_message_status message_status,
  add column last_message_at     timestamptz;

alter sequence demo_shipment_id_seq owned by shipments.id;

update shipments set
  receiver_phone = raw->'receiver_customer'->>'tel',
  weight_kg      = nullif(raw->'parcel'->>'weight', '')::numeric,
  size_cm        = nullif(raw->'parcel'->>'dimension_length', '')::numeric,
  cod_amount     = case when shipment_pay_type like '%cod' then total_price end,
  -- HAL already delivered these; they must never be announced as arrived.
  parcel_status  = case
    when raw->'label_status'->>'status' = 'delivered' or status_step = 'success'
      then 'delivered'::parcel_status
    else 'in_transit'::parcel_status
  end;

alter table shipments
  add constraint shipments_end_branch_fk
  foreign key (end_branch_id) references branches (id) not valid;

create index on shipments (end_branch_id, parcel_status);
create index on shipments (arrived_at desc);

drop policy shipments_read on shipments;

create policy shipments_read on shipments
  for select to authenticated
  using ((select is_admin()) or end_branch_id = (select my_branch_id()));

create policy shipments_branch_update on shipments
  for update to authenticated
  using (end_branch_id = (select my_branch_id()))
  with check (end_branch_id = (select my_branch_id()));

-- Branches may only create demo bills addressed to themselves.
create policy shipments_branch_insert_demo on shipments
  for insert to authenticated
  with check (is_demo and end_branch_id = (select my_branch_id()));

create policy shipments_branch_delete_demo on shipments
  for delete to authenticated
  using (is_demo and end_branch_id = (select my_branch_id()));

-- ---------------------------------------------------------------------------
-- Message log: one row per WhatsApp message attempted
-- ---------------------------------------------------------------------------

create table message_logs (
  id            bigint generated always as identity primary key,
  shipment_id   bigint         not null references shipments (id) on delete cascade,
  branch_id     int            not null references branches (id) on delete cascade,
  kind          text           not null default 'arrival' check (kind in ('arrival', 'reminder')),
  phone         text           not null,
  chat_id       text,
  body          text           not null,
  status        message_status not null default 'queued',
  wa_message_id text,
  error         text,
  sent_by       uuid references profiles (id) on delete set null,
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now()
);

create index on message_logs (branch_id, created_at desc);
create index on message_logs (shipment_id, created_at desc);
create index on message_logs (status) where status in ('queued', 'sent', 'delivered');

alter table message_logs enable row level security;

create policy message_logs_read on message_logs
  for select to authenticated
  using ((select is_admin()) or branch_id = (select my_branch_id()));

create policy message_logs_branch_insert on message_logs
  for insert to authenticated
  with check (branch_id = (select my_branch_id()) and sent_by = (select auth.uid()));

create policy message_logs_branch_update on message_logs
  for update to authenticated
  using (branch_id = (select my_branch_id()))
  with check (branch_id = (select my_branch_id()));

create policy message_logs_admin_write on message_logs
  for all to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

-- ---------------------------------------------------------------------------
-- Message templates, one per kind, edited by an admin
-- ---------------------------------------------------------------------------

create table message_templates (
  key        text primary key check (key in ('arrival', 'reminder')),
  body       text        not null check (length(body) between 1 and 4000),
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into message_templates (key, body) values
('arrival', $t$😊ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນສະບາຍດີ,
ພັດສະດຸຮອດເລກ: {shipment_number}
ນ້ຳໜັກ: {weight} ກິໂລ | ຂະໜາດ: {size} cm
{payment}
ຮອດສາຂາ {branch_name},ເມືອງ {district},
ເບີໂທພະນັກງານຍິງຮັບເຄື່ອງ: {staff_phone}
ເບີໂທສາຂາ: {branch_tel}
ເຂົ້າຮັບກ່ອນວັນທີ {pickup_deadline}
ຂໍຂອບໃຈ🙏$t$),
('reminder', $t$😊ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນສະບາຍດີ,
ແຈ້ງເຕືອນ: ພັດສະດຸເລກ {shipment_number} ຍັງລໍຖ້າທ່ານຢູ່
ສາຂາ {branch_name},ເມືອງ {district}
{payment}
ກະລຸນາເຂົ້າຮັບກ່ອນວັນທີ {pickup_deadline}
ເບີໂທພະນັກງານຍິງຮັບເຄື່ອງ: {staff_phone}
ເບີໂທສາຂາ: {branch_tel}
ຂໍຂອບໃຈ🙏$t$);

alter table message_templates enable row level security;

create policy message_templates_read on message_templates
  for select to authenticated
  using ((select is_active_user()));

create policy message_templates_admin_write on message_templates
  for all to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));
