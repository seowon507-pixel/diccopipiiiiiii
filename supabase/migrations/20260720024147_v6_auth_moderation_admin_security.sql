-- Auth/profile reproducibility, account-bound reports, and least-privilege
-- moderation. This migration intentionally does not create a client-facing
-- "make admin" endpoint. Roles are assigned by the project owner in SQL.

-- ---------------------------------------------------------------------------
-- Login profile contract (previously existed only in the remote project)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists created_at timestamptz not null default clock_timestamp();
alter table public.profiles add column if not exists updated_at timestamptz not null default clock_timestamp();

create unique index if not exists profiles_user_id_v1_idx on public.profiles(user_id);
create unique index if not exists profiles_username_lower_v1_idx
  on public.profiles(lower(username)) where username is not null;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_format_v1_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_username_format_v1_check
      check (username ~ '^[A-Za-z0-9_]{2,20}$') not valid;
  end if;
end
$migration$;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists profiles_v1_read_own on public.profiles;
create policy profiles_v1_read_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop function if exists public.is_username_available(text);
create function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and p_username ~ '^[A-Za-z0-9_]{2,20}$'
    and not exists (
      select 1 from public.profiles p
      where lower(p.username) = lower(p_username)
    );
$function$;

drop function if exists public.set_username(text);
create function public.set_username(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{2,20}$' then
    raise exception 'invalid username' using errcode = '22023';
  end if;

  insert into public.profiles(user_id, username, created_at, updated_at)
  values (v_user_id, p_username, clock_timestamp(), clock_timestamp())
  on conflict (user_id) do update
    set username = excluded.username,
        updated_at = clock_timestamp()
  returning * into v_profile;

  return v_profile;
end;
$function$;

revoke all on function public.is_username_available(text) from public, anon, authenticated;
revoke all on function public.set_username(text) from public, anon, authenticated;
grant execute on function public.is_username_available(text) to authenticated;
grant execute on function public.set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Private role registry. user_metadata is deliberately not used for authz.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete set null,
  constraint user_roles_role_v1_check check (role in ('moderator', 'admin'))
);

create index if not exists user_roles_created_by_v1_idx on private.user_roles(created_by);
alter table private.user_roles enable row level security;
alter table private.user_roles force row level security;
revoke all on private.user_roles from public, anon, authenticated;

create or replace function private.current_app_role_v1()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when (select auth.uid()) is null then 'anonymous'
    else coalesce((
      select ur.role from private.user_roles ur
      where ur.user_id = (select auth.uid())
    ), 'user')
  end;
$function$;

create or replace function private.is_moderator_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1 from private.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('moderator', 'admin')
    );
$function$;

revoke all on function private.current_app_role_v1() from public, anon, authenticated;
revoke all on function private.is_moderator_v1() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_app_role_v1() to authenticated;
grant execute on function private.is_moderator_v1() to authenticated;

drop function if exists public.current_app_role_v1();
create function public.current_app_role_v1()
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.current_app_role_v1();
$function$;

revoke all on function public.current_app_role_v1() from public, anon, authenticated;
grant execute on function public.current_app_role_v1() to authenticated;

-- ---------------------------------------------------------------------------
-- Account-bound report identity and moderation case/audit records
-- ---------------------------------------------------------------------------

alter table public.post_reports add column if not exists reporter_user_id uuid;
alter table public.comment_reports add column if not exists reporter_user_id uuid;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'post_reports_reporter_user_v1_fkey'
      and conrelid = 'public.post_reports'::regclass
  ) then
    alter table public.post_reports add constraint post_reports_reporter_user_v1_fkey
      foreign key (reporter_user_id) references auth.users(id) on delete set null not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'comment_reports_reporter_user_v1_fkey'
      and conrelid = 'public.comment_reports'::regclass
  ) then
    alter table public.comment_reports add constraint comment_reports_reporter_user_v1_fkey
      foreign key (reporter_user_id) references auth.users(id) on delete set null not valid;
  end if;
end
$migration$;

create unique index if not exists post_reports_user_target_v1_idx
  on public.post_reports(post_id, reporter_user_id) where reporter_user_id is not null;
create unique index if not exists comment_reports_user_target_v1_idx
  on public.comment_reports(comment_id, reporter_user_id) where reporter_user_id is not null;
