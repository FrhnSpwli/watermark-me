import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ComposerActivePreview } from '../components/composer/ComposerActivePreview'
import { ComposerConversionPanel } from '../components/composer/ComposerConversionPanel'
import { ComposerSelectedOrder } from '../components/composer/ComposerSelectedOrder'
import { ComposerSourceBrowser } from '../components/composer/ComposerSourceBrowser'
import { PageHeader } from '../components/ui/PageHeader'
import { RouteLoadingScreen } from '../components/ui/RouteLoadingScreen'
import { useComposerConversion } from '../hooks/useComposerConversion'
import {
  appendComposerItems,
  createComposerItems,
  getComposerReadiness,
  moveSelectedComposerItem,
  moveSelectedComposerItemByOffset,
  setComposerItemSelected,
} from '../lib/composer/composerState'
import type { PdfPreviewDocument } from '../lib/pdfPreview/pdfPreview'
import {
  createDocumentAccessUrl,
  getDocument,
  getDocumentErrorMessage,
} from '../services/documents'
import type {
  ComposerItem,
  ComposerSourceContent,
  ComposerSourceLoadStatus,
} from '../types/composer'
import type { DocumentFileRecord, DocumentRecord } from '../types/documents'

function sortSources(sources: DocumentFileRecord[]) {
  return [...sources].sort(
    (left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id),
  )
}

function getSourceLoadMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'This private source could not be prepared for the Composer.'
}

