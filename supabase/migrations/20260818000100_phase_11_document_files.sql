begin;

create table if not exists public.document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  original_name text not null,
  mime_type text not null,
  file_size bigint not null,
  storage_path text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_files_original_name_length check (
    char_length(btrim(original_name)) between 1 and 255
  ),
  constraint document_files_supported_mime_type check (
    mime_type in ('image/jpeg', 'image/png', 'application/pdf')
  ),
  constraint document_files_file_size_range check (
    file_size between 1 and 10485760
  ),
  constraint document_files_sort_order_non_negative check (
    sort_order >= 0
  ),
  constraint document_files_storage_path_layout check (
    storage_path ~ '^[^/]+/[^/]+(?:/[^/]+)?/[^/]+$'
  )
);

create unique index if not exists document_files_document_sort_order_idx
on public.document_files (document_id, sort_order);

create index if not exists document_files_document_id_idx
on public.document_files (document_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists document_files_set_updated_at on public.document_files;
create trigger document_files_set_updated_at
before update on public.document_files
for each row execute function public.set_updated_at();

alter table public.document_files enable row level security;

revoke all on table public.document_files from public, anon, authenticated;
grant select, insert, update, delete on table public.document_files to authenticated;

create policy "document_files_select_own"
on public.document_files
for select
to authenticated
using (
  exists (
    select 1
    from public.documents as d
    where d.id = document_files.document_id
      and d.user_id = auth.uid()
  )
);

create policy "document_files_insert_own"
on public.document_files
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents as d
    where d.id = document_files.document_id
      and d.user_id = auth.uid()
  )
);

create policy "document_files_update_own"
on public.document_files
for update
to authenticated
using (
  exists (
    select 1
    from public.documents as d
    where d.id = document_files.document_id
      and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.documents as d
    where d.id = document_files.document_id
      and d.user_id = auth.uid()
  )
);

create policy "document_files_delete_own"
on public.document_files
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents as d
    where d.id = document_files.document_id
      and d.user_id = auth.uid()
  )
);

insert into public.document_files (
  document_id,
  original_name,
  mime_type,
  file_size,
  storage_path,
  sort_order,
  created_at,
  updated_at
)
select
  d.id,
  coalesce(nullif(btrim(d.name), ''), d.id::text),
  d.mime_type,
  d.file_size,
  d.storage_path,
  0,
  d.created_at,
  now()
from public.documents as d
where not exists (
  select 1
  from public.document_files as df
  where df.document_id = d.id
)
on conflict (storage_path) do nothing;

drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (
    (
      cardinality(storage.foldername(name)) = 2
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    or (
      cardinality(storage.foldername(name)) = 3
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  )
);

commit;
