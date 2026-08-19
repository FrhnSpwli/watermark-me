import { readFile } from 'node:fs/promises'

const migrationUrl = new URL(
  '../supabase/migrations/20260819000200_phase_12_repair_missing_document_files.sql',
  import.meta.url,
)
const migration = await readFile(migrationUrl, 'utf8')
const normalizedMigration = migration.replace(/\s+/g, ' ').toLowerCase()

let checkCount = 0

function check(condition, message) {
  if (!condition) {
    throw new Error(message)
  }

  checkCount += 1
}

check(
  normalizedMigration.includes('insert into public.document_files'),
  'The repair inserts source metadata into document_files.',
)
check(
  normalizedMigration.includes('from public.documents as d where not exists'),
  'The repair starts from documents that have no source metadata.',
)
check(
  normalizedMigration.includes('where df.document_id = d.id'),
  'The missing-source check is scoped to each parent document.',
)
check(
  normalizedMigration.includes("coalesce(nullif(btrim(d.name), ''), d.id::text)"),
  'The repair preserves the Phase 11 original_name compatibility rule.',
)
check(
  /d\.mime_type,\s+d\.file_size,\s+d\.storage_path,\s+0,\s+d\.created_at,\s+now\(\)/i.test(migration),
  'The repair reuses legacy metadata and assigns source order zero.',
)
check(
  !/\bstorage\.(?:objects|buckets)\b/i.test(migration),
  'The repair does not mutate Supabase Storage objects or bucket configuration.',
)
check(
  !/\bcreate\s+(?:or\s+replace\s+)?trigger\b/i.test(migration),
  'The repair does not add automatic document source triggers.',
)
check(
  !/\b(?:disable|no\s+force)\s+row\s+level\s+security\b/i.test(migration),
  'The repair does not weaken row-level security.',
)

console.log(`Phase 12 missing-source repair checks: ${checkCount} passed`)
