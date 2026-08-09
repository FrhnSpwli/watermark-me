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
import { wrapWatermarkText } from './watermarkTextLayout'
import type {
  DecodedSourceImage,
  ImageWatermarkSettings,
} from '../../types/watermark'

const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png'])
const MAX_WATERMARK_LINES = 10

export type ImageWatermarkErrorCode =
  | 'unsupported'
  | 'access'
  | 'decode'
  | 'render'
  | 'validation'
  | 'export'

export class ImageWatermarkError extends Error {
  constructor(
    message: string,
    public readonly code: ImageWatermarkErrorCode,
  ) {
    super(message)
    this.name = 'ImageWatermarkError'
  }
}

interface TextMeasuringContext {
  font: string
  measureText: (text: string) => TextMetrics
}

export type WatermarkLineRole = 'eyebrow' | 'primary' | 'secondary' | 'custom'

export interface WatermarkLineLayout {
  text: string
  role: WatermarkLineRole
  fontSize: number
  fontWeight: number
  letterSpacing: number
  width: number
  y: number
}

export interface WatermarkLayout {
  lines: WatermarkLineLayout[]
  fontSize: number
  isHierarchical: boolean
  x: number
  y: number
  rotationRadians: number
  contentWidth: number
  contentHeight: number
  boundingWidth: number
  boundingHeight: number
  safeMargin: number
}

interface WatermarkLineSpec {
  text: string
  role: WatermarkLineRole
  sizeRatio: number
  fontWeight: number
  letterSpacingRatio: number
}

const SYSTEM_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
const TEXT_STROKE_RATIO = 0.032
const WATERMARK_FILL_COLOR = '#4f46e5'
const WATERMARK_STROKE_COLOR = '#ffffff'
const SAFE_MARGIN_RATIO = 0.05
const MIN_SAFE_MARGIN = 4
const MAX_SAFE_MARGIN = 160

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeWatermarkLines(text: string) {
  const normalizedText = text.replace(/\r\n?/g, '\n').trim()

  if (!normalizedText) {
    throw new ImageWatermarkError('Watermark text cannot be empty.', 'validation')
  }

  if (normalizedText.length > MAX_WATERMARK_TEXT_LENGTH) {
    throw new ImageWatermarkError(
      `Watermark text must be ${MAX_WATERMARK_TEXT_LENGTH} characters or fewer.`,
      'validation',
    )
  }

  const lines = normalizedText.split('\n').map((line) => line.trim())

  if (lines.length > MAX_WATERMARK_LINES) {
    throw new ImageWatermarkError(
      `Watermark text can contain at most ${MAX_WATERMARK_LINES} lines.`,
      'validation',
    )
  }

  return lines
}

function setContextFont(
  context: TextMeasuringContext,
  fontSize: number,
  fontWeight: number,
) {
  context.font = `${fontWeight} ${fontSize}px ${SYSTEM_FONT_STACK}`
}

function measureTextWithSpacing(
  context: TextMeasuringContext,
  text: string,
  letterSpacing: number,
) {
  const characters = Array.from(text)
  const spacingWidth = Math.max(0, characters.length - 1) * letterSpacing
  return context.measureText(text).width + spacingWidth
}

function isPurposeText(lines: string[], settings: ImageWatermarkSettings) {
  return (
    settings.textStyle === 'purpose' &&
    lines.length === 3 &&
    lines[0]?.toLocaleUpperCase() === 'ONLY FOR' &&
    Boolean(lines[1]) &&
    /^\d{2}\s+[A-Z]{3}\s+\d{4}$/i.test(lines[2] ?? '')
  )
}

export function wrapRecipientText(
  context: TextMeasuringContext,
  recipient: string,
  maximumWidth: number,
) {
  return wrapWatermarkText({
    text: recipient,
    maximumWidth,
    measureText: (text) => context.measureText(text).width,
  })
}

