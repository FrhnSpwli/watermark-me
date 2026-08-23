import type { ConversionMimeType } from '../../types/conversion'
import {
  ConversionError,
  isAbortError,
  throwIfConversionCancelled,
} from './conversionError'

export const DEFAULT_JPEG_QUALITY = 0.9
export const JPEG_BACKGROUND_COLOR = '#ffffff'

type ImageOutputMimeType = Extract<
  ConversionMimeType,
  'image/png' | 'image/jpeg'
>

interface DecodedConversionImage {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

function getAbortReason() {
  return new ConversionError(
    'The conversion was cancelled.',
    'conversion-cancelled',
  )
}

async function decodeWithImageElement(
  blob: Blob,
  signal: AbortSignal,
): Promise<DecodedConversionImage> {
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'

  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        image.onload = null
        image.onerror = null
        signal.removeEventListener('abort', handleAbort)
      }
      const handleAbort = () => {
        cleanup()
        image.src = ''
        reject(getAbortReason())
      }

      image.onload = () => {
        cleanup()
        resolve()
      }
      image.onerror = () => {
        cleanup()
        reject(
          new ConversionError(
            'The source image could not be decoded.',
            'image-decode-failed',
          ),
        )
      }
      signal.addEventListener('abort', handleAbort, { once: true })
      if (signal.aborted) {
        handleAbort()
        return
      }
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  throwIfConversionCancelled(signal)

  if (!image.naturalWidth || !image.naturalHeight) {
    image.src = ''
    throw new ConversionError(
      'The source image has invalid dimensions.',
      'image-decode-failed',
    )
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

export async function decodeImageBlob(
  blob: Blob,
  signal: AbortSignal,
): Promise<DecodedConversionImage> {
  throwIfConversionCancelled(signal)

  if (!blob.size) {
    throw new ConversionError(
      'The source image is empty.',
      'image-decode-failed',
    )
  }

  if ('createImageBitmap' in globalThis) {
    try {
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: 'from-image',
      })
      if (signal.aborted) {
        bitmap.close()
        throwIfConversionCancelled(signal)
      }

      if (!bitmap.width || !bitmap.height) {
        bitmap.close()
        throw new ConversionError(
          'The source image has invalid dimensions.',
          'image-decode-failed',
        )
      }

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch (error) {
      if (error instanceof ConversionError || isAbortError(error)) {
        throw error
      }
    }
  }

  try {
    return await decodeWithImageElement(blob, signal)
  } catch (error) {
    if (error instanceof ConversionError) {
      throw error
    }

    throw new ConversionError(
      'The source image could not be decoded.',
      'image-decode-failed',
      { cause: error },
    )
  }
}

export function prepareImageCanvas(
  canvas: HTMLCanvasElement,
  image: Pick<DecodedConversionImage, 'source' | 'width' | 'height'>,
  target: ImageOutputMimeType,
) {
  const context = canvas.getContext('2d')
  if (!context) {
    throw new ConversionError(
      'Canvas image conversion is unavailable in this browser.',
      'image-encode-failed',
    )
  }

  canvas.width = image.width
  canvas.height = image.height
  context.clearRect(0, 0, image.width, image.height)

  if (target === 'image/jpeg') {
    context.fillStyle = JPEG_BACKGROUND_COLOR
    context.fillRect(0, 0, image.width, image.height)
  }

  context.drawImage(image.source, 0, 0, image.width, image.height)
}

export function encodeCanvasBlob(
  canvas: HTMLCanvasElement,
  target: ImageOutputMimeType,
  signal: AbortSignal,
) {
  throwIfConversionCancelled(signal)

  return new Promise<Blob>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      signal.removeEventListener('abort', handleAbort)
      callback()
    }
    const handleAbort = () => finish(() => reject(getAbortReason()))

    signal.addEventListener('abort', handleAbort, { once: true })
    canvas.toBlob(
      (blob) => {
        if (!blob || !blob.size) {
          finish(() =>
            reject(
              new ConversionError(
                'The converted image could not be encoded.',
                'image-encode-failed',
              ),
            ),
          )
          return
        }

        finish(() => resolve(blob))
      },
      target,
      target === 'image/jpeg' ? DEFAULT_JPEG_QUALITY : undefined,
    )
  })
}

export async function convertImageBlob(
  sourceBlob: Blob,
  target: ImageOutputMimeType,
  signal: AbortSignal,
) {
  const decodedImage = await decodeImageBlob(sourceBlob, signal)
  const canvas = document.createElement('canvas')

  try {
    prepareImageCanvas(canvas, decodedImage, target)
    return await encodeCanvasBlob(canvas, target, signal)
  } finally {
    decodedImage.dispose()
    canvas.width = 0
    canvas.height = 0
  }
}
