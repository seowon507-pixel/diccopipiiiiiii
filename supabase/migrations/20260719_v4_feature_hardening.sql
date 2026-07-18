-- Harden the v4 feature set (reports, threaded comments, reactions, anonymous
-- recovery and push preferences). Apply after 20260718_v1_security_hardening.sql.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Feature columns
-- ---------------------------------------------------------------------------

alter table public.posts add column if not exists report_count integer default 0;
alter table public.posts add column if not exists hidden boolean default false;
alter table public.posts add column if not exists last_confirmed_at timestamptz;

alter table public.comments add column if not exists report_count integer default 0;
alter table public.comments add column if not exists hidden boolean default false;
alter table public.comments add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column if not exists reactions jsonb default '{}'::jsonb;

update public.posts set report_count = 0 where report_count is null;
update public.posts set hidden = false where hidden is null;
update public.comments set report_count = 0 where report_count is null;
update public.comments set hidden = false where hidden is null;
update public.comments set reactions = '{}'::jsonb where reactions is null;

alter table public.posts alter column report_count set default 0;
alter table public.posts alter column report_count set not null;
alter table public.posts alter column hidden set default false;
alter table public.posts alter column hidden set not null;
alter table public.comments alter column report_count set default 0;
alter table public.comments alter column report_count set not null;
alter table public.comments alter column hidden set default false;
alter table public.comments alter column hidden set not null;
alter table public.comments alter column reactions set default '{}'::jsonb;
alter table public.comments alter column reactions set not null;

alter table public.post_owners add column if not exists device_secret_hash bytea;
alter table public.post_owners add column if not exists recovery_ciphertext bytea;
alter table public.pin_owners add column if not exists device_secret_hash bytea;
alter table public.pin_owners add column if not exists recovery_ciphertext bytea;

create index if not exists comments_parent_v2_idx
  on public.comments(parent_comment_id, created_at);

do $migration$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_report_count_v2_check') then
    alter table public.posts add constraint posts_report_count_v2_check
      check (report_count >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comments_report_count_v2_check') then
    alter table public.comments add constraint comments_report_count_v2_check
      check (report_count >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comments_reactions_v2_check') then
    alter table public.comments add constraint comments_reactions_v2_check
      check (jsonb_typeof(reactions) = 'object') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comments_parent_not_self_v2_check') then
    alter table public.comments add constraint comments_parent_not_self_v2_check
      check (parent_comment_id is null or parent_comment_id <> id) not valid;
  end if;
end
$migration$;

-- ---------------------------------------------------------------------------
-- Private feature tables. Hash browser secrets before storage.
-- ---------------------------------------------------------------------------

create table if not exists public.post_reports (
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (post_id, reporter_hash)
);

create table if not exists public.comment_reports (
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (comment_id, reporter_hash)
);

create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  emoji text not null,
  reactor_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (comment_id, emoji, reactor_hash)
);

create table if not exists public.push_subscriptions (
  device_hash bytea primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  interest_areas jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  quiet_start smallint,
  quiet_end smallint,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

-- Upgrade upstream v4 tables that used plaintext secret columns.
alter table public.post_reports add column if not exists reporter_hash bytea;
alter table public.comment_reports add column if not exists reporter_hash bytea;
alter table public.comment_reactions add column if not exists reactor_hash bytea;
alter table public.push_subscriptions add column if not exists device_hash bytea;

do $migration$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'post_reports' and column_name = 'reporter_secret'
  ) then
    alter table public.post_reports alter column reporter_secret drop not null;
    execute $sql$
      update public.post_reports
      set reporter_hash = extensions.digest(reporter_secret, 'sha256')
      where reporter_hash is null and reporter_secret is not null
    $sql$;
    execute 'update public.post_reports set reporter_secret = null where reporter_secret is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comment_reports' and column_name = 'reporter_secret'
  ) then
    alter table public.comment_reports alter column reporter_secret drop not null;
    execute $sql$
      update public.comment_reports
      set reporter_hash = extensions.digest(reporter_secret, 'sha256')
      where reporter_hash is null and reporter_secret is not null
    $sql$;
    execute 'update public.comment_reports set reporter_secret = null where reporter_secret is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comment_reactions' and column_name = 'reactor_secret'
  ) then
    alter table public.comment_reactions alter column reactor_secret drop not null;
    execute $sql$
      update public.comment_reactions
      set reactor_hash = extensions.digest(reactor_secret, 'sha256')
      where reactor_hash is null and reactor_secret is not null
    $sql$;
    execute 'update public.comment_reactions set reactor_secret = null where reactor_secret is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_subscriptions' and column_name = 'device_secret'
  ) then
    alter table public.push_subscriptions alter column device_secret drop not null;
    execute $sql$
      update public.push_subscriptions
      set device_hash = extensions.digest(device_secret, 'sha256')
      where device_hash is null and device_secret is not null
    $sql$;
    execute 'update public.push_subscriptions set device_secret = null where device_secret is not null';
  end if;
