\set ON_ERROR_STOP on

do $verify$
begin
  if has_table_privilege('anon', 'public.post_reports', 'SELECT')
     or has_table_privilege('anon', 'public.push_subscriptions', 'SELECT') then
    raise exception 'anon must not read private feature tables';
  end if;
  if not has_function_privilege(
    'anon',
    'public.create_post_v3(uuid,text,text,double precision,double precision,double precision,double precision,text,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'anon must execute create_post_v3';
  end if;
  if to_regprocedure('public.report_post(uuid,text)') is not null
     and has_function_privilege('anon', to_regprocedure('public.report_post(uuid,text)'), 'EXECUTE') then
    raise exception 'legacy report_post must not remain executable';
  end if;
end
$verify$;

select public.create_post_v3(
  '44444444-4444-4444-8444-444444444444',
  repeat('a', 32),
  repeat('o', 32),
  37.5665,
  126.9780,
  37.5665,
  126.9780,
  '웨이팅',
  'v4 테스트',
  '복구 가능한 게시글',
  null,
  'pin',
  repeat('d', 32)
);

select public.create_pin_v3(
  '55555555-5555-4555-8555-555555555555',
  repeat('b', 32),
  37.5665,
  126.9780,
  repeat('p', 32),
  repeat('d', 32)
);

select public.confirm_post_v2(
  '44444444-4444-4444-8444-444444444444',
  repeat('c', 32)
);

do $verify$
begin
  if (select last_confirmed_at from public.posts where id = '44444444-4444-4444-8444-444444444444') is null then
    raise exception 'confirmation freshness timestamp was not updated';
  end if;
  if not exists (
    select 1 from public.restore_ownership_v2(repeat('d', 32), repeat('x', 32))
    where target_type = 'post'
      and target_id = '44444444-4444-4444-8444-444444444444'
      and owner_secret = repeat('o', 32)
  ) then
    raise exception 'encrypted post ownership was not restored';
  end if;
  if not exists (
    select 1 from public.restore_ownership_v2(repeat('d', 32), repeat('y', 32))
    where target_type = 'pin'
      and target_id = '55555555-5555-4555-8555-555555555555'
      and owner_secret = repeat('p', 32)
  ) then
    raise exception 'encrypted pin ownership was not restored';
  end if;
  if not exists (
    select 1 from public.restore_ownership_v2(repeat('d', 32), repeat('w', 32))
    where target_type = 'post'
      and target_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and owner_secret = repeat('p', 32)
  ) then
    raise exception 'legacy plaintext recovery data was not encrypted before erasure';
  end if;
  if exists (
    select 1 from public.post_owners
    where post_id = '44444444-4444-4444-8444-444444444444'
      and (owner_secret is not null or recovery_ciphertext is null)
  ) then
    raise exception 'post recovery escrow is not encrypted';
  end if;
end
$verify$;

select public.create_comment_v3(
  '66666666-6666-4666-8666-666666666666',
  '44444444-4444-4444-8444-444444444444',
  repeat('e', 32),
  '최상위 댓글',
  null
);

select public.create_comment_v3(
  '77777777-7777-4777-8777-777777777777',
  '44444444-4444-4444-8444-444444444444',
  repeat('f', 32),
  '한 단계 답글',
  '66666666-6666-4666-8666-666666666666'
);

do $verify$
begin
  begin
    perform public.create_comment_v3(
      '88888888-8888-4888-8888-888888888888',
      '44444444-4444-4444-8444-444444444444',
      repeat('g', 32),
      '허용되지 않는 2단계 답글',
      '77777777-7777-4777-8777-777777777777'
    );
    raise exception 'nested reply unexpectedly succeeded';
  exception when sqlstate '22023' then
    null;
  end;
end
$verify$;

select public.react_to_comment_v2(
  '66666666-6666-4666-8666-666666666666', '👍', repeat('r', 32)
);
select public.react_to_comment_v2(
  '66666666-6666-4666-8666-666666666666', '👍', repeat('r', 32)
);

do $verify$
begin
  if (select reactions ? '👍' from public.comments where id = '66666666-6666-4666-8666-666666666666') then
    raise exception 'reaction toggle did not remove zero count key';
  end if;
end
$verify$;

select public.report_post_v2('44444444-4444-4444-8444-444444444444', repeat('1', 32));
select public.report_post_v2('44444444-4444-4444-8444-444444444444', repeat('2', 32));
select public.report_post_v2('44444444-4444-4444-8444-444444444444', repeat('3', 32));
select public.report_post_v2('44444444-4444-4444-8444-444444444444', repeat('4', 32));
select public.report_post_v2('44444444-4444-4444-8444-444444444444', repeat('5', 32));
select public.report_post_v2('44444444-4444-4444-8444-444444444444', repeat('5', 32));

do $verify$
begin
  if not (select hidden from public.posts where id = '44444444-4444-4444-8444-444444444444') then
    raise exception 'five reports did not hide the post';
  end if;
  if (select report_count from public.posts where id = '44444444-4444-4444-8444-444444444444') <> 5 then
    raise exception 'duplicate report was counted';
  end if;
  if exists (select 1 from public.post_reports where reporter_hash is null) then
    raise exception 'reporter hash was not stored';
  end if;
  if exists (select 1 from public.post_reports where reporter_secret is not null)
     or exists (select 1 from public.comment_reports where reporter_secret is not null)
     or exists (select 1 from public.comment_reactions where reactor_secret is not null) then
    raise exception 'legacy plaintext feature secrets remain';
  end if;
end
$verify$;

select public.upsert_push_subscription_v2(
  repeat('z', 32),
  'https://push.example/subscription',
  repeat('k', 32),
  repeat('h', 16),
  '[{"lat":37.5665,"lng":126.978,"radius_m":500}]'::jsonb,
  '["도로"]'::jsonb,
  23::smallint,
  7::smallint
);

do $verify$
begin
  if not exists (
    select 1 from public.push_subscriptions
    where device_hash = extensions.digest(repeat('z', 32), 'sha256')
      and endpoint = 'https://push.example/subscription'
  ) then
    raise exception 'push subscription was not upserted by device hash';
  end if;
end
$verify$;

select public.delete_push_subscription_v2(repeat('z', 32));
