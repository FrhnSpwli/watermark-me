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
