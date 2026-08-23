export type ConversionErrorCode =
  | 'empty-selection'
  | 'unsupported-conversion'
  | 'source-unavailable'
  | 'image-decode-failed'
  | 'image-encode-failed'
  | 'pdf-load-failed'
  | 'pdf-page-invalid'
  | 'pdf-render-failed'
  | 'conversion-cancelled'
  | 'output-generation-failed'

export class ConversionError extends Error {
  constructor(
    message: string,
    public readonly code: ConversionErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ConversionError'
  }
}

export function isAbortError(error: unknown) {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError')
  )
}

export function throwIfConversionCancelled(signal: AbortSignal) {
  if (signal.aborted) {
    throw new ConversionError(
      'The conversion was cancelled.',
      'conversion-cancelled',
    )
  }
}

export function normalizeConversionError(error: unknown) {
  if (error instanceof ConversionError) {
    return error
  }

  if (isAbortError(error)) {
    return new ConversionError(
      'The conversion was cancelled.',
      'conversion-cancelled',
      { cause: error },
    )
  }

  return new ConversionError(
    'The converted output could not be generated in this browser.',
    'output-generation-failed',
    { cause: error },
  )
}
