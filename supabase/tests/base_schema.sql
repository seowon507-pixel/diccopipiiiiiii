\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

create schema extensions;
create extension pgcrypto with schema extensions;

-- Minimal Supabase Auth contract used by the v6 profile/RBAC migration tests.
create schema auth;
create table auth.users (
  id uuid primary key,
  email text unique
);
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.posts (
  id uuid primary key default extensions.gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  category text not null,
  title text,
  content text not null,
  confirm_count integer not null default 0,
  likes_count integer not null default 0,
  post_type text not null default 'local',
  image_url text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  report_count integer default 0,
  hidden boolean default false,
  last_confirmed_at timestamptz
);

create table public.post_owners (
  post_id uuid primary key references public.posts(id) on delete cascade,
  owner_secret text not null,
  device_secret text
);

create table public.pins (
  id uuid primary key default extensions.gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create table public.pin_owners (
  pin_id uuid primary key references public.pins(id) on delete cascade,
  owner_secret text not null,
  device_secret text
);

create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  report_count integer default 0,
  hidden boolean default false,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  reactions jsonb default '{}'::jsonb
);

create table public.chat_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Simulate the plaintext feature tables found in the upstream v4 schema so
-- the hardening migrations also test an in-place upgrade, not only a fresh DB.
create table public.post_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_secret text not null,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_secret)
);

create table public.comment_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_secret text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_secret)
);

create table public.comment_reactions (
  id uuid primary key default extensions.gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  emoji text not null,
  reactor_secret text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, emoji, reactor_secret)
);

create table public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  device_secret text not null unique,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  interest_areas jsonb default '[]'::jsonb,
  keywords jsonb default '[]'::jsonb,
  quiet_start smallint,
  quiet_end smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.posts(id, lat, lng, category, title, content)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  37.5665,
  126.9780,
  '일상',
  '기존 글',
  'migration 이전 글'
);
insert into public.post_owners(post_id, owner_secret, device_secret)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('p', 32), repeat('d', 32));

insert into public.pins(id, lat, lng)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 37.5665, 126.9780);
insert into public.pin_owners(pin_id, owner_secret, device_secret)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repeat('q', 32), repeat('d', 32));

insert into public.comments(id, post_id, content)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '기존 댓글');

insert into public.post_reports(post_id, reporter_secret)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('r', 32));
insert into public.comment_reports(comment_id, reporter_secret)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', repeat('s', 32));
insert into public.comment_reactions(comment_id, emoji, reactor_secret)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '👍', repeat('t', 32));
insert into public.push_subscriptions(device_secret, endpoint, p256dh, auth)
values (repeat('u', 32), 'https://push.example/legacy', repeat('k', 32), repeat('h', 16));

grant select, insert, update, delete on public.posts to anon, authenticated;
grant select, insert, update, delete on public.pins to anon, authenticated;
grant select, insert, update, delete on public.comments to anon, authenticated;
grant select, insert, update, delete on public.chat_messages to anon, authenticated;

create function public.create_post_with_owner() returns void language plpgsql as $$ begin null; end $$;
create function public.delete_own_post() returns void language plpgsql as $$ begin null; end $$;
create function public.create_pin_with_owner() returns void language plpgsql as $$ begin null; end $$;
create function public.delete_own_pin() returns void language plpgsql as $$ begin null; end $$;
create function public.delete_expired_pins() returns void language plpgsql as $$ begin null; end $$;
create function public.restore_ownership(text) returns void language plpgsql as $$ begin null; end $$;
create function public.report_post(uuid, text) returns void language plpgsql as $$ begin null; end $$;
create function public.report_comment(uuid, text) returns void language plpgsql as $$ begin null; end $$;
create function public.react_to_comment(uuid, text, text) returns void language plpgsql as $$ begin null; end $$;
create function public.upsert_push_subscription(text) returns void language plpgsql as $$ begin null; end $$;
create function public.delete_push_subscription(text) returns void language plpgsql as $$ begin null; end $$;
