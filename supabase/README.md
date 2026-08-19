# Supabase database setup

Phase 3 is defined by the migration in `migrations/`. It creates the profiles
and documents metadata tables, ownership RLS policies, the private documents
bucket, and Storage policies. It does not upload or process any documents.

## Apply with the Supabase SQL Editor

1. Open the matching Supabase project.
2. Go to **SQL Editor** and create a new query.
3. Copy the complete migration file into the editor.
4. Run it once. The migration is transactional, so an error rolls back its
   database changes instead of leaving a partially configured data layer.
5. Confirm that `public.profiles` contains one row for each existing Auth user,
   `public.documents` exists with RLS enabled, and the `documents` Storage bucket
   is private.

The expected object name passed to Supabase Storage is:

```text
USER_ID/DOCUMENT_ID/original.ext
```

Do not include the bucket name in the object name. The bucket is selected
separately by the Storage client.

The current checkout has no linked Supabase CLI configuration. If CLI workflow
is added later, this conventional migration directory can be applied with
`supabase db push` after logging in and linking the correct project.

For Phase 11, a new migration adds `public.document_files` and backfills each
legacy `public.documents` row to exactly one source record. The legacy
`USER_ID/DOCUMENT_ID/original.ext` Storage paths remain valid and are preserved.
The `document_files` table enforces owner access through the parent document's
`user_id`, while the Storage policy still checks the owner folder and `owner_id`
for both the legacy path shape and the future nested `USER_ID/DOCUMENT_ID/FILE_ID/original.ext` convention.

Phase 12 adds the migration
`migrations/20260819000100_phase_12_multi_file_management.sql`. Apply it after
Phase 11. It permits the compatibility mirror on `documents` to reference a
nested source path, validates that each source path belongs to its parent
document, and grants only authenticated owners the compatibility metadata update
needed when source order changes.

The application creates new source objects at
`USER_ID/DOCUMENT_ID/FILE_ID/original.ext`. It supports separate multi-file
uploads, combined logical-document uploads, source addition, source removal, and
source move-up/move-down management. Generated or converted files are not part
of this phase.
