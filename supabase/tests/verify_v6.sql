\set ON_ERROR_STOP on

insert into auth.users(id, email) values
  ('10000000-0000-4000-8000-000000000001', 'member@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'admin@example.test');

insert into private.user_roles(user_id, role)
values ('10000000-0000-4000-8000-000000000002', 'admin');

do $verify$
begin
  if has_function_privilege('anon', 'public.report_post_v3(uuid)', 'EXECUTE') then
    raise exception 'anon must not execute account-bound report RPC';
  end if;
  if has_function_privilege('authenticated', 'public.report_post_v2(uuid,text)', 'EXECUTE') then
    raise exception 'authenticated must not bypass account-bound report deduplication with v2';
  end if;
  if not has_function_privilege('authenticated', 'public.report_post_v3(uuid)', 'EXECUTE') then
    raise exception 'authenticated must execute report_post_v3';
  end if;
  if has_table_privilege('authenticated', 'private.user_roles', 'SELECT') then
    raise exception 'authenticated must not read role registry directly';
  end if;
  if has_table_privilege('authenticated', 'public.moderation_audit_log', 'SELECT') then
    raise exception 'authenticated must not read moderation audit rows directly';
  end if;
end
$verify$;

set role authenticated;
set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

select public.set_username('member_01');
select public.report_post_v3('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.report_post_v3('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

do $verify$
begin
  if public.current_app_role_v1() <> 'user' then
    raise exception 'ordinary account received an elevated role';
  end if;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'profile RLS did not isolate the current user';
  end if;
  if exists (select 1 from public.list_moderation_queue_v1(null, 100, 0)) then
    raise exception 'ordinary account could read moderation queue';
  end if;
end
$verify$;

reset role;

do $verify$
begin
  if (
    select count(*) from public.post_reports
    where post_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and reporter_user_id = '10000000-0000-4000-8000-000000000001'
  ) <> 1 then
    raise exception 'same account report was not deduplicated';
  end if;
  if not exists (
    select 1 from public.moderation_cases
    where target_type = 'post'
      and target_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and status = 'pending'
  ) then
    raise exception 'report did not create or refresh a moderation case';
  end if;
end
$verify$;

set role authenticated;
set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select public.set_username('admin_01');

do $verify$
declare
  v_case_id bigint;
begin
  if public.current_app_role_v1() <> 'admin' then
    raise exception 'assigned admin role was not resolved';
  end if;

  select q.case_id into v_case_id
  from public.list_moderation_queue_v1('pending', 100, 0) q
  where q.target_type = 'post'
    and q.target_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_case_id is null then
    raise exception 'admin could not read safe moderation queue';
  end if;

  perform public.resolve_moderation_case_v1(v_case_id, 'hide', 'verify hide');
  if not (select hidden from public.posts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'moderator hide action did not update target';
  end if;

  perform public.resolve_moderation_case_v1(v_case_id, 'restore', 'verify restore');
  if (select hidden from public.posts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'moderator restore action did not update target';
  end if;
end
$verify$;

reset role;

do $verify$
begin
  if not exists (
    select 1 from public.moderation_audit_log
    where actor_user_id = '10000000-0000-4000-8000-000000000002'
      and action = 'hide'
  ) or not exists (
    select 1 from public.moderation_audit_log
    where actor_user_id = '10000000-0000-4000-8000-000000000002'
      and action = 'restore'
  ) then
    raise exception 'moderation actions were not audited';
  end if;
end
$verify$;
