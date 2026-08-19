import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
})

let checkCount = 0

function check(condition, message) {
  if (!condition) {
    throw new Error(message)
  }

  checkCount += 1
}

try {
  const documents = await server.ssrLoadModule('/src/services/documents.ts')
  const sourceFile = documents.createLegacyDocumentSourceFile({
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Legacy document',
    document_type: 'image',
    mime_type: 'image/png',
    file_size: 245760,
    storage_path: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/original.png',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  })

  check(sourceFile.document_id === sourceFile.id, 'Legacy documents map to a single source file row.')
  check(sourceFile.sort_order === 0, 'Legacy source ordering starts at zero.')
  check(sourceFile.original_name === 'Legacy document', 'Legacy original_name preserves the user-facing document name.')
  check(sourceFile.storage_path.endsWith('/original.png'), 'Legacy storage paths remain unchanged.')

  const combined = documents.normalizeDocumentRecord({
    id: '22222222-2222-4222-8222-222222222222',
    user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Updated',
    document_type: 'pdf',
    mime_type: 'application/pdf',
    file_size: 128000,
    storage_path: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/22222222-2222-4222-8222-222222222222/original.pdf',
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    files: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        document_id: '22222222-2222-4222-8222-222222222222',
        original_name: 'Existing source',
        mime_type: 'application/pdf',
        file_size: 128000,
        storage_path: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/22222222-2222-4222-8222-222222222222/original.pdf',
        sort_order: 1,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
    ],
  })

  check(combined.files.length === 1, 'Explicit source-file rows are preserved when present.')
  check(combined.files[0].sort_order === 1, 'Existing source order is retained.')

  console.log(`Phase 11 compatibility checks: ${checkCount} passed`)
} finally {
  await server.close()
}
