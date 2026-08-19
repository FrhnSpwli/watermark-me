begin;

alter table public.documents
drop constraint if exists documents_storage_path_layout;

alter table public.documents
add constraint documents_storage_path_layout check (
  storage_path ~ '^[^/]+/[^/]+(?:/[^/]+)?/[^/]+$'
  and split_part(storage_path, '/', 1) = user_id::text
  and split_part(storage_path, '/', 2) = id::text
);

create or replace function public.validate_document_file_storage_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_user_id uuid;
  path_parts text[];
begin
  select d.user_id
  into parent_user_id
  from public.documents as d
  where d.id = new.document_id;

  if parent_user_id is null then
    raise exception 'document_files parent document does not exist';
  end if;

  path_parts := string_to_array(new.storage_path, '/');

  if cardinality(path_parts) not between 3 and 4
    or path_parts[1] <> parent_user_id::text
    or path_parts[2] <> new.document_id::text
    or (cardinality(path_parts) = 4 and path_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    or path_parts[array_length(path_parts, 1)] = ''
  then
    raise exception 'document_files storage_path does not belong to its parent document';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_document_file_storage_path() from public, anon, authenticated;

drop trigger if exists document_files_validate_storage_path on public.document_files;
create trigger document_files_validate_storage_path
before insert or update of document_id, storage_path on public.document_files
for each row execute function public.validate_document_file_storage_path();

grant update (name, document_type, mime_type, file_size, storage_path)
on public.documents to authenticated;

commit;