export function DocumentComposerPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const imageUrlResources = useRef(new Map<string, string>())
  const pdfDocumentResources = useRef(new Map<string, PdfPreviewDocument>())
  const [document, setDocument] = useState<DocumentRecord | null>(null)
  const [loadedDocumentId, setLoadedDocumentId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [items, setItems] = useState<ComposerItem[]>([])
  const [sourceStatuses, setSourceStatuses] = useState(
    new Map<string, ComposerSourceLoadStatus>(),
  )
  const [imageUrls, setImageUrls] = useState(new Map<string, string>())
  const [pdfDocuments, setPdfDocuments] = useState(
    new Map<string, PdfPreviewDocument>(),
  )
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  useEffect(() => {
    const requestedDocumentId = documentId ?? ''
    let isActive = true

    const releaseResources = () => {
      imageUrlResources.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
      imageUrlResources.current.clear()
      pdfDocumentResources.current.forEach((pdfDocument) => {
        void pdfDocument.destroy()
      })
      pdfDocumentResources.current.clear()
    }

    releaseResources()
    setDocument(null)
    setLoadError(null)
    setItems([])
    setImageUrls(new Map())
    setPdfDocuments(new Map())
    setActiveItemId(null)
    setLoadedDocumentId(null)

    async function loadComposer() {
      if (!requestedDocumentId) {
        throw new Error('This Composer link is invalid.')
      }

      const nextDocument = await getDocument(requestedDocumentId)
      const sources = sortSources(nextDocument.files ?? [])

      if (!isActive) {
        return
      }

      setDocument(nextDocument)
      setSourceStatuses(
        new Map(sources.map((source) => [source.id, { status: 'loading' as const }])),
      )
      setLoadedDocumentId(requestedDocumentId)

      for (const source of sources) {
        if (!isActive) {
          return
        }

        let pendingPdfDocument: PdfPreviewDocument | null = null

        try {
          const signedUrl = await createDocumentAccessUrl(nextDocument.id, source.id)
          let content: ComposerSourceContent

          if (source.mime_type === 'image/jpeg' || source.mime_type === 'image/png') {
            const { loadPrivateImagePreview } = await import(
              '../lib/composer/privateSource'
            )
            const preview = await loadPrivateImagePreview(signedUrl, source.mime_type)

            if (!isActive) {
              URL.revokeObjectURL(preview.objectUrl)
              return
            }

            imageUrlResources.current.set(source.id, preview.objectUrl)
            setImageUrls((current) => new Map(current).set(source.id, preview.objectUrl))
            content = {
              kind: 'image',
              source,
              width: preview.width,
              height: preview.height,
            }
          } else if (source.mime_type === 'application/pdf') {
            const { loadPrivatePdfBytes } = await import('../lib/composer/privateSource')
            const bytes = await loadPrivatePdfBytes(signedUrl)
            const { getPdfPreviewPageMetadata, loadPdfPreviewDocument } = await import(
              '../lib/pdfPreview/pdfPreview'
            )
            const pdfDocument = await loadPdfPreviewDocument(bytes)
            pendingPdfDocument = pdfDocument

            if (!isActive) {
              await pdfDocument.destroy()
              return
            }

            const pages = await getPdfPreviewPageMetadata(pdfDocument)

            if (!isActive) {
              await pdfDocument.destroy()
              return
            }

            pdfDocumentResources.current.set(source.id, pdfDocument)
            pendingPdfDocument = null
            setPdfDocuments((current) => new Map(current).set(source.id, pdfDocument))
            content = { kind: 'pdf', source, pages }
          } else {
            throw new Error('This source type is not supported by the Composer.')
          }

          const nextItems = createComposerItems([content])
          setItems((current) => appendComposerItems(current, nextItems))
          setActiveItemId((current) => current ?? nextItems[0]?.id ?? null)
          setSourceStatuses((current) =>
            new Map(current).set(source.id, { status: 'ready' }),
          )
        } catch (error) {
          if (pendingPdfDocument) {
            await pendingPdfDocument.destroy()
          }
          if (isActive) {
            setSourceStatuses((current) =>
              new Map(current).set(source.id, {
                status: 'error',
                message: getSourceLoadMessage(error),
              }),
            )
          }
        }
      }
    }

    void loadComposer().catch((error: unknown) => {
      if (isActive) {
        setLoadError(
          getDocumentErrorMessage(
            error,
            error instanceof Error
              ? error.message
              : 'This document is unavailable or could not be loaded.',
          ),
        )
        setLoadedDocumentId(requestedDocumentId)
      }
    })

    return () => {
      isActive = false
      releaseResources()
    }
  }, [documentId])

  const sources = useMemo(
    () => sortSources(document?.files ?? []),
    [document?.files],
  )
  const activeItem = items.find((item) => item.id === activeItemId) ?? null
  const readiness = getComposerReadiness(items)
  const loadingSourceCount = [...sourceStatuses.values()].filter(
    (status) => status.status === 'loading',
  ).length
  const failedSourceCount = [...sourceStatuses.values()].filter(
    (status) => status.status === 'error',
  ).length
  const sourcesReady = Boolean(document) && loadingSourceCount === 0
  const conversionController = useComposerConversion({
    documentId: document?.id ?? documentId ?? '',
    documentName: document?.name ?? 'WatermarkMe Output',
    items,
    sourcesReady,
  })

  if (loadedDocumentId !== (documentId ?? '')) {
    return <RouteLoadingScreen message="Loading Composer..." />
  }

  if (loadError || !document) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <PageHeader
          description={loadError ?? 'This document is not available.'}
          eyebrow="Document Composer"
          title="Composer unavailable"
        />
        <Link
          className="mt-8 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          to="/dashboard"
        >
          Back to documents
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-[96rem] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <Link
        className="inline-flex rounded-lg text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
        to={`/documents/${document.id}`}
      >
        &larr; Back to document details
      </Link>

      <div className="mt-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          description="Choose images and PDF pages, arrange one global order, then convert and download a browser-only result. Originals and source metadata stay unchanged."
          eyebrow="Phase 15 - conversion output"
          title={document.name}
        />
        <div
          className={`max-w-lg rounded-xl border px-4 py-3 text-sm leading-6 ${
            readiness.isReady
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
          role="status"
        >
          <p className="font-semibold">{readiness.message}</p>
          <p className="mt-1 text-xs">
            Selection and order stay local. Generated conversion files are not uploaded.
          </p>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800">
          This document has no persisted source metadata available to compose.
        </div>
      ) : (
        <>
          {loadingSourceCount > 0 ? (
            <p className="mt-6 text-sm text-slate-600" role="status">
              Preparing {loadingSourceCount} private {loadingSourceCount === 1 ? 'source' : 'sources'}...
            </p>
          ) : null}
          {failedSourceCount > 0 ? (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="alert">
              {failedSourceCount} {failedSourceCount === 1 ? 'source could' : 'sources could'} not be prepared. Other sources remain usable below.
            </p>
          ) : null}

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
            <div className="space-y-6">
              <ComposerActivePreview
                imageUrls={imageUrls}
                item={activeItem}
                pdfDocuments={pdfDocuments}
              />
              <ComposerSelectedOrder
                activeItemId={activeItemId}
                imageUrls={imageUrls}
                items={items}
                onActivate={setActiveItemId}
                onMoveByOffset={(itemId, offset) => {
                  conversionController.invalidate()
                  setItems((current) =>
                    moveSelectedComposerItemByOffset(current, itemId, offset),
                  )
                }}
                onMoveToItem={(itemId, targetItemId) => {
                  conversionController.invalidate()
                  setItems((current) =>
                    moveSelectedComposerItem(current, itemId, targetItemId),
                  )
                }}
                reorderingDisabled={conversionController.interactionLocked}
              />
            </div>
            <div className="space-y-6">
              <ComposerSourceBrowser
                activeItemId={activeItemId}
                imageUrls={imageUrls}
                items={items}
                onActivate={setActiveItemId}
                onSelect={(itemId, selected) => {
                  conversionController.invalidate()
                  setItems((current) =>
                    setComposerItemSelected(current, itemId, selected),
                  )
                }}
                pdfDocuments={pdfDocuments}
                selectionDisabled={conversionController.interactionLocked}
                sources={sources}
                sourceStatuses={sourceStatuses}
              />
              <ComposerConversionPanel
                controller={conversionController}
                sourcesReady={sourcesReady}
              />
            </div>
          </div>
        </>
      )}
    </section>
  )
}
