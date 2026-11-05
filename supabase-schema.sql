-- Bookends shared volunteer inventory (Supabase PostgreSQL)
-- Run in Supabase SQL Editor. Create the organisation, then add volunteer auth users
-- and membership rows. Keep the anon/publishable key in the PWA; NEVER expose service_role.
create extension if not exists pgcrypto;
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.org_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'volunteer' check (role in ('admin','volunteer')),
  primary key (organization_id,user_id)
);
create or replace function public.is_bookends_member(org uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.org_members m where m.organization_id=org and m.user_id=auth.uid()); $$;
create table if not exists public.books (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  isbn text, title text not null default '', author text, publisher text, "pubDate" text,
  language text, category text, subcategory text, description text,
  "createdAt" timestamptz, "updatedAt" timestamptz
);
create table if not exists public.copies (
  id uuid primary key,
  "bookId" uuid not null references public.books(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  condition text, price numeric(10,2), location text, status text,
  "receivedAt" timestamptz, "updatedAt" timestamptz
);
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.books enable row level security;
alter table public.copies enable row level security;
create policy "members can read own org" on public.organizations for select using (public.is_bookends_member(id));
create policy "members can read membership" on public.org_members for select using (public.is_bookends_member(organization_id));
create policy "members manage books" on public.books for all using (public.is_bookends_member(organization_id)) with check (public.is_bookends_member(organization_id));
create policy "members manage copies" on public.copies for all using (public.is_bookends_member(organization_id)) with check (public.is_bookends_member(organization_id));
-- Admin setup: after creating an organisation and volunteer users in Authentication,
-- insert membership rows using the SQL editor (substitute actual UUIDs):
-- insert into public.organizations (name) values ('Bookends Eastbourne') returning id;
-- insert into public.org_members (organization_id,user_id,role)
-- values ('ORG-UUID','AUTH-USER-UUID','admin');
