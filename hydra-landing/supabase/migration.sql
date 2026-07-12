-- ============================================================
-- HYDRA WAITLIST v2 — migration (déjà appliquée en prod le 2026-07-12
-- sous le nom "hydra_waitlist_v2_qualified"). Copie de référence.
--
-- Architecture : la table est totalement fermée aux rôles API
-- (RLS on, zéro policy, REVOKE ALL). Le client statique passe
-- uniquement par 4 fonctions SECURITY DEFINER : signup / update /
-- position / resume — avec honeypot et rate limit IP intégrés.
-- Équivalent sécurité d'une route serveur service_role, sans serveur.
-- ============================================================

create table if not exists public.hydra_waitlist_v2 (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text unique not null,
  source text,
  price_fair numeric,               -- mode 'simple'
  price_too_expensive numeric,      -- mode 'sensitivity'
  price_good_deal numeric,          -- mode 'sensitivity'
  forget_context text check (forget_context in ('work','party','sport','always')),
  motivation text check (motivation in ('game','alcohol','smart','stats')),
  feature_priority text check (feature_priority in ('widget','alcohol_track','watch','adaptive')),
  current_management text[],
  competitor_feedback text,
  platform text check (platform in ('ios','android')),
  watch text check (watch in ('apple_watch','other_watch','no_watch')),
  magic_wand text,
  completed_optional boolean not null default false,
  user_agent text,
  referrer text
);

create index if not exists hydra_waitlist_v2_created_idx on public.hydra_waitlist_v2 (created_at);

create or replace function public.hydra_waitlist_v2_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists hydra_waitlist_v2_touch_trg on public.hydra_waitlist_v2;
create trigger hydra_waitlist_v2_touch_trg
  before update on public.hydra_waitlist_v2
  for each row execute function public.hydra_waitlist_v2_touch();

alter table public.hydra_waitlist_v2 enable row level security;
revoke all on public.hydra_waitlist_v2 from anon, authenticated;

create table if not exists public.hydra_waitlist_ratelimit (
  ip_hash text primary key,
  window_start timestamptz not null,
  hits int not null
);
alter table public.hydra_waitlist_ratelimit enable row level security;
revoke all on public.hydra_waitlist_ratelimit from anon, authenticated;

create or replace function public.hydra_rl_check(p_max int, p_window interval)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ip text;
  v_hash text;
  v_row public.hydra_waitlist_ratelimit;
begin
  begin
    v_ip := coalesce(
      split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1),
      ''
    );
  exception when others then
    v_ip := '';
  end;
  if v_ip = '' then return true; end if;
  v_hash := md5(v_ip);
  select * into v_row from public.hydra_waitlist_ratelimit where ip_hash = v_hash;
  if not found or v_row.window_start < now() - p_window then
    insert into public.hydra_waitlist_ratelimit (ip_hash, window_start, hits)
    values (v_hash, now(), 1)
    on conflict (ip_hash) do update set window_start = now(), hits = 1;
    return true;
  end if;
  if v_row.hits >= p_max then return false; end if;
  update public.hydra_waitlist_ratelimit set hits = hits + 1 where ip_hash = v_hash;
  return true;
end $$;

create or replace function public.hydra_waitlist_signup(
  p_email text,
  p_price_fair numeric default null,
  p_price_too_expensive numeric default null,
  p_price_good_deal numeric default null,
  p_source text default null,
  p_user_agent text default null,
  p_referrer text default null,
  p_honeypot text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text;
  v_id uuid;
begin
  if coalesce(p_honeypot, '') <> '' then
    return gen_random_uuid();  -- bot : faux succès, rien stocké
  end if;
  if not public.hydra_rl_check(8, interval '1 hour') then
    raise exception 'rate_limited';
  end if;
  v_email := lower(trim(p_email));
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;
  if p_price_fair is not null and (p_price_fair < 0 or p_price_fair > 100) then
    raise exception 'invalid_price';
  end if;
  if p_price_too_expensive is not null and (p_price_too_expensive < 0 or p_price_too_expensive > 100) then
    raise exception 'invalid_price';
  end if;
  if p_price_good_deal is not null and (p_price_good_deal < 0 or p_price_good_deal > 100) then
    raise exception 'invalid_price';
  end if;
  insert into public.hydra_waitlist_v2
    (email, price_fair, price_too_expensive, price_good_deal, source, user_agent, referrer)
  values
    (v_email, p_price_fair, p_price_too_expensive, p_price_good_deal,
     left(p_source, 100), left(p_user_agent, 500), left(p_referrer, 500))
  on conflict (email) do update set
    price_fair = coalesce(excluded.price_fair, hydra_waitlist_v2.price_fair),
    price_too_expensive = coalesce(excluded.price_too_expensive, hydra_waitlist_v2.price_too_expensive),
    price_good_deal = coalesce(excluded.price_good_deal, hydra_waitlist_v2.price_good_deal),
    source = coalesce(hydra_waitlist_v2.source, excluded.source)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.hydra_waitlist_update(
  p_id uuid,
  p_forget_context text default null,
  p_motivation text default null,
  p_feature_priority text default null,
  p_current_management text[] default null,
  p_competitor_feedback text default null,
  p_platform text default null,
  p_watch text default null,
  p_magic_wand text default null,
  p_completed_optional boolean default null
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_found boolean;
begin
  if not public.hydra_rl_check(60, interval '1 hour') then
    raise exception 'rate_limited';
  end if;
  update public.hydra_waitlist_v2 set
    forget_context = coalesce(p_forget_context, forget_context),
    motivation = coalesce(p_motivation, motivation),
    feature_priority = coalesce(p_feature_priority, feature_priority),
    current_management = coalesce(p_current_management, current_management),
    competitor_feedback = coalesce(left(p_competitor_feedback, 2000), competitor_feedback),
    platform = coalesce(p_platform, platform),
    watch = coalesce(p_watch, watch),
    magic_wand = coalesce(left(p_magic_wand, 2000), magic_wand),
    completed_optional = coalesce(p_completed_optional, completed_optional)
  where id = p_id;
  get diagnostics v_found = row_count;
  return v_found;
end $$;

create or replace function public.hydra_waitlist_position(p_id uuid)
returns integer
language sql security definer set search_path = public, pg_temp as $$
  select count(*)::int
  from public.hydra_waitlist_v2 w
  where w.created_at <= (select created_at from public.hydra_waitlist_v2 where id = p_id);
$$;

create or replace function public.hydra_waitlist_resume(p_email text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if not public.hydra_rl_check(20, interval '1 hour') then
    raise exception 'rate_limited';
  end if;
  select id into v_id from public.hydra_waitlist_v2 where email = lower(trim(p_email));
  return v_id;
end $$;

revoke all on function public.hydra_waitlist_signup(text,numeric,numeric,numeric,text,text,text,text) from public;
revoke all on function public.hydra_waitlist_update(uuid,text,text,text,text[],text,text,text,text,boolean) from public;
revoke all on function public.hydra_waitlist_position(uuid) from public;
revoke all on function public.hydra_waitlist_resume(text) from public;
grant execute on function public.hydra_waitlist_signup(text,numeric,numeric,numeric,text,text,text,text) to anon;
grant execute on function public.hydra_waitlist_update(uuid,text,text,text,text[],text,text,text,text,boolean) to anon;
grant execute on function public.hydra_waitlist_position(uuid) to anon;
grant execute on function public.hydra_waitlist_resume(text) to anon;
