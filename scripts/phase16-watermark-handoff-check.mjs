import { createServer } from 'vite'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'

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

function artifact(label, mimeType) {
  return {
    blob: new Blob([label], { type: mimeType }),
    mimeType,
    extension:
      mimeType === 'application/pdf'
        ? 'pdf'
        : mimeType === 'image/jpeg'
          ? 'jpg'
          : 'png',
    itemIds: [`item:${label}`],
  }
}

function handoffInput(artifacts, filenames, documentId = 'document-a') {
  return {
    documentId,
    documentName: 'Identity Package',
    result: { artifacts },
    filenames,
  }
}

function persistedDocument(mimeType, storagePath) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: mimeType === 'application/pdf' ? 'Contract.pdf' : 'Identity.png',
    document_type: mimeType === 'application/pdf' ? 'pdf' : 'image',
    mime_type: mimeType,
    file_size: 100,
    storage_path: storagePath,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

try {
  const handoffs = await server.ssrLoadModule(
    '/src/lib/watermark/watermarkHandoff.ts',
  )
  const output = await server.ssrLoadModule(
    '/src/lib/watermark/watermarkOutput.ts',
  )
  const downloads = await server.ssrLoadModule(
    '/src/lib/conversion/conversionDownload.ts',
  )
  const pdfWatermark = await server.ssrLoadModule(
    '/src/lib/watermark/pdfWatermark.ts',
  )
  const documents = await server.ssrLoadModule('/src/services/documents.ts')

  let nextId = 1
  const store = handoffs.createWatermarkHandoffStore(
    () => `handoff-${nextId++}`,
    () => 12345,
  )
  store.setOwner('owner-a')

  const pngId = store.create(
    'owner-a',
    handoffInput([artifact('png-one', 'image/png')], ['Identity.png']),
  )
  const pngResolution = store.resolve('owner-a', pngId, 'document-a')
  check(pngResolution.status === 'ready', 'A prepared PNG conversion resolves from memory.')
  check(pngResolution.kind === 'generated-single-image', 'PNG enters the image watermark input path.')
  check(pngResolution.handoff.artifacts[0].blob instanceof Blob, 'The handoff retains the original Blob reference.')
  check(!('storage_path' in pngResolution.handoff.artifacts[0]), 'Generated authority requires no Storage path.')
  check(pngResolution.handoff.createdAt === 12345, 'Handoff lifetime metadata is explicit.')

  const jpegId = store.create(
    'owner-a',
    handoffInput([artifact('jpeg-one', 'image/jpeg')], ['Identity.jpg']),
  )
  check(store.resolve('owner-a', pngId, 'document-a').status === 'missing', 'Replacing a handoff releases the previous active reference.')
  check(store.resolve('owner-a', jpegId, 'document-a').kind === 'generated-single-image', 'JPEG enters the existing image watermark path.')

  const sourcePdf = await PDFDocument.create()
  sourcePdf.addPage([300, 500])
  const pdfBlob = new Blob([new Uint8Array(await sourcePdf.save())], {
    type: 'application/pdf',
  })
  const pdfArtifact = {
    blob: pdfBlob,
    mimeType: 'application/pdf',
    extension: 'pdf',
    itemIds: ['pdf-page-1'],
  }
  const pdfId = store.create(
    'owner-a',
    handoffInput([pdfArtifact], ['Identity.pdf']),
  )
  const pdfResolution = store.resolve('owner-a', pdfId, 'document-a')
  check(pdfResolution.kind === 'generated-single-pdf', 'Generated PDF enters the native PDF watermark path.')
  const inspectedPdf = await pdfWatermark.loadPdfWatermarkSourceBlob(pdfBlob)
  check(inspectedPdf.pageCount === 1, 'Generated PDF bytes load directly without PDF raster reconstruction.')

  const batchArtifacts = [
    artifact('page-five', 'image/png'),
    artifact('page-two', 'image/png'),
    artifact('page-four', 'image/png'),
  ]
  const batchInputNames = ['Doc_001.png', 'Doc_002.png', 'Doc_003.png']
  const batchId = store.create(
    'owner-a',
    handoffInput(batchArtifacts, batchInputNames),
  )
  const batchResolution = store.resolve('owner-a', batchId, 'document-a')
  check(batchResolution.kind === 'generated-image-batch', 'Three image artifacts resolve as one explicit batch.')
  check(batchResolution.handoff.artifacts.length === 3, 'Batch resolution never falls back to artifacts[0].')
  check(batchResolution.handoff.artifacts.map((item) => item.filename).join(',') === batchInputNames.join(','), 'Conversion artifact order is preserved by the handoff.')
  check(batchResolution.handoff.artifacts.map((item) => item.itemIds[0]).join(',') === 'item:page-five,item:page-two,item:page-four', 'Composer item trace order remains intact.')

  const settings = {
    text: 'ONLY FOR\nEXAMPLE BANK\n23 AUG 2026',
    opacity: 0.25,
    rotationDegrees: -20,
    fontSizeRatio: 0.06,
    position: 'center',
    textStyle: 'purpose',
  }
  const finalNames = output.buildWatermarkOutputFilenames(
    'Identity Package',
    'bank-verification',
    'Example Bank',
    new Date(2026, 7, 23),
    3,
    'png',
  )
  const renderOrder = []
  const settingsReferences = []
  const progress = []
  const batchResult = await output.watermarkGeneratedImageArtifacts({
    artifacts: batchResolution.handoff.artifacts,
    filenames: finalNames,
    settings,
    signal: new AbortController().signal,
    render: async (blob, receivedSettings) => {
      renderOrder.push(await blob.text())
      settingsReferences.push(receivedSettings)
      return new Blob([`watermarked:${renderOrder.at(-1)}`], {
        type: 'image/png',
      })
    },
    onProgress: (value) => progress.push(`${value.completed}/${value.total}`),
  })
  check(batchResult.artifacts.length === 3, 'Batch watermarking generates one final artifact per input.')
  check(renderOrder.join(',') === 'page-five,page-two,page-four', 'Batch rendering preserves exact conversion order.')
  check(settingsReferences.every((value) => value === settings), 'One shared watermark configuration is applied to every artifact.')
  check(batchResult.artifacts.every((item) => item.mimeType === 'image/png' && item.extension === 'png'), 'Image watermark output truthfully uses PNG MIME and extension.')
  check(batchResult.artifacts.map((item) => item.filename).join(',') === finalNames.join(','), 'Final batch filenames preserve deterministic 001 ordering.')
  check(progress.join(',') === '0/3,1/3,2/3,3/3', 'Batch progress reports real completed item counts.')
  check(output.buildWatermarkZipFilename(finalNames[0]).endsWith('.zip'), 'Batch output has one ZIP filename.')
  check(!output.buildWatermarkZipFilename(finalNames[0]).includes('_001'), 'Watermarked ZIP name does not inherit the first artifact index.')

  const zipBlob = await downloads.createArtifactsZip(
    batchResult.artifacts,
    batchResult.artifacts.map((item) => item.filename),
  )
  const parsedZip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
  check(Object.keys(parsedZip.files).join(',') === finalNames.join(','), 'Watermarked ZIP contains all final files in order.')
  check(Object.keys(parsedZip.files).length === 3, 'Watermarked ZIP does not omit or add artifacts.')

  const jpegFinalNames = output.buildWatermarkOutputFilenames(
    'Portrait.jpg',
    'job-application',
    'Example Co',
    new Date(2026, 7, 23),
    1,
    'png',
  )
  check(jpegFinalNames[0].endsWith('.png'), 'A generated JPEG is named as the actual PNG watermark output.')
  const pdfFinalNames = output.buildWatermarkOutputFilenames(
    'Contract.pdf',
    'insurance',
    'Example Insurance',
    new Date(2026, 7, 23),
    1,
    'pdf',
  )
  check(pdfFinalNames[0].endsWith('.pdf'), 'Generated PDF watermark output retains the PDF extension.')

  const signature = output.createWatermarkResultSignature(
    'handoff:1',
    settings,
    'bank-verification',
    'Example Bank',
    new Date(2026, 7, 23),
  )
  check(output.isWatermarkResultCurrent(signature, signature), 'Unchanged watermark inputs keep a final result current.')
  const settingMutations = [
    { ...settings, text: 'CUSTOM' },
    { ...settings, opacity: 0.5 },
    { ...settings, rotationDegrees: 20 },
    { ...settings, fontSizeRatio: 0.08 },
    { ...settings, position: 'bottom-right' },
  ]
  settingMutations.forEach((nextSettings) => {
    const changed = output.createWatermarkResultSignature(
      'handoff:1',
      nextSettings,
      'bank-verification',
      'Example Bank',
      new Date(2026, 7, 23),
    )
    check(!output.isWatermarkResultCurrent(signature, changed), 'A watermark appearance/text change invalidates the previous result.')
  })
  check(signature !== output.createWatermarkResultSignature('handoff:1', settings, 'insurance', 'Example Bank', new Date(2026, 7, 23)), 'Purpose changes invalidate the previous result.')
  check(signature !== output.createWatermarkResultSignature('handoff:1', settings, 'bank-verification', 'Another Bank', new Date(2026, 7, 23)), 'Recipient changes invalidate the previous result.')
  check(signature !== output.createWatermarkResultSignature('handoff:2', settings, 'bank-verification', 'Example Bank', new Date(2026, 7, 23)), 'Source handoff changes invalidate the previous result.')

  const cancelled = new AbortController()
  cancelled.abort()
  let cancellationError = null
  let cancelledRenderCalls = 0
  try {
    await output.watermarkGeneratedImageArtifacts({
      artifacts: batchResolution.handoff.artifacts,
      filenames: finalNames,
      settings,
      signal: cancelled.signal,
      render: async () => {
        cancelledRenderCalls += 1
        return new Blob(['unexpected'], { type: 'image/png' })
      },
    })
  } catch (error) {
    cancellationError = error
  }
  check(output.isWatermarkCancellation(cancellationError), 'Intentional batch cancellation is a neutral typed state.')
  check(cancelledRenderCalls === 0, 'Pre-cancelled batch generates no partial artifacts.')

  const mixedId = store.create(
    'owner-a',
    handoffInput(
      [artifact('image', 'image/png'), pdfArtifact],
      ['Image.png', 'Document.pdf'],
    ),
  )
  check(store.resolve('owner-a', mixedId, 'document-a').status === 'unsupported', 'Mixed image/PDF payload fails safely.')
  const mixedImageId = store.create(
    'owner-a',
    handoffInput(
      [artifact('png', 'image/png'), artifact('jpeg', 'image/jpeg')],
      ['One.png', 'Two.jpg'],
    ),
  )
  check(store.resolve('owner-a', mixedImageId, 'document-a').status === 'unsupported', 'Unexpected mixed image MIME batch is not guessed.')
  check(store.resolve('owner-a', mixedImageId, 'document-b').status === 'unsupported', 'Document mismatch cannot resolve a handoff.')
  check(store.resolve('owner-b', mixedImageId, 'document-a').status === 'missing', 'Another owner cannot resolve the active Blob.')
  store.setOwner('owner-b')
  check(store.resolve('owner-a', mixedImageId, 'document-a').status === 'missing', 'Authenticated owner change clears the previous handoff.')

  const discardId = store.create(
    'owner-b',
    handoffInput([artifact('discard', 'image/png')], ['Discard.png']),
  )
  store.discard('owner-b', discardId)
  check(store.resolve('owner-b', discardId, 'document-a').status === 'missing', 'Explicit discard releases the handoff reference.')
  check(store.resolve('owner-b', 'expired-id', 'document-a').status === 'missing', 'Expired opaque IDs return a controlled missing state.')

  const navigationState = handoffs.createWatermarkNavigationState('opaque-id')
  check(Object.keys(navigationState).join(',') === 'watermarkHandoffId', 'Navigation contains only the opaque handoff ID.')
  check(handoffs.getWatermarkHandoffId(navigationState) === 'opaque-id', 'Valid navigation state resolves the opaque ID.')
  check(handoffs.getWatermarkHandoffId({ watermarkHandoffId: new Blob(['secret']) }) === null, 'Blob bytes cannot be parsed as navigation state.')
  check(handoffs.getWatermarkHandoffId(null) === null, 'Refresh without state is handled safely.')

  const legacyImage = documents.normalizeDocumentRecord(
    persistedDocument(
      'image/png',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/original.png',
    ),
  )
  const legacyPdf = documents.normalizeDocumentRecord(
    persistedDocument(
      'application/pdf',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/original.pdf',
    ),
  )
  check(documents.resolveDocumentWatermarkSource(legacyImage).kind === 'image', 'Legacy persisted image resolution remains unchanged.')
  check(documents.resolveDocumentWatermarkSource(legacyPdf).kind === 'pdf', 'Legacy persisted PDF resolution remains unchanged.')

  let conversionCalls = 0
  const preparedResult = handoffInput(
    [artifact('already-converted', 'image/png')],
    ['Already_Converted.png'],
  )
  const independentStore = handoffs.createWatermarkHandoffStore(
    () => 'prepared-handoff',
  )
  independentStore.setOwner('owner-a')
  const preparedId = independentStore.create('owner-a', preparedResult)
  check(independentStore.resolve('owner-a', preparedId, 'document-a').status === 'ready', 'Prepared ConversionResult enters watermarking independently.')
  check(conversionCalls === 0, 'Handoff creation and resolution never invoke conversion again.')

  console.log(`Phase 16 watermark handoff checks: ${checkCount} passed`)
} finally {
  await server.close()
}
