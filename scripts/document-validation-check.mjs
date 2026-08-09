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

function expectValidationError(callback, expectedMessage, message) {
  try {
    callback()
  } catch (error) {
    check(
      error instanceof Error && error.message === expectedMessage,
      message,
    )
    return
  }

  throw new Error(`${message}: expected validation to fail.`)
}

try {
  const documents = await server.ssrLoadModule('/src/services/documents.ts')
  const supportedFiles = [
    ['identity.jpg', 'image/jpeg', 'image', 'jpg'],
    ['identity.jpeg', 'image/jpeg', 'image', 'jpeg'],
    ['identity.png', 'image/png', 'image', 'png'],
    ['identity.pdf', 'application/pdf', 'pdf', 'pdf'],
  ]

  for (const [name, type, documentType, extension] of supportedFiles) {
    const result = documents.validateDocumentFile(
      new File(['valid'], name, { type }),
    )
    check(
      result.documentType === documentType && result.extension === extension,
      `${name} is accepted with the expected metadata.`,
    )
  }

  const mismatchMessage =
    'Choose a JPG, JPEG, PNG, or PDF file whose extension matches its file type.'

  expectValidationError(
    () =>
      documents.validateDocumentFile(
        new File(['invalid'], 'identity.png', { type: 'image/jpeg' }),
      ),
    mismatchMessage,
    'A MIME and extension mismatch is rejected.',
  )
  expectValidationError(
    () =>
      documents.validateDocumentFile(
        new File(['invalid'], 'identity.txt', { type: 'text/plain' }),
      ),
    mismatchMessage,
    'An unsupported file type is rejected.',
  )
  expectValidationError(
    () =>
      documents.validateDocumentFile(
        new File([], 'empty.pdf', { type: 'application/pdf' }),
      ),
    'The selected file is empty.',
    'An empty file is rejected.',
  )
  expectValidationError(
    () =>
      documents.validateDocumentFile(
        new File(
          [new Uint8Array(documents.MAX_DOCUMENT_SIZE + 1)],
          'large.pdf',
          { type: 'application/pdf' },
        ),
      ),
    'The selected file is larger than the 10 MB limit.',
    'A file over 10 MB is rejected.',
  )

  const maximumFile = new File(
    [new Uint8Array(documents.MAX_DOCUMENT_SIZE)],
    'maximum.pdf',
    { type: 'application/pdf' },
  )
  check(
    documents.validateDocumentFile(maximumFile).documentType === 'pdf',
    'A file exactly at the 10 MB limit is accepted.',
  )
  check(
    documents.validateDocumentName('  Identity document  ') ===
      'Identity document',
    'Document names are trimmed before metadata updates.',
  )
  expectValidationError(
    () => documents.validateDocumentName('   '),
    'Document name cannot be empty.',
    'An empty rename is rejected.',
  )

  console.log(`Document validation checks: ${checkCount} passed`)
} finally {
  await server.close()
}
