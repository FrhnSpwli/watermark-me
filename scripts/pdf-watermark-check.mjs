import { createServer } from 'vite'
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib'

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

function checkWithinSafeMargins(layout, message) {
  const left = layout.x - layout.boundingWidth / 2
  const right = layout.x + layout.boundingWidth / 2
  const bottom = layout.y - layout.boundingHeight / 2
  const top = layout.y + layout.boundingHeight / 2
  const tolerance = 0.02

  check(left + tolerance >= layout.safeMargin, `${message}: left safe margin.`)
  check(
    right - tolerance <= layout.pageWidth - layout.safeMargin,
    `${message}: right safe margin.`,
  )
  check(bottom + tolerance >= layout.safeMargin, `${message}: bottom safe margin.`)
  check(
    top - tolerance <= layout.pageHeight - layout.safeMargin,
    `${message}: top safe margin.`,
  )
}

async function createPdf(pageSpecs) {
  const pdf = await PDFDocument.create()

  for (const spec of pageSpecs) {
    const page = pdf.addPage([spec.width, spec.height])

    if (spec.rotation) {
      page.setRotation(degrees(spec.rotation))
    }

  }

  return new Uint8Array(await pdf.save())
}

try {
  const renderer = await server.ssrLoadModule(
    '/src/lib/watermark/pdfWatermark.ts',
  )
  const config = await server.ssrLoadModule(
    '/src/lib/watermark/watermarkConfig.ts',
  )
  const date = new Date(2026, 7, 9)
  const purposeSettings = {
    ...config.DEFAULT_WATERMARK_SETTINGS,
    text: config.generateDefaultWatermarkText(
      'bank-verification',
      'Bank BCA',
      date,
    ),
  }
  const mixedSource = await createPdf([
    { width: 595, height: 842 },
    { width: 842, height: 595 },
    { width: 400, height: 700, rotation: 90 },
  ])
  const originalSnapshot = new Uint8Array(mixedSource)
  const metadata = await renderer.inspectPdfBytes(mixedSource)

  check(metadata.length === 3, 'Mixed PDF metadata includes every page.')
  check(metadata[0].orientation === 'portrait', 'Portrait page is detected.')
  check(metadata[1].orientation === 'landscape', 'Landscape page is detected.')
  check(
    metadata[2].width === 700 && metadata[2].height === 400,
    'Rotated page uses its visual dimensions.',
  )

  let invalidPdfError = null
  try {
    await renderer.inspectPdfBytes(new TextEncoder().encode('not a PDF'))
  } catch (error) {
    invalidPdfError = error
  }
  check(
    invalidPdfError?.name === 'PdfWatermarkError' && invalidPdfError?.code === 'invalid',
    'Invalid PDF bytes are rejected with a safe typed error.',
  )

  const generated = await renderer.generateWatermarkedPdf(
    mixedSource,
    purposeSettings,
  )
  check(generated.processedPageCount === 3, 'Every mixed PDF page is processed.')
  check(generated.layouts.length === 3, 'Every processed page has an independent layout.')
  check(
    mixedSource.every((byte, index) => byte === originalSnapshot[index]),
    'Generation never mutates the source PDF bytes.',
  )

  const outputPdf = await PDFDocument.load(generated.bytes)
  check(outputPdf.getPageCount() === 3, 'Generated PDF preserves the page count.')
  outputPdf.getPages().forEach((page, index) => {
    check(Boolean(page.node.Contents()), `Generated page ${index + 1} has content.`)
  })

  const measurementPdf = await PDFDocument.create()
  const fonts = {
    regular: await measurementPdf.embedFont(StandardFonts.Helvetica),
    bold: await measurementPdf.embedFont(StandardFonts.HelveticaBold),
  }
  const positions = [
    'top-left',
    'top-center',
    'top-right',
    'center-left',
    'center',
    'center-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]

  for (const position of positions) {
    const layout = renderer.calculatePdfPageWatermarkLayout(
      595,
      842,
      { ...purposeSettings, position, rotationDegrees: 0 },
      fonts,
    )
    checkWithinSafeMargins(layout, `${position} at 0 degrees`)

    if (position.endsWith('-left')) {
      approximately(
        layout.x - layout.boundingWidth / 2,
        layout.safeMargin,
        0.01,
        `${position} aligns its left bound.`,
      )
    } else if (position.endsWith('-right')) {
      approximately(
        layout.x + layout.boundingWidth / 2,
        layout.pageWidth - layout.safeMargin,
        0.01,
        `${position} aligns its right bound.`,
      )
    } else {
      approximately(layout.x, layout.pageWidth / 2, 0.01, `${position} centers horizontally.`)
    }

    if (position.startsWith('top-')) {
      approximately(
        layout.y + layout.boundingHeight / 2,
        layout.pageHeight - layout.safeMargin,
        0.01,
        `${position} aligns its top bound.`,
      )
    } else if (position.startsWith('bottom-')) {
      approximately(
        layout.y - layout.boundingHeight / 2,
        layout.safeMargin,
        0.01,
        `${position} aligns its bottom bound.`,
      )
    } else {
      approximately(layout.y, layout.pageHeight / 2, 0.01, `${position} centers vertically.`)
    }
  }

  const rotatedCases = [
    { position: 'top-left', rotationDegrees: -25 },
    { position: 'top-right', rotationDegrees: 25 },
    { position: 'center', rotationDegrees: -22 },
    { position: 'bottom-left', rotationDegrees: 25 },
    { position: 'bottom-right', rotationDegrees: -25 },
  ]

  for (const testCase of rotatedCases) {
    const layout = renderer.calculatePdfPageWatermarkLayout(
      842,
      595,
      { ...purposeSettings, ...testCase },
      fonts,
    )
    checkWithinSafeMargins(
      layout,
      `${testCase.position} at ${testCase.rotationDegrees} degrees`,
    )
    check(
      layout.rotationDegrees === testCase.rotationDegrees,
      `${testCase.position} preserves independent rotation.`,
    )
  }

  const longSettings = {
    ...purposeSettings,
    text: config.generateDefaultWatermarkText(
      'job-application',
      'PT Semen Indonesia (Persero) Tbk',
      date,
    ),
    position: 'top-right',
    rotationDegrees: 25,
  }
  const longLayout = renderer.calculatePdfPageWatermarkLayout(
    595,
    842,
    longSettings,
    fonts,
  )
  checkWithinSafeMargins(longLayout, 'Long recipient near an edge')
  check(
    longLayout.lines.filter((line) => line.role === 'primary').length >= 2,
    'Long PDF recipient wraps before excessive shrinking.',
  )
  check(
    longLayout.lines.filter((line) => line.role === 'primary').every(
      (line) => line.text.split(' ').length > 1,
    ),
    'Long PDF recipient avoids an isolated one-word line.',
  )

  const customSettings = {
    ...purposeSettings,
    text: 'COPY FOR REVIEW\nCASE 42\nDO NOT REDISTRIBUTE',
    textStyle: 'custom',
    rotationDegrees: 0,
  }
  const customOutput = await renderer.generateWatermarkedPdf(
    await createPdf([{ width: 612, height: 792 }]),
    customSettings,
  )
  check(customOutput.processedPageCount === 1, 'One-page custom PDF is processed.')
  check(
    customOutput.layouts[0].lines.every((line) => line.role === 'custom'),
    'Other multiline text does not receive purpose hierarchy.',
  )

  for (const opacity of [0.1, 1]) {
    const result = await renderer.generateWatermarkedPdf(
      await createPdf([{ width: 792, height: 612 }]),
      { ...purposeSettings, opacity },
    )
    check(result.bytes.length > 0, `PDF generates at opacity ${opacity}.`)
  }

  check(
    config.buildWatermarkedFilename(
      'KTP.pdf',
      'bank-verification',
      'Bank BCA',
      date,
      'pdf',
    ) === 'KTP_BANK_VERIFICATION_BANK_BCA_20260809.pdf',
    'Safe PDF filename uses the shared naming strategy.',
  )

  console.log(`PDF watermark regression checks: ${checkCount} passed`)
} finally {
  await server.close()
}
