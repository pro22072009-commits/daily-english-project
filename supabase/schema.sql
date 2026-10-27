-- Daily English: account profile and per-key cloud snapshots.
-- Run once in the Supabase SQL editor. All user data is protected by RLS.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_data (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_key text not null check (entity_key in ('dailyEnglishProgressV1','dailyEnglishAcademicDraftsV2','dailyEnglishBandsV1','dailyEnglishSystemV2')),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_key)
);

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users read own data" on public.user_data;
create policy "Users read own data" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users insert own data" on public.user_data;
create policy "Users insert own data" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own data" on public.user_data;
create policy "Users update own data" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_data to authenticated;

create or replace function public.create_daily_english_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_daily_english_user_created on auth.users;
create trigger on_daily_english_user_created after insert on auth.users
for each row execute procedure public.create_daily_english_profile();