function getLineGap(
  current: WatermarkLineSpec,
  next: WatermarkLineSpec,
  primaryFontSize: number,
  isHierarchical: boolean,
) {
  if (!isHierarchical) {
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

function createLineSpecs(
  context: TextMeasuringContext,
  lines: string[],
  width: number,
  primaryFontSize: number,
  hierarchical: boolean,
): WatermarkLineSpec[] {
  if (!hierarchical) {
    return lines.map((text) => ({
      text,
      role: 'custom',
      sizeRatio: 1,
      fontWeight: 600,
      letterSpacingRatio: 0,
    }))
  }

  setContextFont(context, primaryFontSize, 700)
  const recipientLines = wrapRecipientText(
    context,
    lines[1] ?? '',
    width * WATERMARK_VISUAL_LAYOUT.purposeRecipientMaxWidthRatio,
  )

  return [
    {
      text: lines[0] ?? '',
      role: 'eyebrow',
      sizeRatio: WATERMARK_VISUAL_LAYOUT.purposeEyebrowSizeRatio,
      fontWeight: 600,
      letterSpacingRatio: 0.12,
    },
    ...recipientLines.map((text) => ({
      text,
      role: 'primary' as const,
      sizeRatio: 1,
      fontWeight: 700,
      letterSpacingRatio: 0,
    })),
    {
      text: lines[2] ?? '',
      role: 'secondary',
      sizeRatio: WATERMARK_VISUAL_LAYOUT.purposeDateSizeRatio,
      fontWeight: 600,
      letterSpacingRatio: 0.055,
    },
  ]
}

function measureLineLayout(
  context: TextMeasuringContext,
  specs: WatermarkLineSpec[],
  primaryFontSize: number,
  isHierarchical: boolean,
) {
  const lines = specs.map<WatermarkLineLayout>((spec) => {
    const fontSize = primaryFontSize * spec.sizeRatio
    const letterSpacing = fontSize * spec.letterSpacingRatio
    setContextFont(context, fontSize, spec.fontWeight)

    return {
      text: spec.text,
      role: spec.role,
      fontSize,
      fontWeight: spec.fontWeight,
      letterSpacing,
      width: measureTextWithSpacing(context, spec.text, letterSpacing),
      y: 0,
    }
  })
  const gaps = lines.slice(0, -1).map((_, index) =>
    getLineGap(specs[index], specs[index + 1], primaryFontSize, isHierarchical),
  )
  const contentHeight =
    lines.reduce((total, line) => total + line.fontSize, 0) +
    gaps.reduce((total, gap) => total + gap, 0)
  let cursorY = -contentHeight / 2

  lines.forEach((line, index) => {
    line.y = cursorY + line.fontSize / 2
    cursorY += line.fontSize + (gaps[index] ?? 0)
  })

  return {
    lines,
    contentWidth: Math.max(...lines.map((line) => line.width), 1),
    contentHeight,
  }
}

function measureRotatedBounds(
  textWidth: number,
  textHeight: number,
  rotationRadians: number,
  strokeWidth: number,
) {
  const outlinedWidth = textWidth + strokeWidth
  const outlinedHeight = textHeight + strokeWidth
  const cosine = Math.abs(Math.cos(rotationRadians))
  const sine = Math.abs(Math.sin(rotationRadians))

  return {
    width: outlinedWidth * cosine + outlinedHeight * sine,
    height: outlinedWidth * sine + outlinedHeight * cosine,
  }
}

export function calculateWatermarkSafeMargin(width: number, height: number) {
  const shorterEdge = Math.min(width, height)
  const responsiveMargin = clamp(
    shorterEdge * SAFE_MARGIN_RATIO,
    MIN_SAFE_MARGIN,
    MAX_SAFE_MARGIN,
  )

  return Math.min(responsiveMargin, width * 0.2, height * 0.2)
}

function getLayoutCenter(
  width: number,
  height: number,
  boundingWidth: number,
  boundingHeight: number,
  safeMargin: number,
  position: ImageWatermarkSettings['position'],
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
    y = minimumY
  } else if (position.startsWith('bottom-')) {
    y = maximumY
  }

  return {
    x: clamp(x, minimumX, maximumX),
    y: clamp(y, minimumY, maximumY),
  }
}

export function calculateWatermarkLayout(
  context: TextMeasuringContext,
  width: number,
  height: number,
  settings: ImageWatermarkSettings,
): WatermarkLayout {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ImageWatermarkError('The source image dimensions are invalid.', 'render')
  }

  const normalizedLines = normalizeWatermarkLines(settings.text)
  const hierarchical = isPurposeText(normalizedLines, settings)
  const shorterEdge = Math.min(width, height)
  const requestedRatio = clamp(
    settings.fontSizeRatio,
    MIN_FONT_SIZE_RATIO,
    MAX_FONT_SIZE_RATIO,
  )
  let fontSize = Math.max(6, shorterEdge * requestedRatio)
  const rotationDegrees = clamp(
    settings.rotationDegrees,
    MIN_WATERMARK_ROTATION,
    MAX_WATERMARK_ROTATION,
  )
  const rotationRadians = (rotationDegrees * Math.PI) / 180
  const safeMargin = calculateWatermarkSafeMargin(width, height)
  const availableWidth = Math.max(1, width - safeMargin * 2)
  const availableHeight = Math.max(1, height - safeMargin * 2)
  const maximumWidth =
    Math.min(
      availableWidth,
      width *
        (hierarchical
          ? WATERMARK_VISUAL_LAYOUT.purposeMaxRotatedWidthRatio
          : WATERMARK_VISUAL_LAYOUT.customMaxRotatedWidthRatio),
    )
  const maximumHeight =
    Math.min(
      availableHeight,
      height *
        (hierarchical
          ? WATERMARK_VISUAL_LAYOUT.purposeMaxRotatedHeightRatio
          : WATERMARK_VISUAL_LAYOUT.customMaxRotatedHeightRatio),
    )
  const specs = createLineSpecs(
    context,
    normalizedLines,
    width,
    fontSize,
    hierarchical,
  )
  let measured = measureLineLayout(context, specs, fontSize, hierarchical)
  let strokeWidth = Math.max(0.75, fontSize * TEXT_STROKE_RATIO)
  let bounds = measureRotatedBounds(
    measured.contentWidth,
    measured.contentHeight,
    rotationRadians,
    strokeWidth,
  )

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const fitScale = Math.min(
      1,
      maximumWidth / Math.max(bounds.width, 1),
      maximumHeight / Math.max(bounds.height, 1),
    )

    if (fitScale >= 0.999) {
      break
    }

    fontSize = Math.max(1, fontSize * fitScale)
    measured = measureLineLayout(context, specs, fontSize, hierarchical)
    strokeWidth = Math.max(0.75, fontSize * TEXT_STROKE_RATIO)
    bounds = measureRotatedBounds(
      measured.contentWidth,
      measured.contentHeight,
      rotationRadians,
      strokeWidth,
    )
  }

  const center = getLayoutCenter(
    width,
    height,
    bounds.width,
    bounds.height,
    safeMargin,
    settings.position,
  )

  return {
    lines: measured.lines,
    fontSize,
    isHierarchical: hierarchical,
    x: center.x,
    y: center.y,
    rotationRadians,
    contentWidth: measured.contentWidth,
    contentHeight: measured.contentHeight,
    boundingWidth: bounds.width,
    boundingHeight: bounds.height,
    safeMargin,
  }
}

