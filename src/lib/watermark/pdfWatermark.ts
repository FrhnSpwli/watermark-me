import {
  BlendMode,
  degrees,
  EncryptedPDFError,
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from 'pdf-lib'
import type { WatermarkSettings } from '../../types/watermark'
import {
  MAX_FONT_SIZE_RATIO,
  MAX_WATERMARK_OPACITY,
  MAX_WATERMARK_ROTATION,
  MAX_WATERMARK_TEXT_LENGTH,
  MIN_FONT_SIZE_RATIO,
  MIN_WATERMARK_OPACITY,
  MIN_WATERMARK_ROTATION,
  WATERMARK_VISUAL_LAYOUT,
} from './watermarkConfig'
import { calculateWatermarkSafeMargin } from './imageWatermark'
import { wrapWatermarkText } from './watermarkTextLayout'

const MAX_WATERMARK_LINES = 10
const PDF_BOUND_PADDING_RATIO = 0.025
const PDF_RECIPIENT_WRAP_MINIMUM_FIT_SCALE = 0.8
const PDF_INDIGO = rgb(79 / 255, 70 / 255, 229 / 255)

export type PdfWatermarkErrorCode =
  | 'access'
  | 'invalid'
  | 'encrypted'
  | 'text'
  | 'memory'
  | 'generation'
  | 'export'

export class PdfWatermarkError extends Error {
  constructor(
    message: string,
    public readonly code: PdfWatermarkErrorCode,
  ) {
    super(message)
    this.name = 'PdfWatermarkError'
  }
}

export interface PdfPageMetadata {
  pageNumber: number
  width: number
  height: number
  orientation: 'portrait' | 'landscape' | 'square'
  rotationDegrees: number
}

export interface PrivatePdfSource {
  bytes: Uint8Array
  pageCount: number
  pages: PdfPageMetadata[]
}

type PdfWatermarkLineRole = 'eyebrow' | 'primary' | 'secondary' | 'custom'

interface PdfWatermarkLineSpec {
  text: string
  role: PdfWatermarkLineRole
  sizeRatio: number
  fontWeight: 'regular' | 'bold'
  letterSpacingRatio: number
}

export interface PdfWatermarkLineLayout {
  text: string
  role: PdfWatermarkLineRole
  fontSize: number
  fontWeight: 'regular' | 'bold'
  letterSpacing: number
  width: number
  y: number
}

export interface PdfPageWatermarkLayout {
  pageWidth: number
  pageHeight: number
  lines: PdfWatermarkLineLayout[]
  fontSize: number
  isHierarchical: boolean
  x: number
  y: number
  rotationDegrees: number
  contentWidth: number
  contentHeight: number
  boundingWidth: number
  boundingHeight: number
  safeMargin: number
}

export interface GeneratedPdfResult {
  bytes: Uint8Array
  processedPageCount: number
  layouts: PdfPageWatermarkLayout[]
}

interface PdfFontSet {
  regular: PDFFont
  bold: PDFFont
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizePageRotation(value: number) {
  return ((value % 360) + 360) % 360
}

function getVisualPageSize(page: PDFPage) {
  const rawSize = page.getSize()
  const rotationDegrees = normalizePageRotation(page.getRotation().angle)
  const isQuarterTurn = rotationDegrees === 90 || rotationDegrees === 270

  return {
    rawWidth: rawSize.width,
    rawHeight: rawSize.height,
    width: isQuarterTurn ? rawSize.height : rawSize.width,
    height: isQuarterTurn ? rawSize.width : rawSize.height,
    rotationDegrees,
  }
}

function getOrientation(width: number, height: number): PdfPageMetadata['orientation'] {
  if (Math.abs(width - height) < 0.01) {
    return 'square'
  }

  return width > height ? 'landscape' : 'portrait'
}

function toPdfWatermarkError(error: unknown, operation: 'load' | 'generate') {
  if (error instanceof PdfWatermarkError) {
    return error
  }

  if (
    error instanceof EncryptedPDFError ||
    (error instanceof Error && /encrypted|password/i.test(error.message))
  ) {
    return new PdfWatermarkError(
      'Password-protected or encrypted PDFs are not supported. Remove the password before uploading a copy.',
      'encrypted',
    )
  }

  if (
    error instanceof RangeError ||
    (error instanceof Error && /memory|allocation|array buffer/i.test(error.message))
  ) {
    return new PdfWatermarkError(
      'This PDF is too complex for the available browser memory. Try a smaller document.',
      'memory',
    )
  }

  if (error instanceof Error && /winansi cannot encode/i.test(error.message)) {
    return new PdfWatermarkError(
      'The watermark contains characters unsupported by the built-in PDF font. Use standard Latin characters for this PDF.',
      'text',
    )
  }

  return new PdfWatermarkError(
    operation === 'load'
      ? 'The PDF is invalid, corrupted, or could not be parsed.'
      : 'The watermarked PDF could not be generated in this browser.',
    operation === 'load' ? 'invalid' : 'generation',
  )
}

export function getPdfWatermarkErrorMessage(error: unknown, fallback: string) {
  return error instanceof PdfWatermarkError ? error.message : fallback
}

function hasPdfHeader(bytes: Uint8Array) {
  const headerLength = Math.min(bytes.length, 1024)
  let header = ''

  for (let index = 0; index < headerLength; index += 1) {
    header += String.fromCharCode(bytes[index])
  }

  return header.includes('%PDF-')
}

export async function inspectPdfBytes(bytes: Uint8Array) {
  if (!bytes.length || !hasPdfHeader(bytes)) {
    throw new PdfWatermarkError('The selected file is not a valid PDF document.', 'invalid')
  }

  try {
    const pdfDocument = await PDFDocument.load(bytes, { updateMetadata: false })
    const pages = pdfDocument.getPages()

    if (!pages.length) {
      throw new PdfWatermarkError('The PDF does not contain any pages.', 'invalid')
    }

    return pages.map<PdfPageMetadata>((page, index) => {
      const pageSize = getVisualPageSize(page)

      return {
        pageNumber: index + 1,
        width: pageSize.width,
        height: pageSize.height,
        orientation: getOrientation(pageSize.width, pageSize.height),
        rotationDegrees: pageSize.rotationDegrees,
      }
    })
  } catch (error) {
    throw toPdfWatermarkError(error, 'load')
  }
}

export async function loadPrivatePdfSource(
  signedUrl: string,
): Promise<PrivatePdfSource> {
  let response: Response

  try {
    response = await fetch(signedUrl, { credentials: 'omit' })
  } catch (error) {
    console.error('[pdf-watermark] private PDF fetch failed', error)
    throw new PdfWatermarkError(
      'The private PDF could not be downloaded. Check your connection and try again.',
      'access',
    )
  }

  if (!response.ok) {
    throw new PdfWatermarkError(
      'The private PDF is unavailable or the temporary access expired.',
      'access',
    )
  }

  let bytes: Uint8Array

  try {
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    console.error('[pdf-watermark] reading PDF response failed', error)
    throw toPdfWatermarkError(error, 'load')
  }

  return createPdfWatermarkSource(bytes)
}

export async function createPdfWatermarkSource(bytes: Uint8Array) {
  const pages = await inspectPdfBytes(bytes)
  return { bytes, pageCount: pages.length, pages }
}

export async function loadPdfWatermarkSourceBlob(blob: Blob) {
  if (blob.type && blob.type !== 'application/pdf') {
    throw new PdfWatermarkError('The temporary converted file is not a PDF.', 'invalid')
  }

  return createPdfWatermarkSource(new Uint8Array(await blob.arrayBuffer()))
}

function normalizeWatermarkLines(text: string) {
  const normalizedText = text.replace(/\r\n?/g, '\n').trim()

  if (!normalizedText) {
    throw new PdfWatermarkError('Watermark text cannot be empty.', 'text')
  }

  if (normalizedText.length > MAX_WATERMARK_TEXT_LENGTH) {
    throw new PdfWatermarkError(
      `Watermark text must be ${MAX_WATERMARK_TEXT_LENGTH} characters or fewer.`,
      'text',
    )
  }

  const lines = normalizedText.split('\n').map((line) => line.trim())

  if (lines.length > MAX_WATERMARK_LINES) {
    throw new PdfWatermarkError(
      `Watermark text can contain at most ${MAX_WATERMARK_LINES} lines.`,
      'text',
    )
  }

  return lines
}

function isPurposeText(lines: string[], settings: WatermarkSettings) {
  return (
    settings.textStyle === 'purpose' &&
    lines.length === 3 &&
    lines[0]?.toLocaleUpperCase() === 'ONLY FOR' &&
    Boolean(lines[1]) &&
    /^\d{2}\s+[A-Z]{3}\s+\d{4}$/i.test(lines[2] ?? '')
  )
}

function getFont(fonts: PdfFontSet, weight: PdfWatermarkLineSpec['fontWeight']) {
  return weight === 'bold' ? fonts.bold : fonts.regular
}

function measureTextWithSpacing(
  font: PDFFont,
  text: string,
  fontSize: number,
  letterSpacing: number,
) {
  const characters = Array.from(text)
  return (
    font.widthOfTextAtSize(text, fontSize) +
    Math.max(0, characters.length - 1) * letterSpacing
  )
}

function createLineSpecs(
  lines: string[],
  width: number,
  primaryFontSize: number,
  hierarchical: boolean,
  fonts: PdfFontSet,
): PdfWatermarkLineSpec[] {
  if (!hierarchical) {
    return lines.map((text) => ({
      text,
      role: 'custom',
      sizeRatio: 1,
      fontWeight: 'regular',
      letterSpacingRatio: 0,
    }))
  }

  const recipientLines = wrapWatermarkText({
    text: lines[1] ?? '',
    maximumWidth:
      (width * WATERMARK_VISUAL_LAYOUT.purposeRecipientMaxWidthRatio) /
      PDF_RECIPIENT_WRAP_MINIMUM_FIT_SCALE,
    measureText: (text) => fonts.bold.widthOfTextAtSize(text, primaryFontSize),
  })

  return [
    {
      text: lines[0] ?? '',
      role: 'eyebrow',
      sizeRatio: WATERMARK_VISUAL_LAYOUT.purposeEyebrowSizeRatio,
      fontWeight: 'regular',
      letterSpacingRatio: 0.12,
    },
    ...recipientLines.map((text) => ({
      text,
      role: 'primary' as const,
      sizeRatio: 1,
      fontWeight: 'bold' as const,
      letterSpacingRatio: 0,
    })),
    {
      text: lines[2] ?? '',
      role: 'secondary',
      sizeRatio: WATERMARK_VISUAL_LAYOUT.purposeDateSizeRatio,
      fontWeight: 'regular',
      letterSpacingRatio: 0.055,
    },
  ]
}

function getLineGap(
  current: PdfWatermarkLineSpec,
  next: PdfWatermarkLineSpec,
  primaryFontSize: number,
  hierarchical: boolean,
) {
  if (!hierarchical) {
    return primaryFontSize * WATERMARK_VISUAL_LAYOUT.customLineGapRatio
  }

  if (current.role === 'eyebrow') {
    return primaryFontSize * WATERMARK_VISUAL_LAYOUT.eyebrowGapRatio
  }

  if (current.role === 'primary' && next.role === 'primary') {
    return primaryFontSize * WATERMARK_VISUAL_LAYOUT.primaryLineGapRatio
  }

  if (current.role === 'primary' && next.role === 'secondary') {
    return primaryFontSize * WATERMARK_VISUAL_LAYOUT.primaryToSecondaryGapRatio
  }

  return primaryFontSize * 0.2
}

function measureLineLayout(
  specs: PdfWatermarkLineSpec[],
  primaryFontSize: number,
  hierarchical: boolean,
  fonts: PdfFontSet,
) {
  const lines = specs.map<PdfWatermarkLineLayout>((spec) => {
    const fontSize = primaryFontSize * spec.sizeRatio
    const letterSpacing = fontSize * spec.letterSpacingRatio
    const font = getFont(fonts, spec.fontWeight)

    return {
      text: spec.text,
      role: spec.role,
      fontSize,
      fontWeight: spec.fontWeight,
      letterSpacing,
      width: measureTextWithSpacing(
        font,
        spec.text,
        fontSize,
        letterSpacing,
      ),
      y: 0,
    }
  })
  const gaps = lines.slice(0, -1).map((_, index) =>
    getLineGap(specs[index], specs[index + 1], primaryFontSize, hierarchical),
  )
  const contentHeight =
    lines.reduce((total, line) => total + line.fontSize, 0) +
    gaps.reduce((total, gap) => total + gap, 0)
  let cursorY = contentHeight / 2

  lines.forEach((line, index) => {
    line.y = cursorY - line.fontSize / 2
    cursorY -= line.fontSize + (gaps[index] ?? 0)
  })

  return {
    lines,
    contentWidth: Math.max(...lines.map((line) => line.width), 1),
    contentHeight,
  }
}

function measureRotatedBounds(
  width: number,
  height: number,
  rotationRadians: number,
  padding: number,
) {
  const paddedWidth = width + padding
  const paddedHeight = height + padding
  const cosine = Math.abs(Math.cos(rotationRadians))
  const sine = Math.abs(Math.sin(rotationRadians))

  return {
    width: paddedWidth * cosine + paddedHeight * sine,
    height: paddedWidth * sine + paddedHeight * cosine,
  }
}

function getLayoutCenter(
  width: number,
  height: number,
  boundingWidth: number,
  boundingHeight: number,
  safeMargin: number,
  position: WatermarkSettings['position'],
) {
  const minimumX = safeMargin + boundingWidth / 2
  const maximumX = width - safeMargin - boundingWidth / 2
  const minimumY = safeMargin + boundingHeight / 2
  const maximumY = height - safeMargin - boundingHeight / 2
  let x = width / 2
  let y = height / 2

  if (position.endsWith('-left')) {
    x = minimumX
  } else if (position.endsWith('-right')) {
    x = maximumX
  }

  if (position.startsWith('top-')) {
    y = maximumY
  } else if (position.startsWith('bottom-')) {
    y = minimumY
  }

  return {
    x: clamp(x, minimumX, maximumX),
    y: clamp(y, minimumY, maximumY),
  }
}

export function calculatePdfPageWatermarkLayout(
  pageWidth: number,
  pageHeight: number,
  settings: WatermarkSettings,
  fonts: PdfFontSet,
): PdfPageWatermarkLayout {
  const normalizedLines = normalizeWatermarkLines(settings.text)
  const hierarchical = isPurposeText(normalizedLines, settings)
  const shorterEdge = Math.min(pageWidth, pageHeight)
  const requestedRatio = clamp(
    settings.fontSizeRatio,
    MIN_FONT_SIZE_RATIO,
    MAX_FONT_SIZE_RATIO,
  )
  let fontSize = Math.max(1, shorterEdge * requestedRatio)
  const rotationDegrees = clamp(
    settings.rotationDegrees,
    MIN_WATERMARK_ROTATION,
    MAX_WATERMARK_ROTATION,
  )
  const rotationRadians = (rotationDegrees * Math.PI) / 180
  const safeMargin = calculateWatermarkSafeMargin(pageWidth, pageHeight)
  const availableWidth = Math.max(1, pageWidth - safeMargin * 2)
  const availableHeight = Math.max(1, pageHeight - safeMargin * 2)
  const maximumWidth = Math.min(
    availableWidth,
    pageWidth *
      (hierarchical
        ? WATERMARK_VISUAL_LAYOUT.purposeMaxRotatedWidthRatio
        : WATERMARK_VISUAL_LAYOUT.customMaxRotatedWidthRatio),
  )
  const maximumHeight = Math.min(
    availableHeight,
    pageHeight *
      (hierarchical
        ? WATERMARK_VISUAL_LAYOUT.purposeMaxRotatedHeightRatio
        : WATERMARK_VISUAL_LAYOUT.customMaxRotatedHeightRatio),
  )
  const maximumRecipientWidth =
    pageWidth * WATERMARK_VISUAL_LAYOUT.purposeRecipientMaxWidthRatio
  const specs = createLineSpecs(
    normalizedLines,
    pageWidth,
    fontSize,
    hierarchical,
    fonts,
  )
  let measured = measureLineLayout(specs, fontSize, hierarchical, fonts)
  let boundPadding = Math.max(0.5, fontSize * PDF_BOUND_PADDING_RATIO)
  let bounds = measureRotatedBounds(
    measured.contentWidth,
    measured.contentHeight,
    rotationRadians,
    boundPadding,
  )

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const fitScale = Math.min(
      1,
      maximumWidth / Math.max(bounds.width, 1),
      maximumHeight / Math.max(bounds.height, 1),
      hierarchical
        ? maximumRecipientWidth /
            Math.max(
              ...measured.lines
                .filter((line) => line.role === 'primary')
                .map((line) => line.width),
              1,
            )
        : 1,
    )

    if (fitScale >= 0.999) {
      break
    }

    fontSize = Math.max(0.5, fontSize * fitScale)
    measured = measureLineLayout(specs, fontSize, hierarchical, fonts)
    boundPadding = Math.max(0.5, fontSize * PDF_BOUND_PADDING_RATIO)
    bounds = measureRotatedBounds(
      measured.contentWidth,
      measured.contentHeight,
      rotationRadians,
      boundPadding,
    )
  }

  const center = getLayoutCenter(
    pageWidth,
    pageHeight,
    bounds.width,
    bounds.height,
    safeMargin,
    settings.position,
  )

  return {
    pageWidth,
    pageHeight,
    lines: measured.lines,
    fontSize,
    isHierarchical: hierarchical,
    x: center.x,
    y: center.y,
    rotationDegrees,
    contentWidth: measured.contentWidth,
    contentHeight: measured.contentHeight,
    boundingWidth: bounds.width,
    boundingHeight: bounds.height,
    safeMargin,
  }
}

function rotatePoint(x: number, y: number, rotationRadians: number) {
  return {
    x: x * Math.cos(rotationRadians) - y * Math.sin(rotationRadians),
    y: x * Math.sin(rotationRadians) + y * Math.cos(rotationRadians),
  }
}

function visualPointToRawPage(
  x: number,
  y: number,
  rawWidth: number,
  rawHeight: number,
  pageRotation: number,
) {
  if (pageRotation === 90) {
    return { x: rawWidth - y, y: x }
  }

  if (pageRotation === 180) {
    return { x: rawWidth - x, y: rawHeight - y }
  }

  if (pageRotation === 270) {
    return { x: y, y: rawHeight - x }
  }

  return { x, y }
}

function drawPdfLine(
  page: PDFPage,
  line: PdfWatermarkLineLayout,
  layout: PdfPageWatermarkLayout,
  settings: WatermarkSettings,
  fonts: PdfFontSet,
  rawWidth: number,
  rawHeight: number,
  pageRotation: number,
) {
  const font = line.fontWeight === 'bold' ? fonts.bold : fonts.regular
  const rotationRadians = (layout.rotationDegrees * Math.PI) / 180
  const drawText = (text: string, localX: number) => {
    const localOrigin = rotatePoint(
      localX,
      line.y - line.fontSize * 0.28,
      rotationRadians,
    )
    const visualOrigin = {
      x: layout.x + localOrigin.x,
      y: layout.y + localOrigin.y,
    }
    const rawOrigin = visualPointToRawPage(
      visualOrigin.x,
      visualOrigin.y,
      rawWidth,
      rawHeight,
      pageRotation,
    )

    page.drawText(text, {
      x: rawOrigin.x,
      y: rawOrigin.y,
      size: line.fontSize,
      font,
      color: PDF_INDIGO,
      opacity: clamp(
        settings.opacity,
        MIN_WATERMARK_OPACITY,
        MAX_WATERMARK_OPACITY,
      ),
      rotate: degrees(layout.rotationDegrees + pageRotation),
      blendMode: BlendMode.Multiply,
    })
  }

  if (line.letterSpacing <= 0 || line.text.length < 2) {
    drawText(line.text, -line.width / 2)
    return
  }

  let cursorX = -line.width / 2

  Array.from(line.text).forEach((character) => {
    drawText(character, cursorX)
    cursorX += font.widthOfTextAtSize(character, line.fontSize) + line.letterSpacing
  })
}

export async function generateWatermarkedPdf(
  sourceBytes: Uint8Array,
  settings: WatermarkSettings,
): Promise<GeneratedPdfResult> {
  try {
    const pdfDocument = await PDFDocument.load(sourceBytes, {
      updateMetadata: false,
    })
    const fonts: PdfFontSet = {
      regular: await pdfDocument.embedFont(StandardFonts.Helvetica),
      bold: await pdfDocument.embedFont(StandardFonts.HelveticaBold),
    }
    const pages = pdfDocument.getPages()
    const layouts: PdfPageWatermarkLayout[] = []

    if (!pages.length) {
      throw new PdfWatermarkError('The PDF does not contain any pages.', 'invalid')
    }

    pages.forEach((page) => {
      const pageSize = getVisualPageSize(page)
      const layout = calculatePdfPageWatermarkLayout(
        pageSize.width,
        pageSize.height,
        settings,
        fonts,
      )

      layout.lines.forEach((line) => {
        drawPdfLine(
          page,
          line,
          layout,
          settings,
          fonts,
          pageSize.rawWidth,
          pageSize.rawHeight,
          pageSize.rotationDegrees,
        )
      })
      layouts.push(layout)
    })

    return {
      bytes: await pdfDocument.save(),
      processedPageCount: pages.length,
      layouts,
    }
  } catch (error) {
    throw toPdfWatermarkError(error, 'generate')
  }
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  try {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.style.display = 'none'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  } catch (error) {
    console.error('[pdf-watermark] PDF download failed', error)
    throw new PdfWatermarkError(
      'The generated PDF could not be downloaded by this browser.',
      'export',
    )
  }
}
