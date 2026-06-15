-- ============================================================
--  Pantry · Supabase schema v2 — family sync + profiles + initials
--  Run once: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- Per-user profile (display name + the initials shown on items) -----
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member',
  initials     text not null default '?',
  ci           int  not null default 0,        -- colour index (0-5)
  created_at   timestamptz not null default now()
);

create table if not exists households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Our Home',
  join_code  text unique not null default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid references households(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  role         text not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Shared list. One row per item per household. added_by_* are
-- denormalised so realtime payloads carry the adder's initials.
create table if not exists pantry_items (
  household_id      uuid references households(id) on delete cascade,
  item_id           text not null,
  mode              text not null,                 -- 'g' | 'v'
  name              text,
  category          text,
  selected          boolean not null default true,
  qty               numeric not null default 1,
  unit              text not null default 'pcs',
  is_favorite       boolean not null default false,
  cadence           text,                          -- 'W' | '2W' | 'M' override
  last_ordered      timestamptz,                   -- drives "Due this week"
  added_by          uuid,
  added_by_initials text,
  added_by_ci       int,
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  primary key (household_id, item_id)
);

-- ---- helpers ----
create or replace function is_member(h uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (select 1 from household_members m where m.household_id = h and m.user_id = auth.uid());
$$;

create or replace function shares_household(target uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (
    select 1 from household_members a
    join household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = target
  );
$$;

create or replace function join_household(code text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  select id into h from households where join_code = upper(code);
  if h is null then raise exception 'Invalid household code'; end if;
  insert into household_members (household_id, user_id) values (h, auth.uid()) on conflict do nothing;
  return h;
end; $$;

create or replace function create_household(p_name text default 'Our Home') returns households
  language plpgsql security definer set search_path = public as $$
declare hh households;
begin
  insert into households (name) values (coalesce(nullif(p_name, ''), 'Our Home')) returning * into hh;
  insert into household_members (household_id, user_id, role) values (hh.id, auth.uid(), 'owner');
  return hh;
end; $$;

-- ---- row level security ----
alter table profiles          enable row level security;
alter table households        enable row level security;
alter table household_members enable row level security;
alter table pantry_items      enable row level security;

create policy "prof_read"   on profiles for select using (id = auth.uid() or shares_household(id));
create policy "prof_insert" on profiles for insert with check (id = auth.uid());
create policy "prof_update" on profiles for update using (id = auth.uid());

create policy "hh_read"   on households for select using (is_member(id));
create policy "hh_update" on households for update using (is_member(id));

create policy "mem_read"        on household_members for select using (is_member(household_id));
create policy "mem_delete_self" on household_members for delete using (user_id = auth.uid());

create policy "pi_all" on pantry_items for all
  using (is_member(household_id)) with check (is_member(household_id));

-- live sync for the whole family
alter publication supabase_realtime add table pantry_items;
