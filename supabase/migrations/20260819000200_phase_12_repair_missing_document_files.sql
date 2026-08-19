begin;

-- Phase 11 backfilled the legacy documents that existed when its migration ran.
-- Repair documents created in the migration window by reusing their immutable
-- legacy Storage object and compatibility metadata as the single source row.
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
);

commit;
