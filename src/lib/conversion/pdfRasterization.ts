import type { PdfPageComposerItem } from '../../types/composer'
import type {
  ConversionArtifact,
  ConversionProgressStage,
} from '../../types/conversion'
import type { PdfPreviewDocument } from '../pdfPreview/pdfPreview'
import {
  ConversionError,
  throwIfConversionCancelled,
} from './conversionError'
import {
  encodeCanvasBlob,
  JPEG_BACKGROUND_COLOR,
} from './imageConversion'

export const DEFAULT_PDF_RASTER_SCALE = 2
export const MAX_PDF_RASTER_DIMENSION = 4096

type RasterTarget = 'image/png' | 'image/jpeg'

interface PdfRasterizationOptions {
  items: PdfPageComposerItem[]
  target: RasterTarget
  signal: AbortSignal
  getSourceBlob: (sourceFileId: string, completed: number) => Promise<Blob>
  reportProgress: (stage: ConversionProgressStage, completed: number) => void
}

export function calculatePdfRasterScale(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    throw new RangeError('PDF page dimensions must be positive.')
  }

  return Math.min(
    DEFAULT_PDF_RASTER_SCALE,
    MAX_PDF_RASTER_DIMENSION / Math.max(width, height),
  )
}

export async function rasterizePdfPages({
  items,
  target,
  signal,
  getSourceBlob,
  reportProgress,
}: PdfRasterizationOptions): Promise<ConversionArtifact[]> {
  const documentPromises = new Map<string, Promise<PdfPreviewDocument>>()
  const liveDocuments = new Set<PdfPreviewDocument>()

  const getPdfDocument = (
    sourceFileId: string,
    completed: number,
  ): Promise<PdfPreviewDocument> => {
    const cached = documentPromises.get(sourceFileId)
    if (cached) {
      return cached
    }

    const loading = getSourceBlob(sourceFileId, completed)
      .then(async (blob) => {
        reportProgress('decoding', completed)
        const { loadPdfPreviewDocument } = await import(
          '../pdfPreview/pdfPreview'
        )

        try {
          const pdfDocument = await loadPdfPreviewDocument(
            new Uint8Array(await blob.arrayBuffer()),
          )
          liveDocuments.add(pdfDocument)
          return pdfDocument
        } catch (error) {
          throw new ConversionError(
            'A selected PDF source is invalid or could not be rendered.',
            'pdf-load-failed',
            { cause: error },
          )
        }
      })
    documentPromises.set(sourceFileId, loading)
    return loading
  }

  const artifacts: ConversionArtifact[] = []

  try {
    for (let index = 0; index < items.length; index += 1) {
      throwIfConversionCancelled(signal)
      const item = items[index]
      const pdfDocument = await getPdfDocument(item.sourceFileId, index)

      if (item.pageIndex < 0 || item.pageIndex >= pdfDocument.numPages) {
        throw new ConversionError(
          'A selected PDF page does not exist in its source document.',
          'pdf-page-invalid',
        )
      }

      const canvas = document.createElement('canvas')
      try {
        reportProgress('rendering', index)
        const { renderPdfPage } = await import('../pdfPreview/pdfPreview')
        await renderPdfPage({
          document: pdfDocument,
          pageNumber: item.pageIndex + 1,
          canvas,
          cssWidth: item.width,
          pixelRatio: calculatePdfRasterScale(item.width, item.height),
          signal,
          background: target === 'image/jpeg' ? JPEG_BACKGROUND_COLOR : undefined,
        })
        throwIfConversionCancelled(signal)
        reportProgress('encoding', index)
        const blob = await encodeCanvasBlob(canvas, target, signal)
        artifacts.push({
          blob,
          mimeType: target,
          extension: target === 'image/png' ? 'png' : 'jpg',
          itemIds: [item.id],
        })
      } catch (error) {
        if (error instanceof ConversionError) {
          throw error
        }

        throw new ConversionError(
          'A selected PDF page could not be rendered as an image.',
          'pdf-render-failed',
          { cause: error },
        )
      } finally {
        canvas.width = 0
        canvas.height = 0
      }

      reportProgress('encoding', index + 1)
    }

    reportProgress('finalizing', items.length)
    return artifacts
  } finally {
    await Promise.allSettled(
      [...liveDocuments].map((pdfDocument) => pdfDocument.destroy()),
    )
    liveDocuments.clear()
  }
}
