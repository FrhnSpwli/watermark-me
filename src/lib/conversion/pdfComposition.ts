import {
  EncryptedPDFError,
  PDFDocument,
  type PDFImage,
} from 'pdf-lib'
import type { ComposerItem, ImageComposerItem } from '../../types/composer'
import type { ConversionProgressStage } from '../../types/conversion'
import { calculateImagePdfPageLayout } from './conversionLayout'
import {
  ConversionError,
  throwIfConversionCancelled,
} from './conversionError'

interface PdfCompositionOptions {
  items: ComposerItem[]
  signal: AbortSignal
  getSourceBlob: (sourceFileId: string, completed: number) => Promise<Blob>
  reportProgress: (stage: ConversionProgressStage, completed: number) => void
}

function isEncryptedPdfError(error: unknown) {
  return (
    error instanceof EncryptedPDFError ||
    (error instanceof Error && /encrypted|password/i.test(error.message))
  )
}

async function loadSourcePdf(blob: Blob) {
  try {
    return await PDFDocument.load(await blob.arrayBuffer(), {
      updateMetadata: false,
    })
  } catch (error) {
    throw new ConversionError(
      isEncryptedPdfError(error)
        ? 'Password-protected or encrypted PDFs cannot be converted.'
        : 'A selected PDF source is invalid or could not be parsed.',
      'pdf-load-failed',
      { cause: error },
    )
  }
}

function aspectRatiosMatch(
  firstWidth: number,
  firstHeight: number,
  secondWidth: number,
  secondHeight: number,
) {
  const firstRatio = firstWidth / firstHeight
  const secondRatio = secondWidth / secondHeight
  return Math.abs(firstRatio - secondRatio) / Math.max(firstRatio, secondRatio) < 0.01
}

async function embedSourceImage(
  outputPdf: PDFDocument,
  sourceBlob: Blob,
  item: ImageComposerItem,
  signal: AbortSignal,
): Promise<PDFImage> {
  if (item.mimeType !== 'image/jpeg' && item.mimeType !== 'image/png') {
    throw new ConversionError(
      'This image type cannot be composed into a PDF.',
      'unsupported-conversion',
    )
  }

  try {
    const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer())
    throwIfConversionCancelled(signal)
    let embeddedImage = item.mimeType === 'image/jpeg'
      ? await outputPdf.embedJpg(sourceBytes)
      : await outputPdf.embedPng(sourceBytes)

    // Most inputs can be embedded byte-for-byte. If browser-normalized Composer
    // dimensions reveal EXIF orientation, normalize only that image via Canvas.
    if (
      !aspectRatiosMatch(
        embeddedImage.width,
        embeddedImage.height,
        item.width,
        item.height,
      )
    ) {
      const { convertImageBlob } = await import('./imageConversion')
      const normalizedBlob = await convertImageBlob(
        sourceBlob,
        item.mimeType,
        signal,
      )
      const normalizedBytes = new Uint8Array(await normalizedBlob.arrayBuffer())
      embeddedImage = item.mimeType === 'image/jpeg'
        ? await outputPdf.embedJpg(normalizedBytes)
        : await outputPdf.embedPng(normalizedBytes)
    }

    return embeddedImage
  } catch (error) {
    if (error instanceof ConversionError) {
      throw error
    }

    throw new ConversionError(
      'A selected image could not be embedded into the PDF.',
      'image-decode-failed',
      { cause: error },
    )
  }
}

export async function composeItemsToPdf({
  items,
  signal,
  getSourceBlob,
  reportProgress,
}: PdfCompositionOptions) {
  const outputPdf = await PDFDocument.create()
  const sourcePdfCache = new Map<string, Promise<PDFDocument>>()
  const embeddedImageCache = new Map<string, Promise<PDFImage>>()

  const getSourcePdf = (
    sourceFileId: string,
    completed: number,
  ): Promise<PDFDocument> => {
    const cached = sourcePdfCache.get(sourceFileId)
    if (cached) {
      return cached
    }

    const loading = getSourceBlob(sourceFileId, completed).then(loadSourcePdf)
    sourcePdfCache.set(sourceFileId, loading)
    return loading
  }

  const getEmbeddedImage = (
    item: ImageComposerItem,
    completed: number,
  ): Promise<PDFImage> => {
    const cached = embeddedImageCache.get(item.sourceFileId)
    if (cached) {
      return cached
    }

    const embedding = getSourceBlob(item.sourceFileId, completed).then((blob) =>
      embedSourceImage(outputPdf, blob, item, signal),
    )
    embeddedImageCache.set(item.sourceFileId, embedding)
    return embedding
  }

  for (let index = 0; index < items.length; index += 1) {
    throwIfConversionCancelled(signal)
    const item = items[index]

    if (item.kind === 'pdf-page') {
      const sourcePdf = await getSourcePdf(item.sourceFileId, index)
      const pageCount = sourcePdf.getPageCount()
      if (item.pageIndex < 0 || item.pageIndex >= pageCount) {
        throw new ConversionError(
          'A selected PDF page does not exist in its source document.',
          'pdf-page-invalid',
        )
      }

      reportProgress('assembling', index)
      const [copiedPage] = await outputPdf.copyPages(sourcePdf, [item.pageIndex])
      outputPdf.addPage(copiedPage)
    } else {
      reportProgress('decoding', index)
      const embeddedImage = await getEmbeddedImage(item, index)
      throwIfConversionCancelled(signal)
      const layout = calculateImagePdfPageLayout(item.width, item.height)
      const page = outputPdf.addPage([layout.pageWidth, layout.pageHeight])
      page.drawImage(embeddedImage, layout.image)
    }

    reportProgress('assembling', index + 1)
  }

  throwIfConversionCancelled(signal)
  reportProgress('finalizing', items.length)

  try {
    const bytes = await outputPdf.save()
    throwIfConversionCancelled(signal)
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  } catch (error) {
    if (error instanceof ConversionError) {
      throw error
    }

    throw new ConversionError(
      'The PDF output could not be finalized.',
      'output-generation-failed',
      { cause: error },
    )
  }
}
