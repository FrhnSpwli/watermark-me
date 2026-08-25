# WatermarkMe v0.2 Phase 17 Release Acceptance

Repository checks are evidence about committed code. They do not prove the deployed Supabase project, authenticated browser behavior, or browser memory characteristics. Record the tester, date, deployed commit, browser/version, Supabase project, fixture document IDs, and pass/fail evidence for every manual section below.

Current release status: **Repository Validation Complete - Manual Acceptance Pending**.

Release-documentation blocker: [Issue #9](https://github.com/FrhnSpwli/watermark-me/issues/9) must be resolved before v0.2 is release-complete. Do not reconstruct that specification in Phase 17.

## Read-only live database checks

Run these against the deployed project before and after browser acceptance. They do not mutate data.

Documents with zero source rows; expected: no rows.

```sql
select d.id, d.name
from public.documents d
left join public.document_files df on df.document_id = d.id
group by d.id, d.name
having count(df.id) = 0;
```

Orphan source rows; expected: no rows.

```sql
select df.id, df.document_id, df.original_name
from public.document_files df
left join public.documents d on d.id = df.document_id
where d.id is null;
```

Duplicate or negative ordering; both expected: no rows.

```sql
select document_id, sort_order, count(*) as duplicate_count
from public.document_files
group by document_id, sort_order
having count(*) > 1;

select id, document_id, sort_order
from public.document_files
where sort_order < 0;
```

Invalid legacy/nested Storage path metadata; expected: no rows.

```sql
with source_paths as (
  select
    df.id,
    df.document_id,
    df.storage_path,
    d.user_id,
    string_to_array(df.storage_path, '/') as parts
  from public.document_files df
  join public.documents d on d.id = df.document_id
)
select id, document_id, storage_path
from source_paths
where cardinality(parts) not between 3 and 4
   or parts[1] <> user_id::text
   or parts[2] <> document_id::text
   or (cardinality(parts) = 4 and parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
   or parts[cardinality(parts)] = '';
```

Compatibility mirror mismatch with the first ordered source; expected: no rows.

```sql
select
  d.id,
  d.name,
  d.mime_type as document_mime_type,
  df.mime_type as first_source_mime_type,
  d.file_size as document_file_size,
  df.file_size as first_source_file_size,
  d.storage_path as document_storage_path,
  df.storage_path as first_source_storage_path
from public.documents d
join lateral (
  select mime_type, file_size, storage_path
  from public.document_files
  where document_id = d.id
  order by sort_order, id
  limit 1
) df on true
where d.mime_type is distinct from df.mime_type
   or d.file_size is distinct from df.file_size
   or d.storage_path is distinct from df.storage_path;
```

Private bucket configuration; expected: `public = false`, 10 MiB limit, and only JPEG/PNG/PDF MIME types.

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'documents';
```

Installed policies; inspect that owner-scoped document/source SELECT/INSERT/UPDATE/DELETE policies and Storage SELECT/INSERT/DELETE policies exist. There must be no application Storage UPDATE policy for originals.

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('documents', 'document_files'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
```

## Two-account RLS and Storage matrix

Use normal authenticated clients for Account A and Account B, never a service-role key. Create disposable fixtures owned by each account. Directly exercise the Supabase API where the UI does not expose a cross-owner operation.

| Operation from Account A | Own A | Other B |
| --- | --- | --- |
| documents SELECT | [ ] allowed | [ ] denied/empty |
| document_files SELECT | [ ] allowed | [ ] denied/empty |
| private source download/signed workflow | [ ] allowed | [ ] denied |
| add source | [ ] allowed | [ ] denied |
| remove source | [ ] allowed | [ ] denied |
| reorder/update source | [ ] allowed | [ ] denied |
| reparent A source into B document | n/a | [ ] denied |
| delete document | [ ] allowed | [ ] denied |

Repeat with A/B reversed. Confirm both legacy `USER_ID/DOCUMENT_ID/original.ext` and nested `USER_ID/DOCUMENT_ID/FILE_ID/original.ext` objects are isolated. Confirm no Storage UPDATE succeeds and source removal deletes only the explicitly owned source object.

## Original immutability evidence

For a legacy image, legacy PDF, nested single-source image/PDF, multi-image document, and mixed image/PDF document, capture this query before and after pure Composer/conversion/watermark workflows:

```sql
select
  id,
  document_id,
  original_name,
  mime_type,
  file_size,
  storage_path,
  sort_order
from public.document_files
where document_id = '<DOCUMENT_ID>'
order by sort_order, id;
```

- [ ] Before/after rows are identical for pure Composer, conversion, download, handoff, and watermark flows.
- [ ] Storage object identity/path and metadata are unchanged.
- [ ] DevTools Network shows no generated upload, documents INSERT, document_files INSERT, or generated Storage object.
- [ ] Generated handoff watermarking does not refetch the persisted original.

Source-management add/remove/reorder is the only test group expected to change source metadata. Confirm failed upload/add rollback leaves no orphan object or row, final-source removal is blocked, source names remain original, and the compatibility mirror follows source order. Composer page order must never alter `document_files.sort_order`.

## Browser workflow matrix

- [ ] A. Legacy v0.1 image: Document Detail -> Watermark -> generate -> download.
- [ ] B. Legacy v0.1 PDF: Document Detail -> Watermark -> PDF preview -> generate -> download.
- [ ] C. New single-source image: Composer -> PNG, JPEG, and PDF; inspect each output.
- [ ] D. KTP Front + KTP Back: reorder -> PDF -> one download; verify page order.
- [ ] E. Two images -> PNG[]: each individual action starts only its selected download; Download All starts one ZIP containing only both images.
- [ ] F. JPEG + transparent PNG -> JPEG[]: JPEG pass-through retains its bytes; converted JPEG has a white background and warning is visible.
- [ ] G. PDF pages 5 -> 2 -> 4 -> PDF: inspect exact page order and content.
- [ ] H. PDF pages 5 -> 2 -> 4 -> PNG[]: ZIP contains exactly three ordered PNG files.
- [ ] I. Image A -> PDF page 2 -> Image B -> PDF page 1 -> PDF: inspect exact mixed order; PNG/JPEG targets remain unavailable.
- [ ] J. Multi-image -> PNG[] -> Continue to Watermark: editor receives all artifacts, one shared configuration produces all final files, and one Watermarked ZIP contains all outputs in order.
- [ ] K. Generated PDF -> Continue to Watermark: all pages are preserved and watermarked in the final PDF.
- [ ] L. Convert -> reorder/select/target change: old download and Continue to Watermark actions disappear; only the new configuration can complete.
- [ ] M. Refresh generated Watermark route: controlled temporary-expiry state with Return to Composer; no fallback to Storage.
- [ ] N. Account A handoff -> logout -> Account B login: A's Blob is inaccessible and no stored-original fallback occurs.
- [ ] O. Direct persisted JPEG, PNG, legacy PDF, and nested PDF still watermark without Composer.
- [ ] P. Corrupt JPEG/PNG/PDF, encrypted PDF, MIME mismatch, and unsupported type fail without blank app, stale success, or leaked internal details; recovery/retry remains possible.

For multi-output ZIPs, also confirm filenames are unique and flat, extensions match MIME, and the archive contains no original, metadata JSON, UUID/path, or signed URL.

## Async, resource, and stress acceptance

Use a current supported desktop browser and representative inputs near (not above) the 10 MiB source limit: high-resolution JPEG/PNG, multi-image documents, and multi-page PDFs.

- [ ] Convert -> quickly reorder/change target/deselect cannot commit stale results.
- [ ] Convert -> navigate away does not later commit completion.
- [ ] Cancel -> immediate retry produces only the retry result.
- [ ] Batch watermark controls remain locked during generation; a later setting change invalidates the old result.
- [ ] Repeat Composer -> PDF preview -> reorder -> convert -> cancel/retry -> watermark -> return 5-10 times without broken previews, accumulating active renders, crash, or obvious progressive memory growth.
- [ ] Enter Composer, leave during source loading/conversion, and return successfully.
- [ ] PDF raster -> PNG/JPEG, images -> PDF, and batch watermark complete and remain responsive for representative large inputs.

Record observations rather than claiming a mathematically proven zero memory leak; browser garbage collection timing is nondeterministic.

## Responsive and keyboard acceptance

Test 360-390 px mobile, approximately 768 px tablet, and at least 1280 px desktop.

- [ ] Source browser, preview, selected order, output selector, progress/cancel, filenames, individual/ZIP downloads, Continue to Watermark, batch previous/next, and watermark controls remain reachable.
- [ ] No critical horizontal overflow obscures actions.
- [ ] Keyboard-only: focus items, toggle selection, Move earlier/later, choose output, convert, cancel, download, and Continue to Watermark.
- [ ] Focus remains understandable after reorder and all controls have visible labels/accessibility names.

## Release sign-off

- [ ] All read-only SQL queries match expectations.
- [ ] The two-account matrix passes in both directions.
- [ ] Original immutability and network privacy evidence passes.
- [ ] All browser workflows pass with inspected outputs.
- [ ] Resource/stress and responsive/keyboard checks pass with browser/version recorded.
- [ ] Issue #9 is resolved and the active v0.2 specification is present.
- [ ] No open BLOCKER or HIGH findings remain.

Only after every applicable box passes may Phase 17 and v0.2 be called acceptance-complete.
