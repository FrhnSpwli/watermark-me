import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ComposerPdfPageMetadata } from '../../types/composer'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type PdfPreviewDocument = PDFDocumentProxy

export class PdfPreviewError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid' | 'render',
  ) {
    super(message)
    this.name = 'PdfPreviewError'
  }
}

function normalizeRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360
}

export async function loadPdfPreviewDocument(bytes: Uint8Array) {
  let loadingTask: PDFDocumentLoadingTask | null = null

  try {
    loadingTask = getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
    })
    const document = await loadingTask.promise
    loadingTask = null

    if (document.numPages < 1) {
      await document.destroy()
      throw new PdfPreviewError('The PDF does not contain any pages.', 'invalid')
    }

    return document
  } catch (error) {
    if (loadingTask) {
      await loadingTask.destroy()
    }

    if (error instanceof PdfPreviewError) {
      throw error
    }

    throw new PdfPreviewError(
      'The PDF is password-protected, corrupted, or could not be read.',
      'invalid',
    )
  }
}

export async function getPdfPreviewPageMetadata(
  document: PdfPreviewDocument,
): Promise<ComposerPdfPageMetadata[]> {
  const pages: ComposerPdfPageMetadata[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    try {
      const viewport = page.getViewport({ scale: 1 })
      pages.push({
        pageIndex: pageNumber - 1,
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        rotationDegrees: normalizeRotation(viewport.rotation),
      })
    } finally {
      page.cleanup()
    }
  }

  return pages
}

interface RenderPdfPageOptions {
  document: PdfPreviewDocument
  pageNumber: number
  canvas: HTMLCanvasElement
  cssWidth: number
  pixelRatio: number
  signal: AbortSignal
}

export async function renderPdfPage({
  document,
  pageNumber,
  canvas,
  cssWidth,
  pixelRatio,
  signal,
}: RenderPdfPageOptions) {
  let renderTask: RenderTask | null = null
  let page: PDFPageProxy | null = null
  const cancelRender = () => renderTask?.cancel()

  try {
    page = await document.getPage(pageNumber)

    if (signal.aborted) {
      return
    }

    const unscaledViewport = page.getViewport({ scale: 1 })
    const cssScale = cssWidth / unscaledViewport.width
    const viewport = page.getViewport({ scale: cssScale * pixelRatio })
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    canvas.style.width = `${Math.max(1, Math.floor(viewport.width / pixelRatio))}px`
    canvas.style.height = `${Math.max(1, Math.floor(viewport.height / pixelRatio))}px`
    renderTask = page.render({ canvas, viewport })
    signal.addEventListener('abort', cancelRender, { once: true })
    await renderTask.promise
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'RenderingCancelledException')) {
      return
    }

    throw new PdfPreviewError('This PDF page preview could not be rendered.', 'render')
  } finally {
    signal.removeEventListener('abort', cancelRender)
    page?.cleanup()
  }
}
