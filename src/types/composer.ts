import type { DocumentFileRecord } from './documents'

interface ComposerItemBase {
  id: string
  sourceFileId: string
  sourceName: string
  mimeType: string
  selected: boolean
  initialOrder: number
  composerOrder: number
}

export interface ImageComposerItem extends ComposerItemBase {
  kind: 'image-file'
  width: number
  height: number
}

export interface PdfPageComposerItem extends ComposerItemBase {
  kind: 'pdf-page'
  /** Zero-based page index used by browser-side PDF libraries. */
  pageIndex: number
  /** One-based page number shown to the user. */
  pageNumber: number
  width: number
  height: number
  rotationDegrees: number
}

export type ComposerItem = ImageComposerItem | PdfPageComposerItem

export interface ComposerPdfPageMetadata {
  pageIndex: number
  pageNumber: number
  width: number
  height: number
  rotationDegrees: number
}

export type ComposerSourceContent =
  | {
      kind: 'image'
      source: DocumentFileRecord
      width: number
      height: number
    }
  | {
      kind: 'pdf'
      source: DocumentFileRecord
      pages: ComposerPdfPageMetadata[]
    }

export type ComposerSourceLoadStatus =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string }
