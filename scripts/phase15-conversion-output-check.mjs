import { createServer } from 'vite'
import JSZip from 'jszip'

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

function imageItem(
  sourceFileId,
  mimeType,
  composerOrder,
  selected = true,
  sourceName = `${sourceFileId}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
) {
  return {
    id: `image:${sourceFileId}`,
    kind: 'image-file',
    sourceFileId,
    sourceName,
    mimeType,
    selected,
    initialOrder: composerOrder,
    composerOrder,
    width: 100,
    height: 200,
  }
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
    width: 612,
    height: 792,
    rotationDegrees: 0,
  }
}

function targets(options) {
  return options.map((option) => option.target).join(',')
}

try {
  const output = await server.ssrLoadModule(
    '/src/lib/conversion/conversionOutput.ts',
  )
  const downloads = await server.ssrLoadModule(
    '/src/lib/conversion/conversionDownload.ts',
  )
  const errors = await server.ssrLoadModule(
    '/src/lib/conversion/conversionError.ts',
  )

  const noSelection = [imageItem('none', 'image/png', 0, false)]
  check(output.getConversionOptions(noSelection).length === 0, 'Empty selection has no output options.')
  check(output.getDefaultConversionTarget(noSelection) === null, 'Empty selection has no default target.')

  const singleJpeg = [imageItem('photo', 'image/jpeg', 0)]
  const jpegOptions = output.getConversionOptions(singleJpeg)
  check(targets(jpegOptions) === 'application/pdf,image/png,image/jpeg', 'Single JPEG offers PDF, PNG, and JPEG.')
  check(output.getDefaultConversionTarget(singleJpeg) === 'image/png', 'Single JPEG defaults to PNG conversion.')
  check(jpegOptions.find((option) => option.target === 'image/png').outputShape === 'single', 'JPEG to PNG predicts one artifact.')
  check(jpegOptions.find((option) => option.target === 'image/png').warnings[0].includes('does not restore'), 'JPEG to PNG explains that quality is not restored.')

  const singlePng = [imageItem('scan', 'image/png', 0)]
  const pngOptions = output.getConversionOptions(singlePng)
  check(targets(pngOptions) === 'application/pdf,image/png,image/jpeg', 'Single PNG offers PDF, PNG, and JPEG.')
  check(output.getDefaultConversionTarget(singlePng) === 'image/jpeg', 'Single PNG defaults to JPEG conversion.')
  const pngToJpegWarnings = pngOptions.find((option) => option.target === 'image/jpeg').warnings.join(' ')
  check(pngToJpegWarnings.includes('Transparent areas'), 'PNG to JPEG warns about a white transparency fill.')
  check(pngToJpegWarnings.includes('lossy'), 'PNG to JPEG warns about lossy compression.')

  const multipleImages = [
    imageItem('front', 'image/jpeg', 0),
    imageItem('back', 'image/png', 1),
  ]
  const multipleImageOptions = output.getConversionOptions(multipleImages)
  check(targets(multipleImageOptions) === 'application/pdf,image/png,image/jpeg', 'Mixed JPEG and PNG images offer PDF, PNG, and JPEG.')
  check(output.getDefaultConversionTarget(multipleImages) === 'application/pdf', 'Multiple images default to PDF.')
  check(multipleImageOptions[0].artifactCount === 1, 'Multiple-image PDF predicts one artifact.')
  check(multipleImageOptions.find((option) => option.target === 'image/png').artifactCount === 2, 'Multiple images predict one PNG artifact per image.')
  check(multipleImageOptions.find((option) => option.target === 'image/jpeg').artifactCount === 2, 'Multiple images predict one JPEG artifact per image.')
  check(multipleImageOptions.find((option) => option.target === 'image/png').description === 'One PNG file per selected image.', 'PNG readiness describes independent image outputs.')
  check(multipleImageOptions.find((option) => option.target === 'image/jpeg').description === 'One JPEG file per selected image.', 'JPEG readiness describes independent image outputs.')
  const multipleJpegOptions = output.getConversionOptions([
    imageItem('one', 'image/jpeg', 0),
    imageItem('two', 'image/jpeg', 1),
  ])
  check(targets(multipleJpegOptions) === 'application/pdf,image/png,image/jpeg', 'Two JPEG images offer all three output targets.')
  const multiplePngOptions = output.getConversionOptions([
    imageItem('one', 'image/png', 0),
    imageItem('two', 'image/png', 1),
  ])
  check(targets(multiplePngOptions) === 'application/pdf,image/png,image/jpeg', 'Two PNG images offer all three output targets.')
  const multiJpegWarnings = multipleImageOptions.find((option) => option.target === 'image/jpeg').warnings.join(' ')
  check(multiJpegWarnings.includes('Transparent areas'), 'A PNG in a JPEG batch retains the white-background warning.')
  check(multiJpegWarnings.includes('lossy'), 'A PNG in a JPEG batch retains the lossy-compression warning.')

  const pdfPages = [
    pdfItem('contract', 4, 0),
    pdfItem('contract', 1, 1),
    pdfItem('contract', 3, 2),
  ]
  const pdfOptions = output.getConversionOptions(pdfPages)
  check(targets(pdfOptions) === 'application/pdf,image/png,image/jpeg', 'PDF pages offer PDF, PNG, and JPEG.')
  check(output.getDefaultConversionTarget(pdfPages) === 'application/pdf', 'PDF pages default to PDF.')
  check(pdfOptions.find((option) => option.target === 'application/pdf').artifactCount === 1, 'PDF composition predicts one artifact.')
  check(pdfOptions.find((option) => option.target === 'image/png').artifactCount === 3, 'PDF to PNG predicts one artifact per selected page.')
  check(pdfOptions.find((option) => option.target === 'image/jpeg').outputShape === 'multiple', 'Three PDF pages to JPEG predict multiple artifacts.')
  check(pdfOptions.find((option) => option.target === 'image/png').warnings[0].includes('separate image'), 'PDF to PNG explains raster multi-output.')
  check(pdfOptions.find((option) => option.target === 'image/jpeg').warnings.join(' ').includes('white page background'), 'PDF to JPEG explains its white background.')

  const mixed = [
    imageItem('cover', 'image/png', 0),
    pdfItem('contract', 1, 1),
  ]
  const mixedOptions = output.getConversionOptions(mixed)
  check(targets(mixedOptions) === 'application/pdf', 'Mixed image and PDF-page selection offers only PDF.')
  check(output.getDefaultConversionTarget(mixed) === 'application/pdf', 'Mixed selection defaults to PDF.')

  const unsafeName = '  ../KTP \\ Test:*?"<>|.pdf  '
  const sanitized = output.sanitizeOutputBaseName(unsafeName)
  check(!/[<>:"/\\|?*]/.test(sanitized), 'Unsafe filesystem characters are removed from output names.')
  check(!sanitized.startsWith('.') && !sanitized.endsWith('.'), 'Output base names cannot express traversal or trailing dots.')
  check(!/\s/.test(sanitized), 'Meaningless filename whitespace is normalized.')
  check(output.sanitizeOutputBaseName('  ...  ') === 'WatermarkMe_Output', 'Empty sanitized names use a safe fallback.')
  check(output.sanitizeOutputBaseName('CON') === 'WatermarkMe_Output', 'Reserved device names use a safe fallback.')
  check(output.sanitizeOutputBaseName('x'.repeat(200)).length === 80, 'Output base names have a deterministic maximum length.')
  check(output.sanitizeOutputBaseName('Identity Card.PNG') === 'Identity_Card', 'Known source extensions are not duplicated in output names.')

  const artifacts = [
    { blob: new Blob(['page-five'], { type: 'image/png' }), mimeType: 'image/png', extension: 'png', itemIds: [pdfPages[0].id] },
    { blob: new Blob(['page-two'], { type: 'image/png' }), mimeType: 'image/png', extension: 'png', itemIds: [pdfPages[1].id] },
    { blob: new Blob(['page-four'], { type: 'image/png' }), mimeType: 'image/png', extension: 'png', itemIds: [pdfPages[2].id] },
  ]
  const filenames = output.createArtifactFilenames('KTP Test Multi', artifacts)
  check(filenames.join(',') === 'KTP_Test_Multi_001.png,KTP_Test_Multi_002.png,KTP_Test_Multi_003.png', 'Multi-output filenames use deterministic Composer artifact order.')
  check(new Set(filenames).size === filenames.length, 'Multi-output filenames are unique.')
  check(output.createArtifactFilenames('Photo', [{ ...artifacts[0], extension: 'jpg', mimeType: 'image/jpeg' }])[0] === 'Photo.jpg', 'JPEG artifacts use the controlled .jpg extension.')
  check(output.createArtifactFilenames('Document', [{ ...artifacts[0], extension: 'pdf', mimeType: 'application/pdf' }])[0] === 'Document.pdf', 'PDF artifacts use the controlled .pdf extension.')
  check(output.createZipFilename('KTP Test Multi') === 'KTP_Test_Multi.zip', 'ZIP uses the same sanitized document base name.')

  const namedImageItems = [
    imageItem('ktp', 'image/jpeg', 0, true, 'KTP.jpg'),
    imageItem('kis', 'image/jpeg', 1, true, 'KIS.jpg'),
  ]
  const namedImageArtifacts = namedImageItems.map((item, index) => ({
    blob: new Blob([index === 0 ? 'ktp-output' : 'kis-output'], { type: 'image/png' }),
    mimeType: 'image/png',
    extension: 'png',
    itemIds: [item.id],
  }))
  const namedImageFilenames = output.createArtifactFilenames(
    'Identity Package',
    namedImageArtifacts,
    namedImageItems,
  )
  check(namedImageFilenames.join(',') === 'KTP.png,KIS.png', 'Multi-image filenames derive from each source and replace its extension.')

  const collidingItems = [
    imageItem('front-jpeg', 'image/jpeg', 0, true, 'front.jpg'),
    imageItem('front-png', 'image/png', 1, true, 'front.png'),
  ]
  const collidingArtifacts = collidingItems.map((item) => ({
    blob: new Blob([item.id], { type: 'image/png' }),
    mimeType: 'image/png',
    extension: 'png',
    itemIds: [item.id],
  }))
  const collisionNames = output.createArtifactFilenames(
    'Front and Back',
    collidingArtifacts,
    collidingItems,
  )
  check(collisionNames.join(',') === 'front.png,front_002.png', 'Source filename collisions receive deterministic ordered suffixes.')
  check(new Set(collisionNames.map((name) => name.toLocaleLowerCase())).size === 2, 'Collision handling prevents duplicate ZIP or download names.')

  const individualDownloads = namedImageArtifacts.map((_, index) =>
    downloads.getArtifactDownload(
      namedImageArtifacts,
      namedImageFilenames,
      index,
    ),
  )
  check(individualDownloads.every(Boolean), 'Every multi-output artifact has individual download metadata.')
  check(individualDownloads[1].filename === 'KIS.png', 'An individual download resolves only the requested ordered artifact.')
  check(individualDownloads[1].blob === namedImageArtifacts[1].blob, 'Individual download metadata retains the exact generated Blob.')
  check(downloads.getArtifactDownload(namedImageArtifacts, namedImageFilenames, 2) === null, 'Out-of-range individual downloads fail safely.')

  const originalKey = output.createConversionInputKey('document-a', pdfPages, 'application/pdf')
  const reorderedPages = pdfPages.map((item, index) => ({ ...item, composerOrder: 2 - index }))
  const reorderedKey = output.createConversionInputKey('document-a', reorderedPages, 'application/pdf')
  const selectionKey = output.createConversionInputKey('document-a', pdfPages.map((item, index) => ({ ...item, selected: index !== 1 })), 'application/pdf')
  const targetKey = output.createConversionInputKey('document-a', pdfPages, 'image/png')
  const documentKey = output.createConversionInputKey('document-b', pdfPages, 'application/pdf')
  check(output.isConversionInputCurrent(originalKey, originalKey), 'An unchanged result input remains current.')
  check(!output.isConversionInputCurrent(originalKey, reorderedKey), 'Composer order changes make a result stale.')
  check(!output.isConversionInputCurrent(originalKey, selectionKey), 'Selection changes make a result stale.')
  check(!output.isConversionInputCurrent(originalKey, targetKey), 'Target changes make a result stale.')
  check(!output.isConversionInputCurrent(originalKey, documentKey), 'Document changes make a result stale.')
  const multiImageKey = output.createConversionInputKey('document-a', multipleImages, 'image/png')
  const reorderedImages = multipleImages.map((item, index) => ({
    ...item,
    composerOrder: multipleImages.length - index,
  }))
  check(
    !output.isConversionInputCurrent(
      multiImageKey,
      output.createConversionInputKey('document-a', reorderedImages, 'image/png'),
    ),
    'Reordering a multi-image result invalidates all individual and ZIP output.',
  )

  const sourceError = new errors.ConversionError('provider secret', 'source-unavailable')
  const safeMessage = output.getConversionErrorMessage(sourceError)
  check(safeMessage.includes('could not be loaded'), 'Typed source errors map to actionable copy.')
  check(!safeMessage.includes('provider secret'), 'Mapped errors do not expose raw provider details.')
  const cancelledError = new errors.ConversionError('cancelled', 'conversion-cancelled')
  check(output.isConversionCancellation(cancelledError), 'Intentional cancellation is recognized separately from failure.')
  check(!output.isConversionCancellation(sourceError), 'Ordinary conversion failures are not treated as cancellation.')

  let latestZipPercent = 0
  const zipBlob = await downloads.createArtifactsZip(
    artifacts,
    filenames,
    (percent) => { latestZipPercent = percent },
  )
  check(zipBlob.size > 0, 'ZIP packaging creates a non-empty Blob.')
  check(zipBlob.type === 'application/zip', 'ZIP Blob uses the application/zip MIME type.')
  check(latestZipPercent === 100, 'ZIP packaging exposes real completion progress.')
  const parsedZip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
  const zipEntries = Object.keys(parsedZip.files)
  check(zipEntries.join(',') === filenames.join(','), 'ZIP entry names preserve deterministic artifact order.')
  check(zipEntries.length === 3, 'ZIP contains exactly the generated artifacts.')
  check(await parsedZip.file(filenames[0]).async('string') === 'page-five', 'First ZIP entry contains the first generated artifact.')
  check(await parsedZip.file(filenames[2]).async('string') === 'page-four', 'Last ZIP entry contains the last generated artifact.')
  check(!zipEntries.some((entry) => /original|metadata|storage/i.test(entry)), 'ZIP contains no source or persistence metadata entries.')

  const namedZip = await downloads.createArtifactsZip(
    namedImageArtifacts,
    namedImageFilenames,
  )
  const namedZipEntries = Object.keys(
    (await JSZip.loadAsync(await namedZip.arrayBuffer())).files,
  )
  check(namedZipEntries.join(',') === 'KTP.png,KIS.png', 'Image-only ZIP contains every source-derived artifact in Composer order.')

  console.log(`Phase 15 conversion output checks: ${checkCount} passed`)
} finally {
  await server.close()
}
