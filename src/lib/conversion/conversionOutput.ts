import type { ComposerItem } from '../../types/composer'
import type {
  ConversionArtifact,
  ConversionMimeType,
  ConversionProgress,
} from '../../types/conversion'
import { createConversionPlan } from './conversionEngine'
import { ConversionError } from './conversionError'

const OUTPUT_TARGETS = [
  { target: 'application/pdf', label: 'PDF' },
  { target: 'image/png', label: 'PNG' },
  { target: 'image/jpeg', label: 'JPEG' },
] as const satisfies ReadonlyArray<{
  target: ConversionMimeType
  label: string
}>

const MAX_OUTPUT_BASENAME_LENGTH = 80
const FALLBACK_OUTPUT_BASENAME = 'WatermarkMe_Output'
const WINDOWS_RESERVED_BASENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export interface ConversionOutputOption {
  target: ConversionMimeType
  label: 'PDF' | 'PNG' | 'JPEG'
  artifactCount: number
  outputShape: 'single' | 'multiple'
  description: string
  warnings: string[]
}

function getWarnings(
  items: ComposerItem[],
  target: ConversionMimeType,
) {
  const selectedItems = items.filter((item) => item.selected)
  const containsPdfPages = selectedItems.some((item) => item.kind === 'pdf-page')
  const containsPng = selectedItems.some(
    (item) => item.kind === 'image-file' && item.mimeType === 'image/png',
  )

  if (target === 'image/jpeg') {
    if (containsPdfPages) {
      return [
        'Each selected PDF page will be rendered as a separate image.',
        'JPEG uses lossy compression and a white page background.',
      ]
    }

    if (containsPng) {
      return [
        'Transparent areas will be filled with white.',
        'JPEG uses lossy compression.',
      ]
    }
  }

  if (target === 'image/png' && containsPdfPages) {
    return ['Each selected PDF page will be rendered as a separate image.']
  }

  if (
    target === 'image/png' &&
    selectedItems.some(
      (item) => item.kind === 'image-file' && item.mimeType === 'image/jpeg',
    )
  ) {
    return [
      'Changing JPEG to PNG does not restore detail already lost through JPEG compression.',
    ]
  }

  return []
}

function getOutputDescription(
  target: ConversionMimeType,
  artifactCount: number,
) {
  if (target === 'application/pdf') {
    return 'One combined PDF file in the current Composer order.'
  }

  const label = target === 'image/png' ? 'PNG' : 'JPEG'
  return artifactCount === 1
    ? `One ${label} image file.`
    : `${artifactCount} ${label} image files, one per selected PDF page.`
}

export function getConversionOptions(
  items: ComposerItem[],
): ConversionOutputOption[] {
  return OUTPUT_TARGETS.flatMap<ConversionOutputOption>(({ target, label }) => {
    try {
      const plan = createConversionPlan(items, target)
      const artifactCount =
        plan.mode === 'rasterize-pdf-pages' ? plan.items.length : 1

      return [{
        target,
        label,
        artifactCount,
        outputShape: artifactCount === 1 ? 'single' : 'multiple',
        description: getOutputDescription(target, artifactCount),
        warnings: getWarnings(items, target),
      }]
    } catch (error) {
      if (
        error instanceof ConversionError &&
        (error.code === 'empty-selection' ||
          error.code === 'unsupported-conversion')
      ) {
        return []
      }
      throw error
    }
  })
}

export function getDefaultConversionTarget(
  items: ComposerItem[],
  options = getConversionOptions(items),
): ConversionMimeType | null {
  const selectedItems = items.filter((item) => item.selected)
  const onlyItem = selectedItems.length === 1 ? selectedItems[0] : null
  const preferredTarget =
    onlyItem?.kind === 'image-file'
      ? onlyItem.mimeType === 'image/jpeg'
        ? 'image/png'
        : onlyItem.mimeType === 'image/png'
          ? 'image/jpeg'
          : null
      : 'application/pdf'

  return (
    options.find((option) => option.target === preferredTarget)?.target ??
    options[0]?.target ??
    null
  )
}

export function createConversionInputKey(
  documentId: string,
  items: ComposerItem[],
  target: ConversionMimeType | null,
) {
  if (!target) {
    return null
  }

  return JSON.stringify({
    documentId,
    target,
    itemIds: items
      .filter((item) => item.selected)
      .sort((left, right) => left.composerOrder - right.composerOrder)
      .map((item) => item.id),
  })
}

export function isConversionInputCurrent(
  resultInputKey: string | null,
  currentInputKey: string | null,
) {
  return Boolean(resultInputKey && resultInputKey === currentInputKey)
}

export function sanitizeOutputBaseName(documentName: string) {
  const withoutKnownExtension = documentName
    .normalize('NFKC')
    .trim()
    .replace(/\.(?:jpe?g|png|pdf)$/i, '')
  const withoutControlCharacters = Array.from(withoutKnownExtension, (character) =>
    character.charCodeAt(0) < 32 ? '_' : character,
  ).join('')
  const sanitized = withoutControlCharacters
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, MAX_OUTPUT_BASENAME_LENGTH)
    .replace(/[._-]+$/g, '')

  if (!sanitized || WINDOWS_RESERVED_BASENAME.test(sanitized)) {
    return FALLBACK_OUTPUT_BASENAME
  }

  return sanitized
}

export function createArtifactFilenames(
  documentName: string,
  artifacts: ConversionArtifact[],
) {
  const baseName = sanitizeOutputBaseName(documentName)
  const numberWidth = Math.max(3, String(artifacts.length).length)

  return artifacts.map((artifact, index) => {
    const suffix =
      artifacts.length === 1
        ? ''
        : `_${String(index + 1).padStart(numberWidth, '0')}`
    return `${baseName}${suffix}.${artifact.extension}`
  })
}

export function createZipFilename(documentName: string) {
  return `${sanitizeOutputBaseName(documentName)}.zip`
}

export function getConversionErrorMessage(error: unknown) {
  if (!(error instanceof ConversionError)) {
    return 'The converted output could not be generated in this browser.'
  }

  const messages: Partial<Record<typeof error.code, string>> = {
    'empty-selection': 'Select at least one item before converting.',
    'unsupported-conversion':
      'This selection cannot be converted to the chosen format.',
    'source-unavailable':
      'One of the selected source files could not be loaded.',
    'image-decode-failed': 'A selected image could not be read.',
    'image-encode-failed': 'A converted image could not be generated.',
    'pdf-load-failed': 'A selected PDF could not be read.',
    'pdf-page-invalid': 'A selected PDF page is no longer available.',
    'pdf-render-failed': 'A selected PDF page could not be converted.',
    'output-generation-failed': 'The converted file could not be generated.',
  }

  return messages[error.code] ?? 'The converted output could not be generated.'
}

export function isConversionCancellation(error: unknown) {
  return error instanceof ConversionError && error.code === 'conversion-cancelled'
}

export function getConversionProgressMessage(progress: ConversionProgress) {
  const stageLabels: Record<ConversionProgress['stage'], string> = {
    'loading-source': 'Loading private source',
    decoding: 'Reading selected content',
    rendering: 'Rendering page',
    encoding: 'Encoding output',
    assembling: 'Assembling output',
    finalizing: 'Finalizing output',
  }
  const completed = Math.min(progress.completed, progress.total)

  return `${stageLabels[progress.stage]} — ${completed} of ${progress.total} items`
}
