import type {
  WatermarkPurpose,
  WatermarkProgress,
  WatermarkResult,
  WatermarkSettings,
} from '../../types/watermark'
import type { WatermarkHandoffArtifact } from '../../types/watermarkHandoff'
import { buildWatermarkedFilename } from './watermarkConfig'

export type GeneratedImageWatermarkRenderer = (
  source: Blob,
  settings: WatermarkSettings,
  signal: AbortSignal,
) => Promise<Blob>

export class WatermarkOutputError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid-input' | 'cancelled' | 'generation-failed',
  ) {
    super(message)
    this.name = 'WatermarkOutputError'
  }
}

export function throwIfWatermarkCancelled(signal: AbortSignal) {
  if (signal.aborted) {
    throw new WatermarkOutputError('Watermark generation was cancelled.', 'cancelled')
  }
}

export function isWatermarkCancellation(error: unknown) {
  return (
    (error instanceof WatermarkOutputError && error.code === 'cancelled') ||
    (typeof error === 'object' &&
      error !== null &&
      Reflect.get(error, 'code') === 'cancelled') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export function buildWatermarkOutputFilenames(
  documentName: string,
  purpose: WatermarkPurpose,
  recipient: string,
  date: Date,
  count: number,
  extension: 'png' | 'pdf',
) {
  if (count < 1) {
    return []
  }

  const singleFilename = buildWatermarkedFilename(
    documentName,
    purpose,
    recipient,
    date,
    extension,
  )
  if (count === 1) {
    return [singleFilename]
  }

  const baseName = singleFilename.slice(0, -(extension.length + 1))
  const numberWidth = Math.max(3, String(count).length)
  return Array.from(
    { length: count },
    (_, index) =>
      `${baseName}_${String(index + 1).padStart(numberWidth, '0')}.${extension}`,
  )
}

export function buildWatermarkZipFilename(filename: string) {
  return filename.replace(/(?:_\d{3,})?\.[^.]+$/, '.zip')
}

export function createWatermarkResultSignature(
  sourceKey: string,
  settings: WatermarkSettings,
  purpose: WatermarkPurpose,
  recipient: string,
  sessionDate: Date,
) {
  return JSON.stringify({
    sourceKey,
    settings,
    purpose,
    recipient,
    sessionDate: sessionDate.toISOString(),
  })
}

export function isWatermarkResultCurrent(
  resultSignature: string | null,
  currentSignature: string,
) {
  return resultSignature === currentSignature
}

export async function watermarkGeneratedImageArtifacts({
  artifacts,
  filenames,
  settings,
  signal,
  render,
  onProgress,
}: {
  artifacts: readonly WatermarkHandoffArtifact[]
  filenames: string[]
  settings: WatermarkSettings
  signal: AbortSignal
  render: GeneratedImageWatermarkRenderer
  onProgress?: (progress: WatermarkProgress) => void
}): Promise<WatermarkResult> {
  if (
    !artifacts.length ||
    artifacts.length !== filenames.length ||
    artifacts.some(
      (artifact) =>
        artifact.mimeType !== 'image/png' && artifact.mimeType !== 'image/jpeg',
    )
  ) {
    throw new WatermarkOutputError(
      'This generated image batch is not valid for watermarking.',
      'invalid-input',
    )
  }

  const result: WatermarkResult = { artifacts: [] }
  const report = (completed: number) => {
    try {
      onProgress?.({ completed, total: artifacts.length })
    } catch {
      // Progress observers must not corrupt browser-local output.
    }
  }

  report(0)
  for (let index = 0; index < artifacts.length; index += 1) {
    throwIfWatermarkCancelled(signal)
    const blob = await render(artifacts[index].blob, settings, signal)
    throwIfWatermarkCancelled(signal)

    if (!blob.size || blob.type !== 'image/png') {
      throw new WatermarkOutputError(
        'A watermarked image could not be generated.',
        'generation-failed',
      )
    }

    result.artifacts.push({
      blob,
      mimeType: 'image/png',
      extension: 'png',
      filename: filenames[index],
    })
    report(index + 1)
  }

  return result
}
