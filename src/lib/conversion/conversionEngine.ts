import { getSelectedComposerItems } from '../composer/composerState'
import type {
  ComposerItem,
  ImageComposerItem,
  PdfPageComposerItem,
} from '../../types/composer'
import type {
  ConversionArtifact,
  ConversionMimeType,
  ConversionProgress,
  ConversionProgressStage,
  ConversionResult,
  ConvertComposerSelectionOptions,
} from '../../types/conversion'
import {
  ConversionError,
  normalizeConversionError,
  throwIfConversionCancelled,
} from './conversionError'

export type ConversionPlan =
  | { mode: 'compose-pdf'; items: ComposerItem[] }
  | { mode: 'convert-images'; items: ImageComposerItem[] }
  | { mode: 'rasterize-pdf-pages'; items: PdfPageComposerItem[] }

function isSupportedComposerItem(item: ComposerItem) {
  return item.kind === 'pdf-page'
    ? item.mimeType === 'application/pdf'
    : item.mimeType === 'image/jpeg' || item.mimeType === 'image/png'
}

export function getSelectedConversionItems(items: ComposerItem[]) {
  return getSelectedComposerItems(items)
}

export function createConversionPlan(
  items: ComposerItem[],
  target: ConversionMimeType,
): ConversionPlan {
  const selectedItems = getSelectedConversionItems(items)

  if (!selectedItems.length) {
    throw new ConversionError(
      'Select at least one Composer item before converting.',
      'empty-selection',
    )
  }

  if (!selectedItems.every(isSupportedComposerItem)) {
    throw new ConversionError(
      'The selection contains an unsupported source type.',
      'unsupported-conversion',
    )
  }

  if (target === 'application/pdf') {
    return { mode: 'compose-pdf', items: selectedItems }
  }

  if (selectedItems.every((item) => item.kind === 'pdf-page')) {
    return {
      mode: 'rasterize-pdf-pages',
      items: selectedItems as PdfPageComposerItem[],
    }
  }

  if (selectedItems.every((item) => item.kind === 'image-file')) {
    return {
      mode: 'convert-images',
      items: selectedItems as ImageComposerItem[],
    }
  }

  throw new ConversionError(
    'This selection cannot be converted to the requested image format.',
    'unsupported-conversion',
  )
}

function validateArtifacts(artifacts: ConversionArtifact[]) {
  if (!artifacts.length || artifacts.some((artifact) => !artifact.blob.size)) {
    throw new ConversionError(
      'The conversion produced an empty output.',
      'output-generation-failed',
    )
  }
}

export async function convertComposerSelection({
  items,
  target,
  sourceResolver,
  signal: providedSignal,
  imageConverter: providedImageConverter,
  onProgress,
}: ConvertComposerSelectionOptions): Promise<ConversionResult> {
  const signal = providedSignal ?? new AbortController().signal
  const plan = createConversionPlan(items, target)
  const total = plan.items.length
  const sourceCache = new Map<string, Promise<Blob>>()
  const reportProgress = (
    stage: ConversionProgressStage,
    completed: number,
  ) => {
    if (!onProgress) {
      return
    }

    const progress: ConversionProgress = { completed, total, stage }
    try {
      onProgress(progress)
    } catch {
      // Progress is observational. Consumer failures must not corrupt output.
    }
  }
  const getSourceBlob = (sourceFileId: string, completed: number) => {
    const cached = sourceCache.get(sourceFileId)
    if (cached) {
      return cached
    }

    reportProgress('loading-source', completed)
    const loading = Promise.resolve()
      .then(() => {
        throwIfConversionCancelled(signal)
        return sourceResolver(sourceFileId, signal)
      })
      .then((blob) => {
        throwIfConversionCancelled(signal)
        if (!blob.size) {
          throw new ConversionError(
            'A private source is empty or unavailable.',
            'source-unavailable',
          )
        }
        return blob
      })
      .catch((error: unknown) => {
        if (error instanceof ConversionError) {
          throw error
        }

        throwIfConversionCancelled(signal)
        throw new ConversionError(
          'A private source could not be loaded for conversion.',
          'source-unavailable',
          { cause: error },
        )
      })
    sourceCache.set(sourceFileId, loading)
    return loading
  }

  try {
    throwIfConversionCancelled(signal)
    let artifacts: ConversionArtifact[]

    if (plan.mode === 'compose-pdf') {
      const { composeItemsToPdf } = await import('./pdfComposition')
      const blob = await composeItemsToPdf({
        items: plan.items,
        signal,
        getSourceBlob,
        reportProgress,
      })
      artifacts = [{
        blob,
        mimeType: 'application/pdf',
        extension: 'pdf',
        itemIds: plan.items.map((item) => item.id),
      }]
    } else if (plan.mode === 'rasterize-pdf-pages') {
      if (target === 'application/pdf') {
        throw new ConversionError(
          'PDF page rasterization requires an image target.',
          'unsupported-conversion',
        )
      }
      const { rasterizePdfPages } = await import('./pdfRasterization')
      artifacts = await rasterizePdfPages({
        items: plan.items,
        target,
        signal,
        getSourceBlob,
        reportProgress,
      })
    } else {
      if (target === 'application/pdf') {
        throw new ConversionError(
          'Image conversion requires an image target.',
          'unsupported-conversion',
        )
      }
      let convertImage = providedImageConverter
      if (!convertImage && plan.items.some((item) => item.mimeType !== target)) {
        const imageConversion = await import('./imageConversion')
        convertImage = imageConversion.convertImageBlob
      }

      artifacts = []
      for (let index = 0; index < plan.items.length; index += 1) {
        throwIfConversionCancelled(signal)
        const item = plan.items[index]
        const sourceBlob = await getSourceBlob(item.sourceFileId, index)
        throwIfConversionCancelled(signal)
        let blob = sourceBlob

        if (item.mimeType !== target) {
          if (!convertImage) {
            throw new ConversionError(
              'Image conversion is unavailable.',
              'output-generation-failed',
            )
          }
          reportProgress('decoding', index)
          blob = await convertImage(sourceBlob, target, signal)
          throwIfConversionCancelled(signal)
          reportProgress('encoding', index + 1)
        }

        artifacts.push({
          blob,
          mimeType: target,
          extension: target === 'image/png' ? 'png' : 'jpg',
          itemIds: [item.id],
        })
        reportProgress('finalizing', index + 1)
      }
    }

    throwIfConversionCancelled(signal)
    validateArtifacts(artifacts)
    return { artifacts }
  } catch (error) {
    throw normalizeConversionError(error)
  } finally {
    sourceCache.clear()
  }
}
