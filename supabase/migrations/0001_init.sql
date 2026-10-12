-- openwa_hal_demo — profiles and roles
-- Accounts are created by an admin (create-member function or
-- `pnpm create:admin`); there is no self-signup.

create type user_role as enum ('admin', 'member');

create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       user_role   not null default 'member',
  full_name  text        not null,
  email      text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- Used by RLS policies. SECURITY DEFINER so a policy can read profiles without
-- recursing into profiles' own RLS.
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'admin' and is_active
  );
$$;

create or replace function is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and is_active
  );
$$;

revoke execute on function is_admin()       from anon;
revoke execute on function is_active_user() from anon;

alter table profiles enable row level security;

create policy profiles_read_own on profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select is_admin()));

create policy profiles_admin_write on profiles
  for all to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));
