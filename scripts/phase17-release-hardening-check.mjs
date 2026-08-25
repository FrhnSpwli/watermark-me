import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { createServer } from 'vite'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
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

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8')
}

async function listFiles(relativeDirectory) {
  const directory = path.join(repositoryRoot, relativeDirectory)
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const relativePath = path.join(relativeDirectory, entry.name)
    return entry.isDirectory() ? listFiles(relativePath) : [relativePath]
  }))
  return files.flat()
}

function imageItem(sourceFileId, mimeType, composerOrder, sourceName = `${sourceFileId}.png`) {
  return {
    id: `image:${sourceFileId}`,
    kind: 'image-file',
    sourceFileId,
    sourceName,
    mimeType,
    selected: true,
    initialOrder: composerOrder,
    composerOrder,
    width: 100,
    height: 100,
  }
}

function pdfItem(sourceFileId, pageIndex, composerOrder) {
  return {
    id: `pdf:${sourceFileId}:page:${pageIndex}`,
    kind: 'pdf-page',
    sourceFileId,
    sourceName: `${sourceFileId}.pdf`,
    mimeType: 'application/pdf',
    selected: true,
    initialOrder: pageIndex,
    composerOrder,
    pageIndex,
    pageNumber: pageIndex + 1,
    width: 501 + pageIndex,
    height: 700,
    rotationDegrees: 0,
  }
}

function artifact(label, mimeType = 'image/png') {
  return {
    blob: new Blob([label], { type: mimeType }),
    mimeType,
    extension: mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/jpeg' ? 'jpg' : 'png',
    itemIds: [`item:${label}`],
  }
}

function documentRecord(storagePath, mimeType = 'application/pdf') {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Release fixture.pdf',
    document_type: mimeType === 'application/pdf' ? 'pdf' : 'image',
    mime_type: mimeType,
    file_size: 128,
    storage_path: storagePath,
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
  }
}

