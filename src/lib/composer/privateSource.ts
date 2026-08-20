const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png'])

export class ComposerSourceError extends Error {
  constructor(
    message: string,
    public readonly code: 'access' | 'image-decode' | 'pdf-read',
  ) {
    super(message)
    this.name = 'ComposerSourceError'
  }
}

async function fetchPrivateSource(signedUrl: string) {
  let response: Response

  try {
    response = await fetch(signedUrl, { credentials: 'omit' })
  } catch {
    throw new ComposerSourceError(
      'The private source could not be downloaded. Check your connection and try again.',
      'access',
    )
  }

  if (!response.ok) {
    throw new ComposerSourceError(
      'The private source is unavailable or its temporary access expired.',
      'access',
    )
  }

  return response
}

function decodeImage(objectUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      const dimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
      image.src = ''

      if (!dimensions.width || !dimensions.height) {
        reject(
          new ComposerSourceError(
            'The source image has invalid dimensions.',
            'image-decode',
          ),
        )
        return
      }

      resolve(dimensions)
    }
    image.onerror = () => {
      image.src = ''
      reject(
        new ComposerSourceError(
          'The source image could not be decoded in this browser.',
          'image-decode',
        ),
      )
    }
    image.src = objectUrl
  })
}

export async function loadPrivateImagePreview(
  signedUrl: string,
  expectedMimeType: string,
) {
  const response = await fetchPrivateSource(signedUrl)
  const responseBlob = await response.blob()
  const mimeType = SUPPORTED_IMAGE_MIME_TYPES.has(responseBlob.type)
    ? responseBlob.type
    : expectedMimeType

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new ComposerSourceError(
      'This source is not a supported JPEG or PNG image.',
      'image-decode',
    )
  }

  const blob = responseBlob.type === mimeType
    ? responseBlob
    : new Blob([responseBlob], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)

  try {
    const dimensions = await decodeImage(objectUrl)
    return { ...dimensions, objectUrl }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function loadPrivatePdfBytes(signedUrl: string) {
  const response = await fetchPrivateSource(signedUrl)

  try {
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    throw new ComposerSourceError(
      'The private PDF could not be read in this browser.',
      'pdf-read',
    )
  }
}
