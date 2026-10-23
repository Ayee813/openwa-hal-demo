-- Staff sign in with HAL now, and bills are read live from the HAL API, so the
-- first version's Supabase accounts, roles and imported demo bills go.
--
-- Only the server (secret key) reads these tables, so RLS stays enabled with
-- no policies: the publishable / anon key gets nothing.

-- Policies and the trigger that relied on profiles / is_admin / my_branch_id.
drop policy if exists branches_read on branches;
drop policy if exists branches_update_own on branches;
drop policy if exists branches_admin_insert on branches;
drop policy if exists branches_admin_delete on branches;
drop trigger if exists branches_guard on branches;
drop function if exists branches_guard();

drop policy if exists message_logs_read on message_logs;
drop policy if exists message_logs_branch_insert on message_logs;
drop policy if exists message_logs_branch_update on message_logs;
drop policy if exists message_logs_admin_write on message_logs;

drop policy if exists message_templates_read on message_templates;
drop policy if exists message_templates_admin_write on message_templates;

-- Columns that pointed at the old tables.
alter table message_logs drop column if exists shipment_id;
alter table message_logs drop column if exists sent_by;
alter table message_templates drop column if exists updated_by;
alter table branches drop column if exists auto_send;
alter table branches drop column if exists code;

-- The old tables, helpers and types.
drop table if exists shipments cascade;
drop table if exists profiles cascade;
drop function if exists is_admin();
drop function if exists is_active_user();
drop function if exists my_branch_id();
drop type if exists parcel_status;
drop type if exists user_role;