function drawLineWithSpacing(
  context: CanvasRenderingContext2D,
  line: WatermarkLineLayout,
  strokeOpacity: number,
  fillOpacity: number,
) {
  setContextFont(context, line.fontSize, line.fontWeight)
  context.lineWidth = Math.max(0.75, line.fontSize * TEXT_STROKE_RATIO)

  const drawText = (text: string, x: number) => {
    context.globalAlpha = strokeOpacity
    context.strokeText(text, x, line.y)
    context.globalAlpha = fillOpacity
    context.fillText(text, x, line.y)
  }

  if (line.letterSpacing <= 0 || line.text.length < 2) {
    context.textAlign = 'center'
    drawText(line.text, 0)
    return
  }

  context.textAlign = 'left'
  let cursorX = -line.width / 2

  Array.from(line.text).forEach((character) => {
    drawText(character, cursorX)
    cursorX += context.measureText(character).width + line.letterSpacing
  })
}

export function renderImageWatermark(
  canvas: HTMLCanvasElement,
  image: DecodedSourceImage,
  settings: ImageWatermarkSettings,
) {
  const context = canvas.getContext('2d')

  if (!context) {
    throw new ImageWatermarkError('Canvas rendering is unavailable in this browser.', 'render')
  }

  canvas.width = image.width
  canvas.height = image.height
  context.clearRect(0, 0, image.width, image.height)
  context.drawImage(image.source, 0, 0, image.width, image.height)

  const layout = calculateWatermarkLayout(
    context,
    image.width,
    image.height,
    settings,
  )
  const opacity = clamp(
    settings.opacity,
    MIN_WATERMARK_OPACITY,
    MAX_WATERMARK_OPACITY,
  )

  context.save()
  context.translate(layout.x, layout.y)
  context.rotate(layout.rotationRadians)
  context.textBaseline = 'middle'
  context.lineJoin = 'round'
  context.strokeStyle = WATERMARK_STROKE_COLOR
  context.fillStyle = WATERMARK_FILL_COLOR

  const strokeOpacity = clamp(opacity * 0.82, 0.08, 0.82)

  layout.lines.forEach((line) => {
    drawLineWithSpacing(context, line, strokeOpacity, opacity)
  })

  context.restore()
  return layout
}

async function decodeWithImageElement(blob: Blob): Promise<DecodedSourceImage> {
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  image.src = objectUrl

  try {
    await image.decode()
  } catch (error) {
    console.error('[watermark] image element decode failed', error)
    throw new ImageWatermarkError('The source image could not be decoded.', 'decode')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    throw new ImageWatermarkError('The source image has invalid dimensions.', 'decode')
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => {
      image.src = ''
    },
  }
}

export async function loadPrivateSourceImage(
  signedUrl: string,
): Promise<DecodedSourceImage> {
  let response: Response

  try {
    response = await fetch(signedUrl, { credentials: 'omit' })
  } catch (error) {
    console.error('[watermark] private image fetch failed', error)
    throw new ImageWatermarkError(
      'The private source image could not be downloaded. Check your connection and try again.',
      'access',
    )
  }

  if (!response.ok) {
    throw new ImageWatermarkError(
      'The private source image is unavailable or the temporary access expired.',
      'access',
    )
  }

  const blob = await response.blob()

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(blob.type)) {
    throw new ImageWatermarkError('This file is not a supported JPEG or PNG image.', 'unsupported')
  }

  if ('createImageBitmap' in globalThis) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })

      if (!bitmap.width || !bitmap.height) {
        bitmap.close()
        throw new ImageWatermarkError('The source image has invalid dimensions.', 'decode')
      }

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch (error) {
      if (error instanceof ImageWatermarkError) {
        throw error
      }

      console.warn('[watermark] ImageBitmap decode unavailable, using image fallback', error)
    }
  }

  return decodeWithImageElement(blob)
}

export function exportCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new ImageWatermarkError('The PNG export could not be created.', 'export'))
        return
      }

      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      link.style.display = 'none'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      resolve()
    }, 'image/png')
  })
}
