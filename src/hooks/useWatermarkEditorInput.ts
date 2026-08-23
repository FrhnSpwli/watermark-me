import { useEffect, useState } from 'react'
import { useWatermarkHandoff } from './useWatermarkHandoff'
import {
  createDocumentAccessUrl,
  getDocument,
  getDocumentErrorMessage,
  resolveDocumentWatermarkSource,
} from '../services/documents'
import type { DecodedSourceImage } from '../types/watermark'
import type { PrivatePdfSource } from '../lib/watermark/pdfWatermark'
import type {
  WatermarkHandoffArtifact,
  WatermarkHandoffEntry,
} from '../types/watermarkHandoff'

type LoadStage = 'document' | 'access' | 'image' | 'pdf'

export interface WatermarkDocumentContext {
  id: string
  name: string
}

export type WatermarkEditorInput =
  | {
      authority: 'persisted'
      kind: 'image'
      context: WatermarkDocumentContext
      sourceKey: string
    }
  | {
      authority: 'persisted'
      kind: 'pdf'
      context: WatermarkDocumentContext
      sourceKey: string
    }
  | {
      authority: 'generated'
      kind: 'image-batch'
      context: WatermarkDocumentContext
      sourceKey: string
      handoff: WatermarkHandoffEntry
      artifacts: readonly WatermarkHandoffArtifact[]
    }
  | {
      authority: 'generated'
      kind: 'pdf'
      context: WatermarkDocumentContext
      sourceKey: string
      handoff: WatermarkHandoffEntry
    }

export interface WatermarkInputError {
  code:
    | 'document-unavailable'
    | 'temporary-unavailable'
    | 'unsupported-handoff'
  message: string
}

function getLoadFailureMessage(stage: LoadStage) {
  if (stage === 'access') {
    return 'Private access to this document source could not be created.'
  }
  if (stage === 'image') {
    return 'The source image could not be loaded.'
  }
  if (stage === 'pdf') {
    return 'The source PDF could not be loaded.'
  }
  return 'This document is unavailable or could not be loaded.'
}

function getLoadMessage(stage: LoadStage, previewLoading: boolean) {
  if (previewLoading || stage === 'image') {
    return 'Loading source image...'
  }
  if (stage === 'access') {
    return 'Creating private access...'
  }
  if (stage === 'pdf') {
    return 'Preparing PDF...'
  }
  return 'Loading document...'
}

