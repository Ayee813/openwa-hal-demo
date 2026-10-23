-- Staff now sign in with their HAL account, and bills are read live from the
-- HAL API. Supabase keeps only what HAL does not: which bills were sent on
-- WhatsApp, each branch's WhatsApp session and settings, and the templates.
--
-- All of it is written by the Next.js server with the secret key, scoped to
-- the HAL branch id from the signed-in session; RLS stays on with no policy
-- for anon, so the publishable key reads nothing.

-- A message is now keyed by HAL's bill number, not a row in `shipments`.
alter table message_logs alter column shipment_id drop not null;
alter table message_logs drop constraint if exists message_logs_shipment_id_fkey;

alter table message_logs
  add column bill_number   text,
  add column tracking_id   text,
  add column receiver_name text,
  add column hal_user_id   text,   -- HAL authUser.userId of the sender
  add column sent_by_name  text;

update message_logs l
set bill_number = s.shipment_number
from shipments s
where s.id = l.shipment_id and l.bill_number is null;

create index on message_logs (branch_id, bill_number, created_at desc);

-- Branch rows are created on first HAL sign-in, from authUser.branch.
alter table branches alter column name set default '';
