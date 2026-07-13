-- ============================================================================
-- HYDRA — Supabase schema (version-controlled copy of the applied migrations).
-- Project: HYDRA  ·  ref: zxrakxkiqfiinszavuqi  ·  region: eu-west-1
-- Org: SHIPPLY (separate project from SHIPPLY CARS — HYDRA stays independent).
--
-- Model: the app is event-sourced (src/engine/hydrationEngine.ts). The server is
-- a backup / multi-device SYNC MIRROR of the local store, never the primary.
-- Every row is locked to its owner via RLS (auth.uid()). No anon access.
--
-- To reproduce on a fresh project: run this file top to bottom in the SQL editor.
-- ============================================================================

-- ── helpers ─────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ── profiles: one row per auth user ─────────────────────────────────────────
create table if not exists public.profiles (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  weight_kg               numeric,
  sex                     text check (sex in ('male','female')),
  sleep_start_hour        numeric,
  sleep_end_hour          numeric,
  awake_hours             numeric,
  ambient_temp_c          numeric,
  relative_humidity_pct   numeric,
  altitude_m              numeric default 0,
  daily_goal_override_ml  numeric,
  default_water_ml        integer default 250,
  widget                  jsonb   not null default '{}'::jsonb,  -- widget prefs blob
  presets                 jsonb,                                 -- custom drink presets (optional)
  onboarded               boolean not null default false,
  timezone                text,
  locale                  text,
  app_version             text,
  platform                text check (platform in ('ios','android','web')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── events: the timestamped event log (mirrors HydrationEvent) ──────────────
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id     text not null,                      -- stable client-generated id (idempotent sync)
  type          text not null check (type in ('water','electrolytes','alcohol','caffeine','sport','profile')),
  at            timestamptz not null,               -- event wall-clock time
  volume_ml     numeric,
  abv           numeric,
  caffeine_mg   numeric,
  duration_min  numeric,
  intensity     text check (intensity in ('light','moderate','intense')),
  patch         jsonb,                              -- for type='profile' (partial profile)
  deleted_at    timestamptz,                        -- soft delete (syncs undo/delete across devices)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, client_id)                       -- idempotent upsert key
);

create index if not exists events_user_at_idx      on public.events (user_id, at);
create index if not exists events_user_updated_idx on public.events (user_id, updated_at);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.events   enable row level security;

drop policy if exists "own profile - select" on public.profiles;
drop policy if exists "own profile - insert" on public.profiles;
drop policy if exists "own profile - update" on public.profiles;
drop policy if exists "own profile - delete" on public.profiles;
create policy "own profile - select" on public.profiles for select using (auth.uid() = user_id);
create policy "own profile - insert" on public.profiles for insert with check (auth.uid() = user_id);
create policy "own profile - update" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile - delete" on public.profiles for delete using (auth.uid() = user_id);

drop policy if exists "own events - select" on public.events;
drop policy if exists "own events - insert" on public.events;
drop policy if exists "own events - update" on public.events;
drop policy if exists "own events - delete" on public.events;
create policy "own events - select" on public.events for select using (auth.uid() = user_id);
create policy "own events - insert" on public.events for insert with check (auth.uid() = user_id);
create policy "own events - update" on public.events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own events - delete" on public.events for delete using (auth.uid() = user_id);

-- ── auto-create profile on signup ───────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Founder analytics — private schema, NOT exposed to the PostgREST API
-- (Supabase serves only `public` + `graphql_public`). App clients can never
-- reach it. Aggregates only, no user_id. Read from the SQL editor.
-- ============================================================================
create schema if not exists analytics;
revoke all on schema analytics from anon, authenticated;

create or replace view analytics.overview as
select
  (select count(*) from public.profiles)                                          as total_users,
  (select count(*) from public.profiles where onboarded)                          as onboarded_users,
  (select count(*) from public.profiles where platform = 'ios')                   as ios_users,
  (select count(*) from public.profiles where platform = 'android')               as android_users,
  (select count(*) from public.events)                                            as total_events,
  (select count(distinct user_id) from public.events where at >= now() - interval '1 day')   as active_1d,
  (select count(distinct user_id) from public.events where at >= now() - interval '7 days')  as active_7d,
  (select count(distinct user_id) from public.events where at >= now() - interval '30 days') as active_30d;

create or replace view analytics.signups_daily as
select created_at::date as day, count(*) as signups
from public.profiles group by 1 order by 1 desc;

create or replace view analytics.daily_consumption as
select
  at::date                                                                        as day,
  count(distinct user_id)                                                         as active_users,
  count(*) filter (where type in ('water','electrolytes') and deleted_at is null) as water_events,
  coalesce(sum(volume_ml) filter (where type in ('water','electrolytes') and deleted_at is null), 0) as water_ml_total,
  count(*) filter (where type = 'alcohol' and deleted_at is null)                 as alcohol_events,
  coalesce(sum(volume_ml * abv / 100.0 * 0.789) filter (where type = 'alcohol' and deleted_at is null), 0) as ethanol_g_total,
  count(*) filter (where type = 'sport' and deleted_at is null)                   as sport_events
from public.events group by 1 order by 1 desc;

create or replace view analytics.daily_per_user as
select
  day, active_users,
  round(water_ml_total / nullif(active_users, 0))               as avg_water_ml_per_user,
  round((alcohol_events::numeric) / nullif(active_users, 0), 2) as avg_alcohol_units_per_user,
  round(ethanol_g_total / nullif(active_users, 0), 1)          as avg_ethanol_g_per_user
from analytics.daily_consumption;

revoke all on all tables in schema analytics from anon, authenticated;
