import type { ComposerItem } from './composer'

export type ConversionMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'application/pdf'

export type ConversionExtension = 'png' | 'jpg' | 'pdf'

export interface ConversionArtifact {
  blob: Blob
  mimeType: ConversionMimeType
  extension: ConversionExtension
  /** Composer items represented by this artifact, in output order. */
  itemIds: string[]
}

export interface ConversionResult {
  artifacts: ConversionArtifact[]
}

export type ConversionProgressStage =
  | 'loading-source'
  | 'decoding'
  | 'rendering'
  | 'encoding'
  | 'assembling'
  | 'finalizing'

export interface ConversionProgress {
  completed: number
  total: number
  stage: ConversionProgressStage
}

export type ConversionSourceResolver = (
  sourceFileId: string,
  signal: AbortSignal,
) => Promise<Blob>

export interface ConvertComposerSelectionOptions {
  items: ComposerItem[]
  target: ConversionMimeType
  sourceResolver: ConversionSourceResolver
  signal?: AbortSignal
  /** Progress callback failures are isolated and never fail conversion. */
  onProgress?: (progress: ConversionProgress) => void
}
