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

function source(id, sortOrder) {
  return {
    id,
    document_id: '11111111-1111-4111-8111-111111111111',
    original_name: `${id}.jpg`,
    mime_type: 'image/jpeg',
    file_size: 100,
    storage_path: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/${id}/original.jpg`,
    sort_order: sortOrder,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

try {
  const documents = await server.ssrLoadModule('/src/services/documents.ts')
  const sources = [source('22222222-2222-4222-8222-222222222222', 0), source('33333333-3333-4333-8333-333333333333', 1)]

  check(
    documents.createDocumentSourceStoragePath(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'png',
    ).endsWith('/22222222-2222-4222-8222-222222222222/original.png'),
    'New source paths include a stable file ID before the original filename.',
  )
  check(documents.getNextSourceOrder(sources) === 2, 'New sources append after the current highest order.')
  check(
    documents.moveDocumentSource(sources, sources[1].id, 'up').map((item) => item.id).join(',') ===
      `${sources[1].id},${sources[0].id}`,
    'Source movement preserves the requested order.',
  )
  check(
    documents.moveDocumentSource(sources, sources[0].id, 'up')[0].id === sources[0].id,
    'Moving the first source up is a stable no-op.',
  )
  check(
    documents.removeDocumentSourceFromList([...sources, source('44444444-4444-4444-8444-444444444444', 2)], sources[1].id)
      .map((item) => item.sort_order).join(',') === '0,1',
    'Removing a source normalizes remaining order.',
  )

  try {
    documents.removeDocumentSourceFromList(sources.slice(0, 1), sources[0].id)
    throw new Error('Final-source removal should fail.')
  } catch (error) {
    check(
      error instanceof Error && /at least one source/i.test(error.message),
      'Final-source removal is rejected in the domain layer.',
    )
  }

  const separate = await documents.uploadDocuments
  check(typeof separate === 'function', 'The service exposes the explicit upload workflow.')

  console.log(`Phase 12 multi-file checks: ${checkCount} passed`)
} finally {
  await server.close()
}