create index if not exists post_reports_reporter_user_v1_idx
  on public.post_reports(reporter_user_id) where reporter_user_id is not null;
create index if not exists comment_reports_reporter_user_v1_idx
  on public.comment_reports(reporter_user_id) where reporter_user_id is not null;

create table if not exists public.moderation_cases (
  id bigint generated by default as identity primary key,
  target_type text not null,
  target_id uuid not null,
  report_count integer not null default 0,
  status text not null default 'pending',
  action text,
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  first_reported_at timestamptz not null default clock_timestamp(),
  last_reported_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  constraint moderation_cases_target_type_v1_check check (target_type in ('post', 'comment')),
  constraint moderation_cases_report_count_v1_check check (report_count >= 0),
  constraint moderation_cases_status_v1_check check (status in ('pending', 'actioned', 'dismissed')),
  constraint moderation_cases_action_v1_check check (action is null or action in ('hide', 'restore', 'dismiss')),
  constraint moderation_cases_note_length_v1_check check (resolution_note is null or char_length(resolution_note) <= 1000),
  unique (target_type, target_id)
);

create table if not exists public.moderation_audit_log (
  id bigint generated by default as identity primary key,
  case_id bigint not null references public.moderation_cases(id),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default clock_timestamp(),
  constraint moderation_audit_action_v1_check check (action in ('hide', 'restore', 'dismiss')),
  constraint moderation_audit_note_length_v1_check check (note is null or char_length(note) <= 1000)
);

create index if not exists moderation_cases_status_reported_v1_idx
  on public.moderation_cases(status, last_reported_at desc);
create index if not exists moderation_cases_resolved_by_v1_idx
  on public.moderation_cases(resolved_by) where resolved_by is not null;
create index if not exists moderation_audit_case_created_v1_idx
  on public.moderation_audit_log(case_id, created_at desc);
create index if not exists moderation_audit_actor_v1_idx
  on public.moderation_audit_log(actor_user_id) where actor_user_id is not null;

alter table public.moderation_cases enable row level security;
alter table public.moderation_cases force row level security;
alter table public.moderation_audit_log enable row level security;
alter table public.moderation_audit_log force row level security;
revoke all on public.moderation_cases from anon, authenticated;
revoke all on public.moderation_audit_log from anon, authenticated;
grant select on public.moderation_cases to authenticated;

drop policy if exists moderation_cases_v1_moderator_read on public.moderation_cases;
create policy moderation_cases_v1_moderator_read on public.moderation_cases
  for select to authenticated
  using ((select private.is_moderator_v1()));

drop policy if exists posts_v6_moderator_read on public.posts;
create policy posts_v6_moderator_read on public.posts
  for select to authenticated
  using ((select private.is_moderator_v1()));

drop policy if exists comments_v6_moderator_read on public.comments;
create policy comments_v6_moderator_read on public.comments
  for select to authenticated
  using ((select private.is_moderator_v1()));

-- Convert report inserts into target-level review cases. The trigger never
-- exposes reporter hashes or user IDs to the moderation UI.
create or replace function private.sync_moderation_case_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_target_type text;
  v_target_id uuid;
  v_count integer;
  v_first timestamptz;
  v_last timestamptz;
begin
  if tg_table_name = 'post_reports' then
    v_target_type := 'post';
    v_target_id := new.post_id;
    select count(*), min(r.created_at), max(r.created_at)
      into v_count, v_first, v_last
    from public.post_reports r where r.post_id = new.post_id;
  else
    v_target_type := 'comment';
    v_target_id := new.comment_id;
    select count(*), min(r.created_at), max(r.created_at)
      into v_count, v_first, v_last
    from public.comment_reports r where r.comment_id = new.comment_id;
  end if;

  insert into public.moderation_cases(
    target_type, target_id, report_count, status, first_reported_at, last_reported_at
  ) values (
    v_target_type, v_target_id, v_count, 'pending', v_first, v_last
  )
  on conflict (target_type, target_id) do update
    set report_count = excluded.report_count,
        last_reported_at = excluded.last_reported_at,
        status = case
          when excluded.report_count > public.moderation_cases.report_count then 'pending'
          else public.moderation_cases.status
        end,
        action = case
          when excluded.report_count > public.moderation_cases.report_count then null
          else public.moderation_cases.action
        end,
        resolution_note = case
          when excluded.report_count > public.moderation_cases.report_count then null
          else public.moderation_cases.resolution_note
        end,
        resolved_by = case
          when excluded.report_count > public.moderation_cases.report_count then null
          else public.moderation_cases.resolved_by
        end,
        resolved_at = case
          when excluded.report_count > public.moderation_cases.report_count then null
          else public.moderation_cases.resolved_at
        end;

  return new;
