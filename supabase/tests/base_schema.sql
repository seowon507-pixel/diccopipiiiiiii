\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

create schema extensions;
create extension pgcrypto with schema extensions;

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
  updated_at timestamptz
);

create table public.post_owners (
  post_id uuid primary key references public.posts(id) on delete cascade,
  owner_secret text not null
);

create table public.pins (
  id uuid primary key default extensions.gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create table public.pin_owners (
  pin_id uuid primary key references public.pins(id) on delete cascade,
  owner_secret text not null
);

create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  content text not null,
  created_at timestamptz not null default now()
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
insert into public.post_owners(post_id, owner_secret)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('p', 32));

insert into public.pins(id, lat, lng)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 37.5665, 126.9780);
insert into public.pin_owners(pin_id, owner_secret)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repeat('q', 32));

grant select, insert, update, delete on public.posts to anon, authenticated;
grant select, insert, update, delete on public.pins to anon, authenticated;
grant select, insert, update, delete on public.comments to anon, authenticated;
grant select, insert, update, delete on public.chat_messages to anon, authenticated;

create function public.create_post_with_owner() returns void language plpgsql as $$ begin null; end $$;
create function public.delete_own_post() returns void language plpgsql as $$ begin null; end $$;
create function public.create_pin_with_owner() returns void language plpgsql as $$ begin null; end $$;
create function public.delete_own_pin() returns void language plpgsql as $$ begin null; end $$;
create function public.delete_expired_pins() returns void language plpgsql as $$ begin null; end $$;