try {
  const conversion = await server.ssrLoadModule('/src/lib/conversion/conversionEngine.ts')
  const output = await server.ssrLoadModule('/src/lib/conversion/conversionOutput.ts')
  const downloads = await server.ssrLoadModule('/src/lib/conversion/conversionDownload.ts')
  const handoffs = await server.ssrLoadModule('/src/lib/watermark/watermarkHandoff.ts')
  const watermarkOutput = await server.ssrLoadModule('/src/lib/watermark/watermarkOutput.ts')
  const documents = await server.ssrLoadModule('/src/services/documents.ts')

  const images = [
    imageItem('image-c', 'image/png', 0, 'C.png'),
    imageItem('image-a', 'image/png', 1, 'A.png'),
    imageItem('image-b', 'image/png', 2, 'B.png'),
  ]
  const imageOptions = output.getConversionOptions(images)
  check(imageOptions.map((option) => option.target).join(',') === 'application/pdf,image/png,image/jpeg', 'Image batches retain the complete PDF/PNG/JPEG matrix.')
  check(imageOptions.find((option) => option.target === 'image/png').artifactCount === 3, 'Image-to-PNG predicts one artifact per selected image.')
  check(imageOptions.find((option) => option.target === 'image/jpeg').artifactCount === 3, 'Image-to-JPEG predicts one artifact per selected image.')

  const sourceBlobs = new Map(images.map((item) => [
    item.sourceFileId,
    new Blob([item.sourceFileId], { type: item.mimeType }),
  ]))
  const sameFormat = await conversion.convertComposerSelection({
    items: images,
    target: 'image/png',
    sourceResolver: async (sourceFileId) => sourceBlobs.get(sourceFileId),
  })
  check(sameFormat.artifacts.length === 3, 'Same-format image batches never collapse to one artifact.')
  check((await Promise.all(sameFormat.artifacts.map((item) => item.blob.text()))).join(',') === 'image-c,image-a,image-b', 'Image artifact order follows Composer order C-A-B.')
  check(sameFormat.artifacts.every((item, index) => item.blob === sourceBlobs.get(images[index].sourceFileId)), 'Same-format image output preserves the original Blob references.')

  const sourcePdf = await PDFDocument.create()
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    sourcePdf.addPage([501 + pageIndex, 700])
  }
  const sourcePdfBlob = new Blob([new Uint8Array(await sourcePdf.save())], {
    type: 'application/pdf',
  })
  const reorderedPdfItems = [
    pdfItem('source-pdf', 4, 0),
    pdfItem('source-pdf', 1, 1),
    pdfItem('source-pdf', 3, 2),
  ]
  const reorderedPdfResult = await conversion.convertComposerSelection({
    items: reorderedPdfItems,
    target: 'application/pdf',
    sourceResolver: async () => sourcePdfBlob,
  })
  const reorderedPdf = await PDFDocument.load(await reorderedPdfResult.artifacts[0].blob.arrayBuffer())
  check(reorderedPdf.getPageCount() === 3, 'Selected PDF composition contains exactly the selected pages.')
  check(reorderedPdf.getPages().map((page) => page.getWidth()).join(',') === '505,502,504', 'Native PDF composition preserves order 5-2-4.')

  const tinyPng = new Uint8Array(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ))
  const mixedItems = [
    imageItem('image-a', 'image/png', 0, 'A.png'),
    pdfItem('source-pdf', 1, 1),
    imageItem('image-b', 'image/png', 2, 'B.png'),
    pdfItem('source-pdf', 0, 3),
  ]
  check(output.getConversionOptions(mixedItems).map((option) => option.target).join(',') === 'application/pdf', 'Mixed image/PDF-page selections remain PDF-only.')
  const mixedResult = await conversion.convertComposerSelection({
    items: mixedItems,
    target: 'application/pdf',
    sourceResolver: async (sourceFileId) =>
      sourceFileId === 'source-pdf'
        ? sourcePdfBlob
        : new Blob([tinyPng], { type: 'image/png' }),
  })
  const mixedPdf = await PDFDocument.load(await mixedResult.artifacts[0].blob.arrayBuffer())
  const mixedWidths = mixedPdf.getPages().map((page) => Math.round(page.getWidth()))
  check(mixedPdf.getPageCount() === 4, 'Mixed PDF composition retains every selected item.')
  check(mixedWidths.join(',') === '595,502,595,501', 'Mixed output preserves image-A/page-2/image-B/page-1 order without rasterizing PDF pages.')
  let mixedRasterRejected = false
  try {
    conversion.createConversionPlan(mixedItems, 'image/png')
  } catch (error) {
    mixedRasterRejected = error?.code === 'unsupported-conversion'
  }
  check(mixedRasterRejected, 'Unsupported mixed raster output fails through the controlled conversion contract.')

  const unsafeNames = [
    imageItem('front-jpg', 'image/jpeg', 0, '../front.jpg'),
    imageItem('front-png', 'image/png', 1, '..\\front.png'),
  ]
  const namedArtifacts = unsafeNames.map((item) => ({
    blob: new Blob([item.id], { type: 'image/png' }),
    mimeType: 'image/png',
    extension: 'png',
    itemIds: [item.id],
  }))
  const filenames = output.createArtifactFilenames('unsafe', namedArtifacts, unsafeNames)
  check(filenames.join(',') === 'front.png,front_002.png', 'Traversal-like colliding source names become deterministic flat filenames.')
  check(filenames.every((filename) => !filename.includes('/') && !filename.includes('\\') && !filename.includes('..')), 'Generated filenames cannot create nested or traversal paths.')
  const zipBlob = await downloads.createArtifactsZip(namedArtifacts, filenames)
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
  check(Object.keys(zip.files).join(',') === filenames.join(','), 'ZIP contains only the expected flat artifact entries.')
  check(Object.keys(zip.files).length === 2, 'ZIP contains neither omitted artifacts nor extra metadata files.')

  const originalKey = output.createConversionInputKey('document-a', reorderedPdfItems, 'application/pdf')
  const rekeyed = reorderedPdfItems.map((item, index) => ({ ...item, composerOrder: 2 - index }))
  check(!output.isConversionInputCurrent(originalKey, output.createConversionInputKey('document-a', rekeyed, 'application/pdf')), 'Reordering immediately makes a conversion result stale.')
  check(!output.isConversionInputCurrent(originalKey, output.createConversionInputKey('document-a', reorderedPdfItems, 'image/png')), 'Changing target immediately makes a conversion result stale.')
  check(!output.isConversionInputCurrent(originalKey, output.createConversionInputKey('document-b', reorderedPdfItems, 'application/pdf')), 'Changing document context makes a conversion result stale.')

  const store = handoffs.createWatermarkHandoffStore(() => 'handoff-phase17', () => 17)
  store.setOwner('owner-a')
  const batchArtifacts = [artifact('KTP'), artifact('KIS')]
  const handoffId = store.create('owner-a', {
    documentId: 'document-a',
    documentName: 'Identity',
    result: { artifacts: batchArtifacts },
    filenames: ['KTP.png', 'KIS.png'],
  })
  const batch = store.resolve('owner-a', handoffId, 'document-a')
  check(batch.status === 'ready' && batch.kind === 'generated-image-batch', 'Both generated images resolve as an explicit watermark batch.')
  check(batch.handoff.artifacts.length === 2, 'Handoff resolution never silently selects artifacts[0].')
  const renderedLabels = []
  const watermarked = await watermarkOutput.watermarkGeneratedImageArtifacts({
    artifacts: batch.handoff.artifacts,
    filenames: ['KTP_watermarked.png', 'KIS_watermarked.png'],
    settings: { text: 'PRIVATE', opacity: 0.25, rotationDegrees: -20, fontSizeRatio: 0.06, position: 'center', textStyle: 'custom' },
    signal: new AbortController().signal,
    render: async (blob) => {
      renderedLabels.push(await blob.text())
      return new Blob(['watermarked'], { type: 'image/png' })
    },
  })
  check(renderedLabels.join(',') === 'KTP,KIS', 'Batch watermarking processes every artifact in original order.')
  check(watermarked.artifacts.length === 2, 'Batch watermarking produces one final artifact per input.')
  check(store.resolve('owner-b', handoffId, 'document-a').status === 'missing', 'Another authenticated owner cannot resolve the handoff.')
  store.setOwner('owner-b')
  check(store.resolve('owner-a', handoffId, 'document-a').status === 'missing', 'Account change clears the previous in-memory handoff.')
  check(Object.keys(handoffs.createWatermarkNavigationState('opaque')).join(',') === 'watermarkHandoffId', 'Navigation state contains only an opaque handoff ID.')

  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const documentId = '11111111-1111-4111-8111-111111111111'
  const legacy = documents.normalizeDocumentRecord(documentRecord(`${owner}/${documentId}/original.pdf`))
  check(documents.resolveDocumentWatermarkSource(legacy).kind === 'pdf', 'Legacy single-source PDF compatibility remains watermarkable.')
  check(legacy.files[0].storage_path === `${owner}/${documentId}/original.pdf`, 'Legacy normalization never rewrites the Storage path.')
  const nestedSource = {
    id: '22222222-2222-4222-8222-222222222222',
    document_id: documentId,
    original_name: 'nested.pdf',
    mime_type: 'application/pdf',
    file_size: 128,
    storage_path: `${owner}/${documentId}/22222222-2222-4222-8222-222222222222/original.pdf`,
    sort_order: 0,
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
  }
  const nested = documents.normalizeDocumentRecord({
    ...documentRecord(nestedSource.storage_path),
    document_files: [nestedSource],
  })
  check(documents.resolveDocumentWatermarkSource(nested).kind === 'pdf', 'Nested single-source PDF remains watermarkable through document_files authority.')
  check(documents.resolveDocumentWatermarkSource({ files: [nestedSource, { ...nestedSource, id: '33333333-3333-4333-8333-333333333333', storage_path: `${owner}/${documentId}/33333333-3333-4333-8333-333333333333/original.pdf`, sort_order: 1 }] }).status === 'multiple', 'Persisted multi-source documents remain guarded from single-source watermarking.')

  const sourceFiles = await listFiles('src')
  const sourceText = (await Promise.all(sourceFiles.map(read))).join('\n')
  check(!/service_role|SUPABASE_SERVICE_ROLE/i.test(sourceText), 'Frontend source contains no service-role credential reference.')
  check(!/postgres(?:ql)?:\/\//i.test(sourceText), 'Frontend source contains no database connection string.')
  const generatedDomainFiles = sourceFiles.filter((file) =>
    /(?:conversion|watermarkHandoff|WatermarkEditorPage|DocumentComposerPage)/.test(file),
  )
  const generatedDomainText = (await Promise.all(generatedDomainFiles.map(read))).join('\n')
  check(!/localStorage|sessionStorage|indexedDB|caches\.open/i.test(generatedDomainText), 'Generated-file domains use no persistent browser storage API.')
  check(!/\.upload\s*\(|\.insert\s*\(/.test(generatedDomainText), 'Generated-file domains contain no database or Storage write call.')

  const composerPage = await read('src/pages/DocumentComposerPage.tsx')
  const watermarkInput = await read('src/hooks/useWatermarkEditorInput.ts')
  const imageConversion = await read('src/lib/conversion/imageConversion.ts')
  const pdfRasterization = await read('src/lib/conversion/pdfRasterization.ts')
  const pdfPreview = await read('src/lib/pdfPreview/pdfPreview.ts')
  const downloadSource = await read('src/lib/conversion/conversionDownload.ts')
  const appSource = await read('src/App.tsx')
  check(composerPage.includes('URL.revokeObjectURL') && composerPage.includes('.destroy()'), 'Composer owns cleanup for image URLs and PDF documents.')
  check(composerPage.includes('controller.abort()'), 'Composer aborts active private-source reads on cleanup.')
  check(watermarkInput.includes('controller.abort()') && watermarkInput.includes('.dispose()'), 'Watermark input cleanup cancels work and disposes decoded images.')
  check(imageConversion.includes('URL.revokeObjectURL') && imageConversion.includes('bitmap.close()') && imageConversion.includes('canvas.width = 0'), 'Image conversion releases object URLs, ImageBitmaps, and Canvas backing stores.')
  check(pdfRasterization.includes('pdfDocument.destroy()') && pdfRasterization.includes('canvas.width = 0'), 'PDF rasterization destroys documents and clears Canvas backing stores.')
  check(pdfPreview.includes('renderTask?.cancel()') && pdfPreview.includes('page?.cleanup()'), 'PDF preview cancellation releases render and page resources.')
  check(downloadSource.includes('URL.revokeObjectURL') && downloadSource.includes("import('jszip')"), 'Download URLs are revoked and JSZip remains lazy-loaded.')
  check(appSource.includes("lazy(async () =>") && appSource.includes("import('./pages/DocumentComposerPage')") && appSource.includes("import('./pages/WatermarkEditorPage')"), 'Composer and Watermark routes remain lazy-loaded.')
  check((await read('src/lib/conversion/conversionEngine.ts')).includes("import('./pdfComposition')") && (await read('src/lib/conversion/conversionEngine.ts')).includes("import('./pdfRasterization')"), 'Heavy conversion adapters remain behind dynamic imports.')

  const phase3 = await read('supabase/migrations/20260809000100_phase_3_secure_data_layer.sql')
  const phase11 = await read('supabase/migrations/20260818000100_phase_11_document_files.sql')
  const phase12 = await read('supabase/migrations/20260819000100_phase_12_multi_file_management.sql')
  const repair = await read('supabase/migrations/20260819000200_phase_12_repair_missing_document_files.sql')
  const migrationText = `${phase3}\n${phase11}\n${phase12}\n${repair}`
  check(phase3.includes("'documents',\n  'documents',\n  false") && phase3.includes('documents_storage_select_own'), 'Storage bucket is private and owner-select policy is present.')
  check(!/on storage\.objects\s+for update/i.test(migrationText), 'No Storage UPDATE policy permits original overwrite.')
  check(phase11.includes('alter table public.document_files enable row level security'), 'document_files RLS is enabled.')
  check(['select', 'insert', 'update', 'delete'].every((operation) => phase11.includes(`document_files_${operation}_own`)), 'document_files has owner-scoped CRUD policies.')
  check(phase11.includes('references public.documents (id) on delete cascade'), 'document_files cannot become orphaned from a deleted parent.')
  check(phase11.includes('unique index if not exists document_files_document_sort_order_idx') && phase11.includes('sort_order >= 0'), 'Source sort order is unique per document and non-negative.')
  check(phase12.includes('document_files_validate_storage_path') && phase12.includes('cardinality(path_parts) not between 3 and 4'), 'Storage-path trigger accepts only validated legacy/nested layouts.')
  check(phase12.includes("path_parts[1] <> parent_user_id::text") && phase12.includes("path_parts[2] <> new.document_id::text"), 'Source paths must match parent owner and document IDs.')
  check(repair.includes('where not exists') && !/storage\.objects|\.upload/i.test(repair), 'Repair migration is idempotent by source absence and never mutates Storage objects.')

  console.log(`Phase 17 release hardening checks: ${checkCount} passed`)
} finally {
  await server.close()
}