end;
$function$;

revoke all on function private.sync_moderation_case_v1() from public, anon, authenticated;
drop trigger if exists post_reports_sync_case_v1 on public.post_reports;
create trigger post_reports_sync_case_v1
  after insert on public.post_reports
  for each row execute function private.sync_moderation_case_v1();
drop trigger if exists comment_reports_sync_case_v1 on public.comment_reports;
create trigger comment_reports_sync_case_v1
  after insert on public.comment_reports
  for each row execute function private.sync_moderation_case_v1();

insert into public.moderation_cases(
  target_type, target_id, report_count, status, first_reported_at, last_reported_at
)
select 'post', r.post_id, count(*)::integer, 'pending', min(r.created_at), max(r.created_at)
from public.post_reports r group by r.post_id
on conflict (target_type, target_id) do update
  set report_count = excluded.report_count,
      first_reported_at = least(public.moderation_cases.first_reported_at, excluded.first_reported_at),
      last_reported_at = greatest(public.moderation_cases.last_reported_at, excluded.last_reported_at);

insert into public.moderation_cases(
  target_type, target_id, report_count, status, first_reported_at, last_reported_at
)
select 'comment', r.comment_id, count(*)::integer, 'pending', min(r.created_at), max(r.created_at)
from public.comment_reports r group by r.comment_id
on conflict (target_type, target_id) do update
  set report_count = excluded.report_count,
      first_reported_at = least(public.moderation_cases.first_reported_at, excluded.first_reported_at),
      last_reported_at = greatest(public.moderation_cases.last_reported_at, excluded.last_reported_at);

-- Authenticated reports are deduplicated by auth.uid(). Client-provided
-- reporter secrets are no longer accepted by the active endpoint.
create or replace function public.report_post_v3(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_inserted integer;
  v_count integer;
  v_hidden boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform public.assert_write_rate_v1('post_report_user', v_user_id::text, 30, interval '1 hour');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('post_report:' || p_post_id::text, 0));
  if not exists (select 1 from public.posts where id = p_post_id) then
    raise exception 'post not found' using errcode = '22023';
  end if;

  insert into public.post_reports(post_id, reporter_hash, reporter_user_id)
  values (p_post_id, extensions.digest('auth:' || v_user_id::text, 'sha256'), v_user_id)
  on conflict (post_id, reporter_hash) do nothing;
  get diagnostics v_inserted = row_count;

  select count(*) into v_count from public.post_reports where post_id = p_post_id;
  update public.posts set report_count = v_count, hidden = hidden or v_count >= 5
  where id = p_post_id returning hidden into v_hidden;

  return jsonb_build_object(
    'report_count', v_count,
    'hidden', v_hidden,
    'already_reported', v_inserted = 0
  );
end;
$function$;

create or replace function public.report_comment_v3(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_inserted integer;
  v_count integer;
  v_hidden boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform public.assert_write_rate_v1('comment_report_user', v_user_id::text, 30, interval '1 hour');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('comment_report:' || p_comment_id::text, 0));
  if not exists (select 1 from public.comments where id = p_comment_id) then
    raise exception 'comment not found' using errcode = '22023';
  end if;

  insert into public.comment_reports(comment_id, reporter_hash, reporter_user_id)
  values (p_comment_id, extensions.digest('auth:' || v_user_id::text, 'sha256'), v_user_id)
  on conflict (comment_id, reporter_hash) do nothing;
  get diagnostics v_inserted = row_count;

  select count(*) into v_count from public.comment_reports where comment_id = p_comment_id;
  update public.comments set report_count = v_count, hidden = hidden or v_count >= 5
  where id = p_comment_id returning hidden into v_hidden;

  return jsonb_build_object(
    'report_count', v_count,
    'hidden', v_hidden,
    'already_reported', v_inserted = 0
  );