end
$migration$;

alter table public.post_reports alter column reporter_hash set not null;
alter table public.comment_reports alter column reporter_hash set not null;
alter table public.comment_reactions alter column reactor_hash set not null;
alter table public.push_subscriptions alter column device_hash set not null;

create unique index if not exists post_reports_target_hash_v2_idx
  on public.post_reports(post_id, reporter_hash);
create unique index if not exists comment_reports_target_hash_v2_idx
  on public.comment_reports(comment_id, reporter_hash);
create unique index if not exists comment_reactions_target_hash_v2_idx
  on public.comment_reactions(comment_id, emoji, reactor_hash);
create unique index if not exists push_subscriptions_device_hash_v2_idx
  on public.push_subscriptions(device_hash);

alter table public.post_owners enable row level security;
alter table public.pin_owners enable row level security;
alter table public.post_reports enable row level security;
alter table public.comment_reports enable row level security;
alter table public.comment_reactions enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on public.post_owners from anon, authenticated;
revoke all on public.pin_owners from anon, authenticated;
revoke all on public.post_reports from anon, authenticated;
revoke all on public.comment_reports from anon, authenticated;
revoke all on public.comment_reactions from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;

-- Hidden content must be excluded by the database policy as well as the UI query.
drop policy if exists posts_v1_public_read on public.posts;
drop policy if exists posts_v2_public_read on public.posts;
create policy posts_v2_public_read on public.posts
  for select to anon, authenticated using (hidden = false);

drop policy if exists comments_v1_public_read on public.comments;
drop policy if exists comments_v2_public_read on public.comments;
create policy comments_v2_public_read on public.comments
  for select to anon, authenticated using (hidden = false);

-- ---------------------------------------------------------------------------
-- Device-bound encrypted ownership recovery
-- ---------------------------------------------------------------------------

create or replace function public.create_post_v3(
  p_post_id uuid,
  p_actor_token text,
  p_owner_secret text,
  p_author_lat double precision,
  p_author_lng double precision,
  p_lat double precision,
  p_lng double precision,
  p_category text,
  p_title text,
  p_content text,
  p_image_url text,
  p_icon text,
  p_device_secret text
) returns public.posts
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_post public.posts;
begin
  if p_device_secret is not null and char_length(p_device_secret) < 32 then
    raise exception 'invalid device secret' using errcode = '22023';
  end if;

  v_post := public.create_post_v2(
    p_post_id, p_actor_token, p_owner_secret, p_author_lat, p_author_lng,
    p_lat, p_lng, p_category, p_title, p_content, p_image_url, p_icon
  );

  if p_device_secret is not null then
    update public.post_owners
    set device_secret_hash = extensions.digest(p_device_secret, 'sha256'),
        recovery_ciphertext = extensions.pgp_sym_encrypt(
          p_owner_secret, p_device_secret, 'cipher-algo=aes256'
        )
    where post_id = p_post_id
      and owner_secret_hash = extensions.digest(p_owner_secret, 'sha256');
  end if;

  return v_post;
end;
$function$;

create or replace function public.create_pin_v3(
  p_pin_id uuid,
  p_actor_token text,
  p_lat double precision,
  p_lng double precision,
  p_owner_secret text,
  p_device_secret text
) returns public.pins
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_pin public.pins;
begin
  if p_device_secret is not null and char_length(p_device_secret) < 32 then
    raise exception 'invalid device secret' using errcode = '22023';
  end if;

  v_pin := public.create_pin_v2(p_pin_id, p_actor_token, p_lat, p_lng, p_owner_secret);

  if p_device_secret is not null then
    update public.pin_owners
    set device_secret_hash = extensions.digest(p_device_secret, 'sha256'),
        recovery_ciphertext = extensions.pgp_sym_encrypt(
          p_owner_secret, p_device_secret, 'cipher-algo=aes256'
        )
    where pin_id = p_pin_id
      and owner_secret_hash = extensions.digest(p_owner_secret, 'sha256');
  end if;

  return v_pin;
end;
$function$;

