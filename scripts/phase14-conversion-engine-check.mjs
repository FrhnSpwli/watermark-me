import { createServer } from 'vite'
import { degrees, PDFDocument } from 'pdf-lib'

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

function approximately(actual, expected, tolerance, message) {
  check(Math.abs(actual - expected) <= tolerance, message)
}

function pdfItem(sourceFileId, pageIndex, composerOrder, selected = true) {
  return {
    id: `pdf:${sourceFileId}:page:${pageIndex}`,
    kind: 'pdf-page',
    sourceFileId,
    sourceName: `${sourceFileId}.pdf`,
    mimeType: 'application/pdf',
    selected,
    initialOrder: pageIndex,
    composerOrder,
    pageIndex,
    pageNumber: pageIndex + 1,
    width: 300 + pageIndex + 1,
    height: 500 + pageIndex + 1,
    rotationDegrees: 0,
  }
}

function imageItem(sourceFileId, mimeType, composerOrder, selected = true) {
  return {
    id: `image:${sourceFileId}`,
    kind: 'image-file',
    sourceFileId,
    sourceName: `${sourceFileId}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    mimeType,
    selected,
    initialOrder: composerOrder,
    composerOrder,
    width: 1,
    height: 1,
  }
}

async function createPdf(widthBase, pageCount) {
  const pdf = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([widthBase + index + 1, 500 + index + 1])
    page.drawText(`synthetic-page-${widthBase + index + 1}`)
  }
  return new Uint8Array(await pdf.save())
}

const tinyPng = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
)

try {
  const engine = await server.ssrLoadModule(
    '/src/lib/conversion/conversionEngine.ts',
  )
  const layout = await server.ssrLoadModule(
    '/src/lib/conversion/conversionLayout.ts',
  )
  const imageConversion = await server.ssrLoadModule(
    '/src/lib/conversion/imageConversion.ts',
  )
  const pdfRasterization = await server.ssrLoadModule(
    '/src/lib/conversion/pdfRasterization.ts',
  )

  const fivePageBytes = await createPdf(300, 5)
  const fiveItems = [
    pdfItem('pdf-a', 0, 9, false),
    pdfItem('pdf-a', 1, 1),
    pdfItem('pdf-a', 2, 8, false),
    pdfItem('pdf-a', 3, 0),
    pdfItem('pdf-a', 4, 2),
  ]
  const selected = engine.getSelectedConversionItems(fiveItems)
  check(selected.length === 3, 'Only three selected items enter conversion.')
  check(
    selected.map((item) => item.pageNumber).join(',') === '4,2,5',
    'Selected items use Composer order rather than source order.',
  )

  const originalItemsSnapshot = JSON.stringify(fiveItems)
  let resolverCalls = 0
  const selectedResult = await engine.convertComposerSelection({
    items: fiveItems,
    target: 'application/pdf',
    sourceResolver: async () => {
      resolverCalls += 1
      return new Blob([fivePageBytes], { type: 'application/pdf' })
    },
  })
  check(resolverCalls === 1, 'One PDF source is resolved once for three pages.')
  check(selectedResult.artifacts.length === 1, 'PDF composition returns one artifact.')
  check(
    selectedResult.artifacts[0].mimeType === 'application/pdf' &&
      selectedResult.artifacts[0].extension === 'pdf',
    'PDF artifact includes explicit MIME and extension metadata.',
  )
  check(selectedResult.artifacts[0].blob.size > 0, 'PDF artifact is non-empty.')
  check(
    selectedResult.artifacts[0].itemIds.join(',') ===
      'pdf:pdf-a:page:3,pdf:pdf-a:page:1,pdf:pdf-a:page:4',
    'PDF artifact traces its exact Composer item order.',
  )
  const selectedPdf = await PDFDocument.load(
    await selectedResult.artifacts[0].blob.arrayBuffer(),
  )
  check(selectedPdf.getPageCount() === 3, 'Unselected PDF pages are omitted.')
  check(
    selectedPdf.getPages().map((page) => page.getWidth()).join(',') === '304,302,305',
    'Native PDF page copying preserves exact reordered page identity.',
  )
  check(
    selectedPdf.getPages().every((page) => Boolean(page.node.Contents())),
    'Native PDF page copying preserves original page content streams.',
  )
  check(
    JSON.stringify(fiveItems) === originalItemsSnapshot,
    'Conversion does not mutate Composer items or source-order metadata.',
  )

  const pdfA = await createPdf(300, 3)
  const pdfB = await createPdf(700, 2)
  const multipleSourceCalls = new Map()
  const multiSourceResult = await engine.convertComposerSelection({
    items: [
      pdfItem('pdf-a', 0, 2),
      { ...pdfItem('pdf-b', 0, 0), width: 701 },
      pdfItem('pdf-a', 2, 1),
    ],
    target: 'application/pdf',
    sourceResolver: async (sourceFileId) => {
      multipleSourceCalls.set(
        sourceFileId,
        (multipleSourceCalls.get(sourceFileId) ?? 0) + 1,
      )
      return new Blob([sourceFileId === 'pdf-a' ? pdfA : pdfB], {
        type: 'application/pdf',
      })
    },
  })
  const multiSourcePdf = await PDFDocument.load(
    await multiSourceResult.artifacts[0].blob.arrayBuffer(),
  )
  check(
    multiSourcePdf.getPages().map((page) => page.getWidth()).join(',') === '701,303,301',
    'Pages from multiple PDFs preserve one global Composer order.',
  )
  check(
    multipleSourceCalls.get('pdf-a') === 1 && multipleSourceCalls.get('pdf-b') === 1,
    'Each distinct PDF source is resolved exactly once per operation.',
  )

  const rotatedSource = await PDFDocument.create()
  const rotatedPage = rotatedSource.addPage([400, 700])
  rotatedPage.setRotation(degrees(90))
  rotatedPage.drawText('rotated-vector-content')
  const rotatedBytes = new Uint8Array(await rotatedSource.save())
  const rotatedResult = await engine.convertComposerSelection({
    items: [pdfItem('rotated', 0, 0)],
    target: 'application/pdf',
    sourceResolver: async () =>
      new Blob([rotatedBytes], { type: 'application/pdf' }),
  })
  const parsedRotatedPdf = await PDFDocument.load(
    await rotatedResult.artifacts[0].blob.arrayBuffer(),
  )
  check(
    parsedRotatedPdf.getPage(0).getRotation().angle === 90,
    'Native PDF copying preserves page rotation.',
  )
  check(
    Boolean(parsedRotatedPdf.getPage(0).node.Contents()),
    'Native PDF copying preserves rotated page vector content.',
  )

  const mixedResult = await engine.convertComposerSelection({
    items: [
      pdfItem('pdf-a', 1, 0),
      imageItem('image-a', 'image/png', 1),
      pdfItem('pdf-a', 0, 2),
    ],
    target: 'application/pdf',
    sourceResolver: async (sourceFileId) =>
      sourceFileId === 'pdf-a'
        ? new Blob([pdfA], { type: 'application/pdf' })
        : new Blob([tinyPng], { type: 'image/png' }),
  })
  const mixedPdf = await PDFDocument.load(
    await mixedResult.artifacts[0].blob.arrayBuffer(),
  )
  check(mixedPdf.getPageCount() === 3, 'Mixed image and PDF selection creates one page per item.')
  approximately(mixedPdf.getPage(0).getWidth(), 302, 0.01, 'Mixed page one is copied natively.')
  approximately(
    mixedPdf.getPage(1).getWidth(),
    layout.PDF_A4_PORTRAIT_POINTS.width,
    0.01,
    'Mixed image uses the documented A4 image-page policy.',
  )
  approximately(mixedPdf.getPage(2).getWidth(), 301, 0.01, 'Mixed page three preserves PDF order.')

  const oneImagePdf = await engine.convertComposerSelection({
    items: [imageItem('image-one', 'image/png', 0)],
    target: 'application/pdf',
    sourceResolver: async () => new Blob([tinyPng], { type: 'image/png' }),
  })
  const parsedOneImagePdf = await PDFDocument.load(
    await oneImagePdf.artifacts[0].blob.arrayBuffer(),
  )
  check(parsedOneImagePdf.getPageCount() === 1, 'One image creates one valid PDF page.')

  const twoImagePdf = await engine.convertComposerSelection({
    items: [
      imageItem('image-b', 'image/png', 1),
      imageItem('image-a', 'image/png', 0),
    ],
    target: 'application/pdf',
    sourceResolver: async () => new Blob([tinyPng], { type: 'image/png' }),
  })
  const parsedTwoImagePdf = await PDFDocument.load(
    await twoImagePdf.artifacts[0].blob.arrayBuffer(),
  )
  check(parsedTwoImagePdf.getPageCount() === 2, 'Multiple images create a valid multi-page PDF.')
  check(
    twoImagePdf.artifacts[0].itemIds.join(',') === 'image:image-a,image:image-b',
    'Multiple-image PDF metadata preserves Composer order.',
  )

  const portrait = layout.calculateImagePdfPageLayout(900, 1600)
  const landscape = layout.calculateImagePdfPageLayout(1600, 900)
  check(portrait.pageHeight > portrait.pageWidth, 'Portrait image uses portrait A4.')
  check(landscape.pageWidth > landscape.pageHeight, 'Landscape image uses landscape A4.')
  approximately(
    portrait.image.width / portrait.image.height,
    900 / 1600,
    0.0001,
    'Portrait contain-fit preserves aspect ratio.',
  )
  approximately(
    landscape.image.width / landscape.image.height,
    1600 / 900,
    0.0001,
    'Landscape contain-fit preserves aspect ratio.',
  )
  check(
    landscape.image.x >= layout.PDF_IMAGE_PAGE_MARGIN_POINTS &&
      landscape.image.y >= layout.PDF_IMAGE_PAGE_MARGIN_POINTS &&
      landscape.image.x + landscape.image.width <=
        landscape.pageWidth - layout.PDF_IMAGE_PAGE_MARGIN_POINTS + 0.01 &&
      landscape.image.y + landscape.image.height <=
        landscape.pageHeight - layout.PDF_IMAGE_PAGE_MARGIN_POINTS + 0.01,
    'Image-to-PDF layout neither clips nor exceeds its fixed margins.',
  )

  const canvasCalls = []
  const fakeContext = {
    fillStyle: '',
    clearRect() { canvasCalls.push('clear') },
    fillRect() { canvasCalls.push(`fill:${this.fillStyle}`) },
    drawImage() { canvasCalls.push('draw') },
  }
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext() { return fakeContext },
  }
  imageConversion.prepareImageCanvas(
    fakeCanvas,
    { source: {}, width: 20, height: 10 },
    'image/jpeg',
  )
  check(
    canvasCalls.join(',') === 'clear,fill:#ffffff,draw',
    'JPEG conversion paints deterministic white before drawing transparent pixels.',
  )
  canvasCalls.length = 0
  imageConversion.prepareImageCanvas(
    fakeCanvas,
    { source: {}, width: 20, height: 10 },
    'image/png',
  )
  check(
    canvasCalls.join(',') === 'clear,draw',
    'PNG encoding preserves transparency without a forced background.',
  )
  check(imageConversion.DEFAULT_JPEG_QUALITY === 0.9, 'JPEG quality is centralized at 0.9.')
  check(
    pdfRasterization.calculatePdfRasterScale(612, 792) === 2,
    'Ordinary PDF pages rasterize at the centralized 2x scale.',
  )
  approximately(
    pdfRasterization.calculatePdfRasterScale(1000, 10000),
    0.4096,
    0.000001,
    'Oversized PDF pages are capped at 4096 pixels on the longest edge.',
  )

  const jpegPlan = engine.createConversionPlan(
    [imageItem('photo', 'image/jpeg', 0)],
    'image/png',
  )
  const pngPlan = engine.createConversionPlan(
    [imageItem('scan', 'image/png', 0)],
    'image/jpeg',
  )
  check(jpegPlan.mode === 'convert-images', 'JPEG to PNG selects ordered image conversion.')
  check(pngPlan.mode === 'convert-images', 'PNG to JPEG selects ordered image conversion.')

  const orderedImageItems = [
    imageItem('image-a', 'image/jpeg', 1),
    imageItem('image-b', 'image/png', 2),
    imageItem('image-c', 'image/jpeg', 0),
  ]
  const imageSourceBlobs = new Map([
    ['image-a', new Blob(['jpeg-a'], { type: 'image/jpeg' })],
    ['image-b', new Blob(['png-b'], { type: 'image/png' })],
    ['image-c', new Blob(['jpeg-c'], { type: 'image/jpeg' })],
  ])
  const jpegAdapterCalls = []
  const jpegBatch = await engine.convertComposerSelection({
    items: orderedImageItems,
    target: 'image/jpeg',
    sourceResolver: async (sourceFileId) => imageSourceBlobs.get(sourceFileId),
    imageConverter: async (blob, target) => {
      jpegAdapterCalls.push({ blob, target })
      return new Blob([`jpeg:${await blob.text()}`], { type: target })
    },
  })
  check(jpegBatch.artifacts.length === 3, 'Three selected images create three JPEG artifacts.')
  check(
    jpegBatch.artifacts.map((artifact) => artifact.itemIds[0]).join(',') ===
      'image:image-c,image:image-a,image:image-b',
    'Multi-image JPEG artifacts preserve current Composer order.',
  )
  check(
    jpegBatch.artifacts[0].blob === imageSourceBlobs.get('image-c') &&
      jpegBatch.artifacts[1].blob === imageSourceBlobs.get('image-a'),
    'JPEG sources pass through to JPEG output without replacing their Blob bytes.',
  )
  check(
    jpegAdapterCalls.length === 1 &&
      jpegAdapterCalls[0].blob === imageSourceBlobs.get('image-b') &&
      jpegAdapterCalls[0].target === 'image/jpeg',
    'Only the PNG source invokes the JPEG adapter in a mixed image batch.',
  )
  check(
    jpegBatch.artifacts.every(
      (artifact) => artifact.mimeType === 'image/jpeg' && artifact.extension === 'jpg',
    ),
    'Every JPEG batch artifact reports its actual target MIME and extension.',
  )

  const pngAdapterCalls = []
  const pngBatch = await engine.convertComposerSelection({
    items: orderedImageItems,
    target: 'image/png',
    sourceResolver: async (sourceFileId) => imageSourceBlobs.get(sourceFileId),
    imageConverter: async (blob, target) => {
      pngAdapterCalls.push({ blob, target })
      return new Blob([`png:${await blob.text()}`], { type: target })
    },
  })
  check(pngBatch.artifacts.length === 3, 'Three selected images create three PNG artifacts.')
  check(
    pngBatch.artifacts.map((artifact) => artifact.itemIds[0]).join(',') ===
      'image:image-c,image:image-a,image:image-b',
    'Multi-image PNG artifacts preserve current Composer order.',
  )
  check(
    pngBatch.artifacts[2].blob === imageSourceBlobs.get('image-b'),
    'PNG sources pass through to PNG output without replacing their Blob bytes.',
  )
  check(
    pngAdapterCalls.length === 2 &&
      pngAdapterCalls.every((call) => call.target === 'image/png'),
    'Only JPEG sources invoke the PNG adapter in a mixed image batch.',
  )

  let sameFormatAdapterCalls = 0
  const sameJpegBlob = imageSourceBlobs.get('image-a')
  const sameJpeg = await engine.convertComposerSelection({
    items: [imageItem('image-a', 'image/jpeg', 0)],
    target: 'image/jpeg',
    sourceResolver: async () => sameJpegBlob,
    imageConverter: async () => {
      sameFormatAdapterCalls += 1
      return new Blob(['unexpected'], { type: 'image/jpeg' })
    },
  })
  const samePngBlob = imageSourceBlobs.get('image-b')
  const samePng = await engine.convertComposerSelection({
    items: [imageItem('image-b', 'image/png', 0)],
    target: 'image/png',
    sourceResolver: async () => samePngBlob,
    imageConverter: async () => {
      sameFormatAdapterCalls += 1
      return new Blob(['unexpected'], { type: 'image/png' })
    },
  })
  check(sameFormatAdapterCalls === 0, 'Same-format JPEG and PNG never invoke the re-encoding adapter.')
  check(sameJpeg.artifacts[0].blob === sameJpegBlob, 'JPEG to JPEG returns the source Blob unchanged.')
  check(samePng.artifacts[0].blob === samePngBlob, 'PNG to PNG returns the source Blob unchanged.')

  const rasterItems = [
    pdfItem('pdf-a', 0, 2),
    pdfItem('pdf-b', 0, 0),
    pdfItem('pdf-a', 2, 1),
  ]
  const rasterPlan = engine.createConversionPlan(rasterItems, 'image/png')
  check(rasterPlan.mode === 'rasterize-pdf-pages', 'PDF to PNG selects PDF rasterization.')
  check(
    rasterPlan.items.map((item) => item.id).join(',') ===
      'pdf:pdf-b:page:0,pdf:pdf-a:page:2,pdf:pdf-a:page:0',
    'PDF image artifacts are planned in exact Composer order across sources.',
  )
  check(
    engine.createConversionPlan(rasterItems, 'image/jpeg').mode === 'rasterize-pdf-pages',
    'PDF to JPEG uses the same ordered raster plan.',
  )

  let unsupportedError = null
  try {
    engine.createConversionPlan(
      [imageItem('image-a', 'image/png', 0), pdfItem('pdf-a', 0, 1)],
      'image/png',
    )
  } catch (error) {
    unsupportedError = error
  }
  check(
    unsupportedError?.code === 'unsupported-conversion',
    'Unsupported mixed-to-image output fails with a typed domain error.',
  )

  let emptySelectionError = null
  try {
    engine.createConversionPlan(
      [imageItem('excluded', 'image/png', 0, false)],
      'application/pdf',
    )
  } catch (error) {
    emptySelectionError = error
  }
  check(
    emptySelectionError?.code === 'empty-selection',
    'An empty selected composition fails before any processing.',
  )

  const controller = new AbortController()
  controller.abort()
  let cancelledError = null
  let cancelledResolverCalls = 0
  try {
    await engine.convertComposerSelection({
      items: [pdfItem('pdf-a', 0, 0)],
      target: 'application/pdf',
      signal: controller.signal,
      sourceResolver: async () => {
        cancelledResolverCalls += 1
        return new Blob([pdfA], { type: 'application/pdf' })
      },
    })
  } catch (error) {
    cancelledError = error
  }
  check(cancelledError?.code === 'conversion-cancelled', 'Cancellation is recognizable and typed.')
  check(cancelledResolverCalls === 0, 'Pre-cancelled conversion performs no source read.')

  const midReadController = new AbortController()
  let midReadResult = null
  try {
    await engine.convertComposerSelection({
      items: [pdfItem('pdf-a', 0, 0), pdfItem('pdf-a', 1, 1)],
      target: 'application/pdf',
      signal: midReadController.signal,
      sourceResolver: async () => {
        midReadController.abort()
        return new Blob([pdfA], { type: 'application/pdf' })
      },
    })
  } catch (error) {
    midReadResult = error
  }
  check(
    midReadResult?.code === 'conversion-cancelled',
    'Cancellation during a source read returns no partial success.',
  )

  const imageBatchController = new AbortController()
  let cancelledImageBatch = null
  let cancelledImageResolverCalls = 0
  try {
    await engine.convertComposerSelection({
      items: [
        imageItem('image-a', 'image/jpeg', 0),
        imageItem('image-b', 'image/png', 1),
        imageItem('image-c', 'image/jpeg', 2),
      ],
      target: 'image/jpeg',
      signal: imageBatchController.signal,
      sourceResolver: async (sourceFileId) => {
        cancelledImageResolverCalls += 1
        return imageSourceBlobs.get(sourceFileId)
      },
      imageConverter: async () => {
        imageBatchController.abort()
        return new Blob(['cancelled'], { type: 'image/jpeg' })
      },
    })
  } catch (error) {
    cancelledImageBatch = error
  }
  check(
    cancelledImageBatch?.code === 'conversion-cancelled',
    'Cancelling a multi-image conversion returns no partial success result.',
  )
  check(
    cancelledImageResolverCalls === 2,
    'Cancellation stops remaining multi-image source work.',
  )

  const progressResult = await engine.convertComposerSelection({
    items: [pdfItem('pdf-a', 0, 0)],
    target: 'application/pdf',
    sourceResolver: async () => new Blob([pdfA], { type: 'application/pdf' }),
    onProgress() { throw new Error('consumer failure') },
  })
  check(progressResult.artifacts[0].blob.size > 0, 'Progress callback failures do not fail conversion.')

  let sourceFailure = null
  try {
    await engine.convertComposerSelection({
      items: [pdfItem('pdf-a', 0, 0)],
      target: 'application/pdf',
      sourceResolver: async () => { throw new Error('private backend details') },
    })
  } catch (error) {
    sourceFailure = error
  }
  check(
    sourceFailure?.code === 'source-unavailable' &&
      !sourceFailure.message.includes('backend'),
    'Source failures use a safe typed message without leaking provider details.',
  )

  let invalidPageError = null
  try {
    await engine.convertComposerSelection({
      items: [pdfItem('pdf-a', 99, 0)],
      target: 'application/pdf',
      sourceResolver: async () => new Blob([pdfA], { type: 'application/pdf' }),
    })
  } catch (error) {
    invalidPageError = error
  }
  check(invalidPageError?.code === 'pdf-page-invalid', 'Invalid page indexes fail predictably.')

  console.log(`Phase 14 conversion engine checks: ${checkCount} passed`)
} finally {
  await server.close()
}