end;
$function$;

revoke all on function public.report_post_v2(uuid,text) from public, anon, authenticated;
revoke all on function public.report_comment_v2(uuid,text) from public, anon, authenticated;
revoke all on function public.report_post_v3(uuid) from public, anon, authenticated;
revoke all on function public.report_comment_v3(uuid) from public, anon, authenticated;
grant execute on function public.report_post_v3(uuid) to authenticated;
grant execute on function public.report_comment_v3(uuid) to authenticated;

-- Safe queue projection: reporter hashes/user IDs are never returned.
drop function if exists public.list_moderation_queue_v1(text,integer,integer);
create function public.list_moderation_queue_v1(
  p_status text default 'pending',
  p_limit integer default 50,
  p_offset integer default 0
) returns table(
  case_id bigint,
  target_type text,
  target_id uuid,
  report_count integer,
  status text,
  action text,
  resolution_note text,
  hidden boolean,
  title text,
  content text,
  target_created_at timestamptz,
  last_reported_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select queue.*
  from (
    select mc.id as case_id, mc.target_type, mc.target_id, mc.report_count, mc.status,
      mc.action, mc.resolution_note, p.hidden, p.title, p.content,
      p.created_at, mc.last_reported_at, mc.resolved_at
    from public.moderation_cases mc
    join public.posts p on mc.target_type = 'post' and p.id = mc.target_id

    union all

    select mc.id, mc.target_type, mc.target_id, mc.report_count, mc.status,
      mc.action, mc.resolution_note, c.hidden, null::text, c.content,
      c.created_at, mc.last_reported_at, mc.resolved_at
    from public.moderation_cases mc
    join public.comments c on mc.target_type = 'comment' and c.id = mc.target_id
  ) queue
  where (select private.is_moderator_v1())
    and (p_status is null or queue.status = p_status)
  order by queue.last_reported_at desc, queue.case_id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

revoke all on function public.list_moderation_queue_v1(text,integer,integer) from public, anon, authenticated;
grant execute on function public.list_moderation_queue_v1(text,integer,integer) to authenticated;

drop function if exists public.resolve_moderation_case_v1(bigint,text,text);
create function public.resolve_moderation_case_v1(
  p_case_id bigint,
  p_action text,
  p_note text default null
) returns public.moderation_cases
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_case public.moderation_cases;
  v_changed integer;
begin
  if v_user_id is null or not (select private.is_moderator_v1()) then
    raise exception 'moderator permission required' using errcode = '42501';
  end if;
  if p_action not in ('hide', 'restore', 'dismiss') then
    raise exception 'invalid moderation action' using errcode = '22023';
  end if;
  if p_note is not null and char_length(btrim(p_note)) > 1000 then
    raise exception 'moderation note too long' using errcode = '22023';
  end if;

  select * into strict v_case from public.moderation_cases
  where id = p_case_id for update;

  if p_action in ('hide', 'restore') then
    if v_case.target_type = 'post' then
      update public.posts set hidden = (p_action = 'hide') where id = v_case.target_id;
    else
      update public.comments set hidden = (p_action = 'hide') where id = v_case.target_id;
    end if;
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then
      raise exception 'moderation target not found' using errcode = '22023';
    end if;
  end if;

  update public.moderation_cases
  set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end,
      action = p_action,
      resolution_note = nullif(btrim(p_note), ''),
      resolved_by = v_user_id,
      resolved_at = clock_timestamp()
  where id = p_case_id
  returning * into v_case;

  insert into public.moderation_audit_log(case_id, actor_user_id, action, note)
  values (p_case_id, v_user_id, p_action, nullif(btrim(p_note), ''));

  return v_case;
end;
$function$;

revoke all on function public.resolve_moderation_case_v1(bigint,text,text) from public, anon, authenticated;
grant execute on function public.resolve_moderation_case_v1(bigint,text,text) to authenticated;

-- Public object URLs remain downloadable for the public post-images bucket,
-- but client roles do not need to enumerate object names/metadata.
do $migration$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists post_images_no_client_listing_v1 on storage.objects';
    execute $policy$
      create policy post_images_no_client_listing_v1
      on storage.objects as restrictive for select to anon, authenticated
      using (bucket_id <> 'post-images')
    $policy$;
  end if;
end
$migration$;