create or replace function public.restore_ownership_v2(
  p_device_secret text,
  p_actor_token text
) returns table(target_type text, target_id uuid, owner_secret text)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
begin
  if p_device_secret is null or char_length(p_device_secret) < 32 then
    raise exception 'invalid recovery code' using errcode = '22023';
  end if;

  perform public.assert_write_rate_v1('ownership_restore_actor', p_actor_token, 10, interval '15 minutes');
  perform public.assert_write_rate_v1('ownership_restore_code', p_device_secret, 5, interval '15 minutes');

  return query
  select recovered.target_type, recovered.target_id, recovered.owner_secret
  from (
    select
      'post'::text as target_type,
      po.post_id as target_id,
      extensions.pgp_sym_decrypt(po.recovery_ciphertext, p_device_secret) as owner_secret
    from public.post_owners po
    where po.device_secret_hash = extensions.digest(p_device_secret, 'sha256')
      and po.recovery_ciphertext is not null

    union all

    select
      'pin'::text,
      po.pin_id,
      extensions.pgp_sym_decrypt(po.recovery_ciphertext, p_device_secret)
    from public.pin_owners po
    where po.device_secret_hash = extensions.digest(p_device_secret, 'sha256')
      and po.recovery_ciphertext is not null
  ) recovered
  order by recovered.target_type, recovered.target_id
  limit 500;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Threaded comments, reports and atomic reactions
-- ---------------------------------------------------------------------------

create or replace function public.create_comment_v3(
  p_comment_id uuid,
  p_post_id uuid,
  p_actor_token text,
  p_content text,
  p_parent_comment_id uuid default null
) returns public.comments
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_comment public.comments;
begin
  perform public.assert_write_rate_v1('comment_create', p_actor_token, 10, interval '5 minutes');

  if not exists (select 1 from public.posts where id = p_post_id and hidden = false) then
    raise exception 'post not found' using errcode = '22023';
  end if;
  if p_parent_comment_id is not null and not exists (
    select 1 from public.comments
    where id = p_parent_comment_id
      and post_id = p_post_id
      and parent_comment_id is null
      and hidden = false
  ) then
    raise exception 'invalid parent comment' using errcode = '22023';
  end if;

  insert into public.comments(id, post_id, content, parent_comment_id, created_at)
  values (p_comment_id, p_post_id, btrim(p_content), p_parent_comment_id, clock_timestamp())
  on conflict (id) do nothing
  returning * into v_comment;

  if v_comment.id is null then
    select * into strict v_comment from public.comments where id = p_comment_id;
    if v_comment.post_id is distinct from p_post_id
       or v_comment.content is distinct from btrim(p_content)
       or v_comment.parent_comment_id is distinct from p_parent_comment_id then
      raise exception 'idempotency key already used' using errcode = '23505';
    end if;
  end if;
  return v_comment;
end;
$function$;

