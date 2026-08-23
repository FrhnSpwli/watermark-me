import type { ConversionSourceResolver } from '../types/conversion'
import { loadPrivateSourceBlob } from '../lib/composer/privateSource'
import { createDocumentAccessUrl } from './documents'

/**
 * Authenticated application seam for the persistence-agnostic conversion engine.
 * The signed URL is used immediately and is never returned or persisted.
 */
export function createPrivateDocumentSourceResolver(
  documentId: string,
): ConversionSourceResolver {
  return async (sourceFileId, signal) => {
    signal.throwIfAborted()
    const signedUrl = await createDocumentAccessUrl(documentId, sourceFileId)
    signal.throwIfAborted()
    return loadPrivateSourceBlob(signedUrl, signal)
  }
}
