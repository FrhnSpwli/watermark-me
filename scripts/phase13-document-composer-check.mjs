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

function source(id, sortOrder, mimeType, originalName = id) {
  const extension = mimeType === 'application/pdf' ? 'pdf' : 'png'
  return {
    id,
    document_id: '11111111-1111-4111-8111-111111111111',
    original_name: `${originalName}.${extension}`,
    mime_type: mimeType,
    file_size: 100 + sortOrder,
    storage_path: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/${id}/original.${extension}`,
    sort_order: sortOrder,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function image(sourceFile) {
  return { kind: 'image', source: sourceFile, width: 1200, height: 800 }
}

function pdf(sourceFile, pageCount) {
  return {
    kind: 'pdf',
    source: sourceFile,
    pages: Array.from({ length: pageCount }, (_, pageIndex) => ({
      pageIndex,
      pageNumber: pageIndex + 1,
      width: 612,
      height: 792,
      rotationDegrees: 0,
    })),
  }
}

try {
  const composer = await server.ssrLoadModule('/src/lib/composer/composerState.ts')

  const imageA = source('image-a', 0, 'image/png', 'Front')
  const imageB = source('image-b', 1, 'image/png', 'Back')
  const twoImages = composer.createComposerItems([image(imageB), image(imageA)])
  check(twoImages.length === 2, 'Two image sources create two Composer items.')
  check(
    twoImages.map((item) => item.sourceFileId).join(',') === 'image-a,image-b',
    'Image items use persisted source order regardless of input completion order.',
  )
  check(twoImages.every((item) => item.selected), 'All image items are initially selected.')

  const pdfA = source('pdf-a', 1, 'application/pdf', 'Agreement')
  const pdfItems = composer.createComposerItems([pdf(pdfA, 3)])
  check(pdfItems.length === 3, 'A three-page PDF creates three Composer items.')
  check(
    pdfItems.map((item) => item.pageNumber).join(',') === '1,2,3',
    'PDF pages use one-based display numbering in document order.',
  )
  check(
    pdfItems.map((item) => item.pageIndex).join(',') === '0,1,2',
    'PDF pages retain zero-based internal indexes.',
  )

  const mixedContents = [
    image(source('image-c', 2, 'image/png', 'Receipt')),
    pdf(pdfA, 2),
    image(imageA),
  ]
  const mixedItems = composer.createComposerItems(mixedContents)
  check(
    mixedItems.map((item) => item.id).join(',') ===
      'image:image-a,pdf:pdf-a:page:0,pdf:pdf-a:page:1,image:image-c',
    'Mixed images and PDF pages flatten into one deterministic global source order.',
  )

  const pdfB = source('pdf-b', 2, 'application/pdf', 'Appendix')
  const twoPdfPageOnes = composer.createComposerItems([pdf(pdfA, 1), pdf(pdfB, 1)])
  check(
    twoPdfPageOnes[0].id !== twoPdfPageOnes[1].id,
    'Page one from different PDFs has a collision-safe stable ID.',
  )

  const excludedId = mixedItems[1].id
  const excluded = composer.setComposerItemSelected(mixedItems, excludedId, false)
  check(
    composer.getSelectedComposerItems(excluded).length === 3,
    'Deselecting removes exactly one item from selected output.',
  )
  check(
    composer.getComposerItemsInSourceOrder(excluded).find((item) => item.id === excludedId)?.selected === false,
    'An excluded item remains recoverable in the source browser order.',
  )
  const reselected = composer.setComposerItemSelected(excluded, excludedId, true)
  check(
    composer.getSelectedComposerItems(reselected).map((item) => item.id).join(',') ===
      mixedItems.map((item) => item.id).join(','),
    'Re-including an item deterministically restores its previous Composer position.',
  )

  const noneSelected = mixedItems.reduce(
    (current, item) => composer.setComposerItemSelected(current, item.id, false),
    mixedItems,
  )
  check(
    composer.getComposerReadiness(noneSelected).isReady === false,
    'Zero selected items is an explicit not-ready state.',
  )
  check(
    composer.getComposerReadiness(mixedItems).selectedCount === 4,
    'Readiness reports the selected item count.',
  )

  let reordered = composer.moveSelectedComposerItem(
    mixedItems,
    'image:image-c',
    'image:image-a',
  )
  reordered = composer.moveSelectedComposerItem(
    reordered,
    'pdf:pdf-a:page:1',
    'image:image-a',
  )
  check(
    composer.getSelectedComposerItems(reordered).map((item) => item.id).join(',') ===
      'image:image-c,pdf:pdf-a:page:1,image:image-a,pdf:pdf-a:page:0',
    'Images and PDF pages can be reordered in one global output sequence.',
  )
  const movedOnce = composer.moveSelectedComposerItemByOffset(
    mixedItems,
    'pdf:pdf-a:page:0',
    -1,
  )
  check(
    composer.getSelectedComposerItems(movedOnce)[0].id === 'pdf:pdf-a:page:0',
    'Accessible offset movement changes the same global order model.',
  )

  const sourceSnapshot = JSON.stringify(mixedContents.map((content) => content.source))
  composer.moveSelectedComposerItem(mixedItems, mixedItems[3].id, mixedItems[0].id)
  check(
    JSON.stringify(mixedContents.map((content) => content.source)) === sourceSnapshot,
    'Composer reorder does not mutate persisted document source metadata.',
  )
  check(
    mixedContents.map((content) => content.source.sort_order).join(',') === '2,1,0',
    'Composer creation does not normalize or rewrite source sort_order.',
  )

  const logicalDocumentSession = composer.createComposerItems([
    image(source('scan', 0, 'image/png', 'Scan')),
    pdf(source('contract', 1, 'application/pdf', 'Contract'), 2),
  ])
  check(
    logicalDocumentSession.length === 3 &&
      logicalDocumentSession.every((item) => item.selected),
    'One logical document yields one coherent all-selected Composer session.',
  )

  console.log(`Phase 13 Document Composer checks: ${checkCount} passed`)
} finally {
  await server.close()
}
