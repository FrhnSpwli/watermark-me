import type {
  ConversionExtension,
  ConversionMimeType,
  ConversionResult,
} from './conversion'

export interface CreateWatermarkHandoffInput {
  documentId: string
  documentName: string
  result: ConversionResult
  filenames: string[]
}

export interface WatermarkHandoffArtifact {
  blob: Blob
  mimeType: ConversionMimeType
  extension: ConversionExtension
  filename: string
  itemIds: string[]
}

export interface WatermarkHandoffEntry {
  id: string
  ownerId: string
  documentId: string
  documentName: string
  artifacts: readonly WatermarkHandoffArtifact[]
  createdAt: number
}

export type WatermarkHandoffReadyKind =
  | 'generated-single-image'
  | 'generated-single-pdf'
  | 'generated-image-batch'

export type WatermarkHandoffResolution =
  | {
      status: 'ready'
      kind: WatermarkHandoffReadyKind
      handoff: WatermarkHandoffEntry
    }
  | { status: 'missing' }
  | { status: 'unsupported'; message: string }
