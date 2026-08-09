begin;

-- User-facing data lives in public tables because auth.users is not exposed by
-- the Data API. Both foreign keys reference the stable auth.users primary key.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (
    full_name is null
    or char_length(btrim(full_name)) between 1 and 100
  )
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  document_type text,
  mime_type text not null,
  file_size bigint not null,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_name_length check (
    char_length(btrim(name)) between 1 and 255
  ),
  constraint documents_type_length check (
    document_type is null
    or char_length(btrim(document_type)) between 1 and 100
  ),
  constraint documents_supported_mime_type check (
    mime_type in ('image/jpeg', 'image/png', 'application/pdf')
  ),
  constraint documents_file_size_range check (
    file_size between 1 and 10485760
  ),
  constraint documents_storage_path_layout check (
    storage_path ~ '^[^/]+/[^/]+/[^/]+$'
    and split_part(storage_path, '/', 1) = user_id::text
    and split_part(storage_path, '/', 2) = id::text
  )
);

create index documents_user_id_idx on public.documents (user_id);

-- Shared trigger function keeps timestamps server-controlled.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

-- New Auth users receive a profile without trusting a frontend-supplied UUID.
-- Blank or unexpectedly long metadata is stored as NULL instead of blocking signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_full_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
begin
  if requested_full_name is not null and char_length(requested_full_name) > 100 then
    requested_full_name := null;
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, requested_full_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill users created before this migration. ON CONFLICT also makes this safe
-- if a signup occurs concurrently after the trigger is installed.
insert into public.profiles (id, full_name, created_at, updated_at)
select
  users.id,
  case
    when nullif(btrim(users.raw_user_meta_data ->> 'full_name'), '') is null then null
    when char_length(btrim(users.raw_user_meta_data ->> 'full_name')) <= 100
      then btrim(users.raw_user_meta_data ->> 'full_name')
    else null
  end,
  users.created_at,
  now()
from auth.users as users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.documents enable row level security;

-- Remove broad API privileges, then grant only operations/columns the app needs.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

revoke all on table public.documents from public, anon, authenticated;
grant select, delete on table public.documents to authenticated;
grant insert (id, user_id, name, document_type, mime_type, file_size, storage_path)
  on public.documents to authenticated;
grant update (name, document_type) on public.documents to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "documents_select_own"
on public.documents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "documents_insert_own"
on public.documents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "documents_update_own"
on public.documents
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "documents_delete_own"
on public.documents
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Create or harden the bucket. Private access and supported MVP file limits are
-- enforced at the bucket level in addition to future client-side validation.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Supabase Storage already enables RLS on storage.objects. Requiring both the
-- first folder and owner_id to match the JWT provides defense in depth.
create policy "documents_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and owner_id = (select auth.uid()::text)
);

create policy "documents_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and cardinality(storage.foldername(name)) = 2
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and owner_id = (select auth.uid()::text)
);

create policy "documents_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and owner_id = (select auth.uid()::text)
);

-- No UPDATE policy is intentional: original objects are immutable and must not
-- be overwritten. A replacement must use a new document ID and object path.

commit;