export function useWatermarkEditorInput({
  documentId,
  handoffId,
  reloadRevision,
}: {
  documentId: string
  handoffId: string | null
  reloadRevision: number
}) {
  const { resolveHandoff } = useWatermarkHandoff()
  const [input, setInput] = useState<WatermarkEditorInput | null>(null)
  const [sourceImage, setSourceImage] = useState<DecodedSourceImage | null>(null)
  const [pdfSource, setPdfSource] = useState<PrivatePdfSource | null>(null)
  const [error, setError] = useState<WatermarkInputError | null>(null)
  const [stage, setStage] = useState<LoadStage>('document')
  const [activeArtifactIndex, setActiveArtifactIndex] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    let isActive = true
    let persistedImage: DecodedSourceImage | null = null
    let failureStage: LoadStage = 'document'

    void (async () => {
      await Promise.resolve()
      if (!isActive) {
        return
      }
      setInput(null)
      setSourceImage(null)
      setPdfSource(null)
      setError(null)
      setStage('document')
      setActiveArtifactIndex(0)
      setPreviewLoading(false)

      try {
        if (!documentId) {
          throw new Error('This watermark link is invalid.')
        }

        if (handoffId) {
          const resolution = resolveHandoff(handoffId, documentId)
          if (resolution.status === 'missing') {
            if (isActive) {
              setError({
                code: 'temporary-unavailable',
                message:
                  'This converted file was temporary and is no longer available. Return to Composer and convert it again.',
              })
            }
            return
          }
          if (resolution.status === 'unsupported') {
            if (isActive) {
              setError({
                code: 'unsupported-handoff',
                message: resolution.message,
              })
            }
            return
          }

          const context = {
            id: resolution.handoff.documentId,
            name: resolution.handoff.documentName,
          }
          if (resolution.kind === 'generated-single-pdf') {
            setStage('pdf')
            const { loadPdfWatermarkSourceBlob } = await import(
              '../lib/watermark/pdfWatermark'
            )
            const nextPdf = await loadPdfWatermarkSourceBlob(
              resolution.handoff.artifacts[0].blob,
            )
            if (isActive) {
              setPdfSource(nextPdf)
              setInput({
                authority: 'generated',
                kind: 'pdf',
                context,
                sourceKey: `handoff:${resolution.handoff.id}`,
                handoff: resolution.handoff,
              })
            }
            return
          }

          if (isActive) {
            setInput({
              authority: 'generated',
              kind: 'image-batch',
              context,
              sourceKey: `handoff:${resolution.handoff.id}`,
              handoff: resolution.handoff,
              artifacts: resolution.handoff.artifacts,
            })
          }
          return
        }

        const document = await getDocument(documentId)
        const resolution = resolveDocumentWatermarkSource(document)
        if (resolution.status === 'multiple') {
          throw new Error(
            'This logical document has multiple source files. Compose it into one watermarkable output first.',
          )
        }
        if (resolution.status === 'missing') {
          throw new Error(
            'This document does not have source metadata available for watermarking.',
          )
        }
        if (resolution.status === 'unsupported') {
          throw new Error('This document type is not supported by the watermark editor.')
        }

        failureStage = 'access'
        if (isActive) setStage('access')
        const signedUrl = await createDocumentAccessUrl(document.id, resolution.source.id)
        const context = { id: document.id, name: document.name }

        if (resolution.kind === 'image') {
          failureStage = 'image'
          if (isActive) setStage('image')
          const { loadPrivateSourceImage } = await import(
            '../lib/watermark/imageWatermark'
          )
          persistedImage = await loadPrivateSourceImage(signedUrl)
          if (!isActive) {
            persistedImage.dispose()
            persistedImage = null
            return
          }
          setSourceImage(persistedImage)
          setInput({
            authority: 'persisted',
            kind: 'image',
            context,
            sourceKey: `persisted:${resolution.source.id}`,
          })
        } else {
          failureStage = 'pdf'
          if (isActive) setStage('pdf')
          const { loadPrivatePdfSource } = await import(
            '../lib/watermark/pdfWatermark'
          )
          const nextPdf = await loadPrivatePdfSource(signedUrl)
          if (isActive) {
            setPdfSource(nextPdf)
            setInput({
              authority: 'persisted',
              kind: 'pdf',
              context,
              sourceKey: `persisted:${resolution.source.id}`,
            })
          }
        }
      } catch (loadError) {
        if (isActive) {
          if (handoffId) {
            setError({
              code: 'unsupported-handoff',
              message:
                loadError instanceof Error
                  ? loadError.message
                  : 'This temporary converted file could not be prepared for watermarking.',
            })
            return
          }
          setError({
            code: 'document-unavailable',
            message: getDocumentErrorMessage(
              loadError,
              loadError instanceof Error
                ? loadError.message
                : getLoadFailureMessage(failureStage),
            ),
          })
        }
      }
    })()

    return () => {
      isActive = false
      persistedImage?.dispose()
    }
  }, [documentId, handoffId, reloadRevision, resolveHandoff])

  useEffect(() => {
    if (input?.authority !== 'generated' || input.kind !== 'image-batch') {
      return
    }

    const artifact = input.artifacts[activeArtifactIndex]
    let isActive = true
    let decodedImage: DecodedSourceImage | null = null
    void Promise.resolve().then(() => {
      if (isActive) {
        setPreviewLoading(true)
        setSourceImage(null)
        setStage('image')
      }
    })

    void import('../lib/watermark/imageWatermark')
      .then(({ loadSourceImageBlob }) => loadSourceImageBlob(artifact.blob))
      .then((image) => {
        decodedImage = image
        if (!isActive) {
          image.dispose()
          decodedImage = null
          return
        }
        setSourceImage(image)
        setPreviewLoading(false)
      })
      .catch((previewError: unknown) => {
        if (isActive) {
          setPreviewLoading(false)
          setError({
            code: 'unsupported-handoff',
            message:
              previewError instanceof Error
                ? previewError.message
                : 'This converted image could not be prepared for watermarking.',
          })
        }
      })

    return () => {
      isActive = false
      decodedImage?.dispose()
    }
  }, [activeArtifactIndex, input])

  const generatedImageArtifacts =
    input?.authority === 'generated' && input.kind === 'image-batch'
      ? input.artifacts
      : null

  return {
    input,
    sourceImage,
    pdfSource,
    error,
    isLoading: !input && !error,
    loadMessage: getLoadMessage(stage, previewLoading),
    previewLoading,
    activeArtifactIndex,
    setActiveArtifactIndex,
    generatedImageArtifacts,
  }
}