create or replace function public.report_post_v2(
  p_post_id uuid,
  p_reporter_secret text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_inserted integer;
  v_count integer;
  v_hidden boolean;
begin
  perform public.assert_write_rate_v1('post_report', p_reporter_secret, 30, interval '1 hour');
  perform pg_advisory_xact_lock(hashtextextended('post_report:' || p_post_id::text, 0));

  if not exists (select 1 from public.posts where id = p_post_id) then
    raise exception 'post not found' using errcode = '22023';
  end if;

  insert into public.post_reports(post_id, reporter_hash)
  values (p_post_id, extensions.digest(p_reporter_secret, 'sha256'))
  on conflict (post_id, reporter_hash) do nothing;
  get diagnostics v_inserted = row_count;

  select count(*) into v_count from public.post_reports where post_id = p_post_id;
  update public.posts
  set report_count = v_count,
      hidden = hidden or v_count >= 5
  where id = p_post_id
  returning hidden into v_hidden;

  return jsonb_build_object(
    'report_count', v_count,
    'hidden', v_hidden,
    'already_reported', v_inserted = 0
  );
end;
$function$;

create or replace function public.report_comment_v2(
  p_comment_id uuid,
  p_reporter_secret text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_inserted integer;
  v_count integer;
  v_hidden boolean;
begin
  perform public.assert_write_rate_v1('comment_report', p_reporter_secret, 30, interval '1 hour');
  perform pg_advisory_xact_lock(hashtextextended('comment_report:' || p_comment_id::text, 0));

  if not exists (select 1 from public.comments where id = p_comment_id) then
    raise exception 'comment not found' using errcode = '22023';
  end if;

  insert into public.comment_reports(comment_id, reporter_hash)
  values (p_comment_id, extensions.digest(p_reporter_secret, 'sha256'))
  on conflict (comment_id, reporter_hash) do nothing;
  get diagnostics v_inserted = row_count;

  select count(*) into v_count from public.comment_reports where comment_id = p_comment_id;
  update public.comments
  set report_count = v_count,
      hidden = hidden or v_count >= 5
  where id = p_comment_id
  returning hidden into v_hidden;

  return jsonb_build_object(
    'report_count', v_count,
    'hidden', v_hidden,
    'already_reported', v_inserted = 0
  );
end;
$function$;

create or replace function public.react_to_comment_v2(
  p_comment_id uuid,
  p_emoji text,
  p_reactor_secret text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_changed integer;
  v_count integer;
  v_reacted boolean;
  v_reactions jsonb;
begin
  if p_emoji not in ('👍', '❤️', '😂', '😮', '😢') then
    raise exception 'invalid emoji' using errcode = '22023';
  end if;
  perform public.assert_write_rate_v1('comment_reaction', p_reactor_secret, 60, interval '10 minutes');
  perform pg_advisory_xact_lock(hashtextextended('comment_reaction:' || p_comment_id::text, 0));

  if not exists (select 1 from public.comments where id = p_comment_id and hidden = false) then
    raise exception 'comment not found' using errcode = '22023';
  end if;

  delete from public.comment_reactions
  where comment_id = p_comment_id
    and emoji = p_emoji
    and reactor_hash = extensions.digest(p_reactor_secret, 'sha256');
  get diagnostics v_changed = row_count;

  if v_changed = 1 then
    v_reacted := false;
  else
    insert into public.comment_reactions(comment_id, emoji, reactor_hash)
    values (p_comment_id, p_emoji, extensions.digest(p_reactor_secret, 'sha256'));
    v_reacted := true;
  end if;

  select count(*) into v_count
  from public.comment_reactions
  where comment_id = p_comment_id and emoji = p_emoji;

  select reactions into v_reactions from public.comments where id = p_comment_id for update;
  if v_count = 0 then
    v_reactions := v_reactions - p_emoji;
  else
    v_reactions := jsonb_set(v_reactions, array[p_emoji], to_jsonb(v_count), true);
  end if;
  update public.comments set reactions = v_reactions where id = p_comment_id;

  return jsonb_build_object('emoji', p_emoji, 'count', v_count, 'reacted', v_reacted);
end;
$function$;

-- A successful new confirmation refreshes the post's freshness timestamp.
create or replace function public.confirm_post_v2(
  p_post_id uuid,
  p_actor_token text
) returns public.posts
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_inserted integer;
  v_post public.posts;
begin
  perform public.assert_write_rate_v1('post_confirm', p_actor_token, 30, interval '10 minutes');

  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and p.hidden = false
      and p.category in ('웨이팅', '혼잡', '사건사고', '교통')
  ) then
    raise exception 'post does not accept confirmations' using errcode = '22023';
  end if;

  insert into public.post_reactions(post_id, actor_hash, kind)
  values (p_post_id, extensions.digest(p_actor_token, 'sha256'), 'confirm')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.posts p
    set confirm_count = p.confirm_count + 1,
        last_confirmed_at = clock_timestamp()
    where p.id = p_post_id
    returning * into v_post;
  else
    select * into strict v_post from public.posts where id = p_post_id;
  end if;

  return v_post;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Push subscription preferences. Delivery remains a deployment worker concern.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_push_subscription_v2(
  p_device_secret text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_interest_areas jsonb,
  p_keywords jsonb,
  p_quiet_start smallint,
  p_quiet_end smallint
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_device_hash bytea;
  v_interest_areas jsonb := coalesce(p_interest_areas, '[]'::jsonb);
  v_keywords jsonb := coalesce(p_keywords, '[]'::jsonb);
begin
  if p_device_secret is null or char_length(p_device_secret) < 32 then
    raise exception 'invalid device secret' using errcode = '22023';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 2048 then
    raise exception 'invalid push endpoint' using errcode = '22023';
  end if;
  if p_p256dh is null or p_auth is null
     or char_length(p_p256dh) not between 16 and 512
     or char_length(p_auth) not between 8 and 256 then
    raise exception 'invalid push keys' using errcode = '22023';
  end if;
  if jsonb_typeof(v_interest_areas) <> 'array' or jsonb_array_length(v_interest_areas) > 2 then
    raise exception 'invalid interest areas' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_interest_areas) area
    where jsonb_typeof(area) <> 'object'
      or jsonb_typeof(area->'lat') <> 'number'
      or jsonb_typeof(area->'lng') <> 'number'
      or jsonb_typeof(area->'radius_m') <> 'number'
  ) then
    raise exception 'invalid interest area shape' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_interest_areas) area
    where (area->>'lat')::double precision not between -90 and 90
      or (area->>'lng')::double precision not between -180 and 180
      or (area->>'radius_m')::integer not between 100 and 2000
  ) then
    raise exception 'invalid interest area values' using errcode = '22023';
  end if;
  if jsonb_typeof(v_keywords) <> 'array' or jsonb_array_length(v_keywords) > 10 then
    raise exception 'invalid keywords' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_keywords) keyword
    where jsonb_typeof(keyword) <> 'string'
      or char_length(btrim(keyword #>> '{}')) not between 1 and 30
  ) then
    raise exception 'invalid keyword value' using errcode = '22023';
  end if;
  if (p_quiet_start is null) <> (p_quiet_end is null)
     or p_quiet_start not between 0 and 23
     or p_quiet_end not between 0 and 23 then
    raise exception 'invalid quiet hours' using errcode = '22023';
  end if;

  perform public.assert_write_rate_v1('push_upsert', p_device_secret, 20, interval '1 hour');
  v_device_hash := extensions.digest(p_device_secret, 'sha256');
  perform pg_advisory_xact_lock(hashtextextended('push_endpoint:' || p_endpoint, 0));
  perform pg_advisory_xact_lock(hashtextextended('push_device:' || encode(v_device_hash, 'hex'), 0));

  delete from public.push_subscriptions
  where endpoint = p_endpoint and device_hash <> v_device_hash;

  insert into public.push_subscriptions(
    device_hash, endpoint, p256dh, auth, interest_areas, keywords,
    quiet_start, quiet_end, created_at, updated_at
  ) values (
    v_device_hash, p_endpoint, p_p256dh, p_auth, v_interest_areas, v_keywords,
    p_quiet_start, p_quiet_end, clock_timestamp(), clock_timestamp()
  )
  on conflict (device_hash) do update
  set endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      interest_areas = excluded.interest_areas,
      keywords = excluded.keywords,
      quiet_start = excluded.quiet_start,
      quiet_end = excluded.quiet_end,
      updated_at = clock_timestamp();

  return true;
end;
$function$;

create or replace function public.delete_push_subscription_v2(
  p_device_secret text
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_deleted integer;
begin
  perform public.assert_write_rate_v1('push_delete', p_device_secret, 10, interval '1 hour');
  delete from public.push_subscriptions
  where device_hash = extensions.digest(p_device_secret, 'sha256');
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$function$;

-- Revoke obsolete plaintext feature RPCs if an upstream v4 schema installed them.
do $migration$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'restore_ownership', 'report_post', 'report_comment', 'react_to_comment',
        'upsert_push_subscription', 'delete_push_subscription'
      )
  loop
    execute 'revoke execute on function ' || fn.signature || ' from public, anon, authenticated';
  end loop;
end
$migration$;

revoke all on function public.create_post_v3(uuid,text,text,double precision,double precision,double precision,double precision,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.create_pin_v3(uuid,text,double precision,double precision,text,text) from public, anon, authenticated;
revoke all on function public.restore_ownership_v2(text,text) from public, anon, authenticated;
revoke all on function public.create_comment_v3(uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.report_post_v2(uuid,text) from public, anon, authenticated;
revoke all on function public.report_comment_v2(uuid,text) from public, anon, authenticated;
revoke all on function public.react_to_comment_v2(uuid,text,text) from public, anon, authenticated;
revoke all on function public.upsert_push_subscription_v2(text,text,text,text,jsonb,jsonb,smallint,smallint) from public, anon, authenticated;
revoke all on function public.delete_push_subscription_v2(text) from public, anon, authenticated;

grant execute on function public.create_post_v3(uuid,text,text,double precision,double precision,double precision,double precision,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.create_pin_v3(uuid,text,double precision,double precision,text,text) to anon, authenticated;
grant execute on function public.restore_ownership_v2(text,text) to anon, authenticated;
grant execute on function public.create_comment_v3(uuid,uuid,text,text,uuid) to anon, authenticated;
grant execute on function public.report_post_v2(uuid,text) to anon, authenticated;
grant execute on function public.report_comment_v2(uuid,text) to anon, authenticated;
grant execute on function public.react_to_comment_v2(uuid,text,text) to anon, authenticated;
grant execute on function public.upsert_push_subscription_v2(text,text,text,text,jsonb,jsonb,smallint,smallint) to anon, authenticated;
grant execute on function public.delete_push_subscription_v2(text) to anon, authenticated;
