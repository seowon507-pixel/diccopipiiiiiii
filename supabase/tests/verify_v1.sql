\set ON_ERROR_STOP on

do $verify$
begin
  if has_table_privilege('anon', 'public.posts', 'UPDATE') then
    raise exception 'anon must not update posts directly';
  end if;
  if has_table_privilege('anon', 'public.chat_messages', 'SELECT') then
    raise exception 'anon must not select all chat coordinates';
  end if;
  if not has_function_privilege(
    'anon',
    'public.create_post_v2(uuid,text,text,double precision,double precision,double precision,double precision,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'anon must execute create_post_v2';
  end if;
end
$verify$;

select public.create_post_v2(
  '11111111-1111-4111-8111-111111111111',
  repeat('a', 32),
  repeat('b', 32),
  37.5665,
  126.9780,
  37.5666,
  126.9781,
  '웨이팅',
  '테스트',
  '정상 게시글',
  null,
  'pin'
);

select public.confirm_post_v2(
  '11111111-1111-4111-8111-111111111111',
  repeat('c', 32)
);
select public.confirm_post_v2(
  '11111111-1111-4111-8111-111111111111',
  repeat('c', 32)
);

do $verify$
begin
  if (select confirm_count from public.posts where id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'duplicate confirmation was counted';
  end if;
  if exists (select 1 from public.post_owners where owner_secret is not null) then
    raise exception 'plaintext post owner secret remains';
  end if;
  if exists (select 1 from public.pin_owners where owner_secret is not null) then
    raise exception 'plaintext pin owner secret remains';
  end if;
  if not exists (
    select 1 from public.post_owners
    where post_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and owner_secret_hash = extensions.digest(repeat('p', 32), 'sha256')
  ) then
    raise exception 'legacy post owner hash was not migrated';
  end if;
end
$verify$;

select public.send_chat_message_v2(
  '22222222-2222-4222-8222-222222222222',
  repeat('d', 32),
  37.5665,
  126.9780,
  '가까운 메시지'
);
select public.send_chat_message_v2(
  '33333333-3333-4333-8333-333333333333',
  repeat('e', 32),
  35.1796,
  129.0756,
  '먼 메시지'
);

do $verify$
begin
  if (
    select count(*)
    from public.get_nearby_chat_messages_v2(37.5665, 126.9780, 1000, 200, null)
  ) <> 1 then
    raise exception 'nearby chat radius was not enforced';
  end if;
end
$verify$;
