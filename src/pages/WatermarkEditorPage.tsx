import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PdfWatermarkPreview } from '../components/watermark/PdfWatermarkPreview'
import { WatermarkControls } from '../components/watermark/WatermarkControls'
import { RouteLoadingScreen } from '../components/ui/RouteLoadingScreen'
import {
  exportCanvasAsPng,
  ImageWatermarkError,
  loadPrivateSourceImage,
  renderImageWatermark,
} from '../lib/watermark/imageWatermark'
import {
  buildWatermarkedFilename,
  DEFAULT_WATERMARK_SETTINGS,
} from '../lib/watermark/watermarkConfig'
import {
  changeWatermarkPurpose,
  changeWatermarkRecipient,
  changeWatermarkText,
  createWatermarkPurposeState,
  normalizePurposeRecipient,
  resetWatermarkText,
  validateWatermarkDownload,
} from '../lib/watermark/purposeExperience'
import {
  createDocumentAccessUrl,
  getDocument,
  getDocumentErrorMessage,
} from '../services/documents'
import type { DocumentRecord } from '../types/documents'
import type { PrivatePdfSource } from '../lib/watermark/pdfWatermark'
import type {
  DecodedSourceImage,
  WatermarkSettings,
  WatermarkPurpose,
} from '../types/watermark'

type LoadStage = 'document' | 'access' | 'image' | 'pdf'
type ExportStage = 'idle' | 'generating' | 'downloading'
type WatermarkAppearanceSettings = Pick<
  WatermarkSettings,
  'opacity' | 'rotationDegrees' | 'fontSizeRatio' | 'position'
>

interface RenderErrorState {
  signature: string
  message: string
}

function isSupportedImage(document: DocumentRecord) {
  return document.mime_type === 'image/jpeg' || document.mime_type === 'image/png'
}

function isSupportedPdf(document: DocumentRecord) {
  return document.mime_type === 'application/pdf'
}

function getLoadMessage(stage: LoadStage) {
  if (stage === 'access') {
    return 'Creating private access…'
  }

  if (stage === 'image') {
    return 'Loading source image…'
  }

  if (stage === 'pdf') {
    return 'Preparing PDF…'
  }

  return 'Loading document…'
}

function getWatermarkErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ImageWatermarkError) {
    return error.message
  }

  if (error instanceof Error && error.name === 'PdfWatermarkError') {
    return error.message
  }

  return getDocumentErrorMessage(error, fallback)
}

export function WatermarkEditorPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [reloadRevision, setReloadRevision] = useState(0)
  const [loadedDocumentId, setLoadedDocumentId] = useState<string | null>(null)
  const [loadStage, setLoadStage] = useState<LoadStage>('document')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [documentRecord, setDocumentRecord] = useState<DocumentRecord | null>(null)
  const [sourceImage, setSourceImage] = useState<DecodedSourceImage | null>(null)
  const [pdfSource, setPdfSource] = useState<PrivatePdfSource | null>(null)
  const [purposeState, setPurposeState] = useState(() =>
    createWatermarkPurposeState(new Date()),
  )
  const [appearance, setAppearance] = useState<WatermarkAppearanceSettings>(() => ({
    opacity: DEFAULT_WATERMARK_SETTINGS.opacity,
    rotationDegrees: DEFAULT_WATERMARK_SETTINGS.rotationDegrees,
    fontSizeRatio: DEFAULT_WATERMARK_SETTINGS.fontSizeRatio,
    position: DEFAULT_WATERMARK_SETTINGS.position,
  }))
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const [renderedSignature, setRenderedSignature] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<RenderErrorState | null>(null)
  const [exportStage, setExportStage] = useState<ExportStage>('idle')
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const isExporting = exportStage !== 'idle'
  const settings = useMemo<WatermarkSettings>(
    () => ({
      ...appearance,
      text: purposeState.text,
      textStyle: purposeState.textStyle,
    }),
    [appearance, purposeState.text, purposeState.textStyle],
  )
  const downloadReadiness = useMemo(
    () => validateWatermarkDownload(purposeState),
    [purposeState],
  )

  const renderSignature = useMemo(
    () =>
      JSON.stringify({
        documentId,
        reloadRevision,
        width: sourceImage?.width,
        height: sourceImage?.height,
        settings,
      }),
    [documentId, reloadRevision, settings, sourceImage?.height, sourceImage?.width],
  )

  useEffect(() => {
    const requestedDocumentId = documentId ?? ''
    let isActive = true
    let decodedImage: DecodedSourceImage | null = null

    void (async () => {
      try {
        const nextDocument = await getDocument(requestedDocumentId)

        if (!isSupportedImage(nextDocument) && !isSupportedPdf(nextDocument)) {
          throw new ImageWatermarkError(
            'This document type is not supported by the watermark editor.',
            'unsupported',
          )
        }

        if (isActive) {
          setLoadStage('access')
        }

        const signedUrl = await createDocumentAccessUrl(nextDocument.id)

        if (isSupportedImage(nextDocument)) {
          if (isActive) {
            setLoadStage('image')
          }

          const nextImage = await loadPrivateSourceImage(signedUrl)
          decodedImage = nextImage

          if (!isActive) {
            nextImage.dispose()
            decodedImage = null
            return
          }

          setSourceImage(nextImage)
          setPdfSource(null)
        } else {
          if (isActive) {
            setLoadStage('pdf')
          }

          const { loadPrivatePdfSource } = await import(
            '../lib/watermark/pdfWatermark'
          )
          const nextPdfSource = await loadPrivatePdfSource(signedUrl)

          if (!isActive) {
            return
          }

          setSourceImage(null)
          setPdfSource(nextPdfSource)
        }

        setDocumentRecord(nextDocument)
        setLoadError(null)
        setLoadedDocumentId(requestedDocumentId)
      } catch (error: unknown) {
        if (isActive) {
          setDocumentRecord(null)
          setSourceImage(null)
          setPdfSource(null)
          setLoadError(
            getWatermarkErrorMessage(
              error,
              'This document is unavailable or could not be loaded.',
            ),
          )
          setLoadedDocumentId(requestedDocumentId)
        }
      }
    })()

    return () => {
      isActive = false
      decodedImage?.dispose()
    }
  }, [documentId, reloadRevision])

  useEffect(() => {
    if (!sourceImage || !canvasRef.current) {
      return
    }

    const canvas = canvasRef.current
    const frame = window.requestAnimationFrame(() => {
      try {
        renderImageWatermark(canvas, sourceImage, settings)
        setRenderError(null)
        setRenderedSignature(renderSignature)
      } catch (error) {
        setRenderError({
          signature: renderSignature,
          message: getWatermarkErrorMessage(error, 'The preview could not be rendered.'),
        })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [renderSignature, settings, sourceImage])

  const currentRenderError =
    renderError?.signature === renderSignature ? renderError.message : null
  const isRendering = Boolean(
    sourceImage && renderedSignature !== renderSignature && !currentRenderError,
  )
  const isPdfEditor = Boolean(pdfSource)
  const handlePurposeChange = (nextPurpose: WatermarkPurpose) => {
    setPurposeState((current) => changeWatermarkPurpose(current, nextPurpose))
    setRecipientError(null)
    setTextError(null)
    setExportError(null)
    setExportMessage(null)
  }

  const handleRecipientChange = (nextRecipient: string) => {
    setPurposeState((current) => changeWatermarkRecipient(current, nextRecipient))
    setRecipientError(null)
    setExportError(null)
    setExportMessage(null)
  }

  const handleRecipientBlur = () => {
    const nextState = normalizePurposeRecipient(purposeState)
    const nextReadiness = validateWatermarkDownload(nextState)
    setPurposeState(nextState)
    setRecipientError(nextReadiness.recipientError)
  }

  const handleTextChange = (text: string) => {
    setTextError(null)
    setExportError(null)
    setExportMessage(null)
    setPurposeState((current) => changeWatermarkText(current, text))
  }

  const handleResetText = () => {
    setTextError(null)
    setExportError(null)
    setExportMessage(null)
    setPurposeState((current) => resetWatermarkText(current))
  }

  const handleSettingsChange = (nextSettings: WatermarkSettings) => {
    setExportError(null)
    setExportMessage(null)
    setAppearance({
      opacity: nextSettings.opacity,
      rotationDegrees: nextSettings.rotationDegrees,
      fontSizeRatio: nextSettings.fontSizeRatio,
      position: nextSettings.position,
    })
  }

  const handleRetry = () => {
    setLoadStage('document')
    setLoadError(null)
    setLoadedDocumentId(null)
    setSourceImage(null)
    setPdfSource(null)
    setDocumentRecord(null)
    setReloadRevision((current) => current + 1)
  }

  const handleExport = async () => {
    if (!documentRecord || (!sourceImage && !pdfSource) || isExporting) {
      return
    }

    setRecipientError(null)
    setTextError(null)
    setExportError(null)
    setExportMessage(null)

    setRecipientError(downloadReadiness.recipientError)
    setTextError(downloadReadiness.textError)

    if (!downloadReadiness.isReady) {
      return
    }

    const { normalizedRecipient } = downloadReadiness

    setExportStage('generating')

    try {
      if (sourceImage) {
        if (!canvasRef.current) {
          throw new ImageWatermarkError('The image preview is not ready yet.', 'export')
        }

        renderImageWatermark(canvasRef.current, sourceImage, settings)
        setRenderedSignature(renderSignature)
        setExportStage('downloading')
        await exportCanvasAsPng(
          canvasRef.current,
          buildWatermarkedFilename(
            documentRecord.name,
            purposeState.purpose,
            normalizedRecipient,
            purposeState.sessionDate,
          ),
        )
        setExportMessage(
          `PNG downloaded at ${sourceImage.width} × ${sourceImage.height}px. The private original was not changed.`,
        )
      } else if (pdfSource) {
        const { downloadPdfBytes, generateWatermarkedPdf } = await import(
          '../lib/watermark/pdfWatermark'
        )
        const result = await generateWatermarkedPdf(pdfSource.bytes, settings)
        setExportStage('downloading')
        downloadPdfBytes(
          result.bytes,
          buildWatermarkedFilename(
            documentRecord.name,
            purposeState.purpose,
            normalizedRecipient,
            purposeState.sessionDate,
            'pdf',
          ),
        )
        setExportMessage(
          `Watermarked PDF downloaded with ${result.processedPageCount} ${result.processedPageCount === 1 ? 'page' : 'pages'}. The private original was not changed.`,
        )
      }
    } catch (error) {
      setExportError(
        getWatermarkErrorMessage(
          error,
          `The watermarked ${sourceImage ? 'PNG' : 'PDF'} could not be downloaded.`,
        ),
      )
    } finally {
      setExportStage('idle')
    }
  }

  if (
    (!sourceImage && !pdfSource) ||
    !documentRecord ||
    loadedDocumentId !== (documentId ?? '') ||
    loadError
  ) {
    if (!loadError || loadedDocumentId !== (documentId ?? '')) {
      return <RouteLoadingScreen message={getLoadMessage(loadStage)} />
    }

    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Watermark editor
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Document unavailable
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{loadError}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            to="/dashboard"
          >
            Back to documents
          </Link>
          <button
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={handleRetry}
            type="button"
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex rounded-lg text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
            to={`/documents/${documentRecord.id}`}
          >
            ← Back to document
          </Link>
          <h1 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Watermark {documentRecord.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Preview and export happen locally in this browser. Your private original remains unchanged.
          </p>
        </div>
        <button
          className="inline-flex shrink-0 justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
          disabled={isExporting || isRendering || Boolean(currentRenderError)}
          onClick={handleExport}
          type="button"
        >
          {isExporting
            ? exportStage === 'downloading'
              ? 'Downloading…'
              : isPdfEditor
                ? 'Generating PDF…'
                : 'Creating PNG…'
            : `Download ${isPdfEditor ? 'PDF' : 'PNG'}`}
        </button>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0">
          {sourceImage ? (
            <section
              aria-busy={isRendering}
              aria-label="Watermarked image preview"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-bold text-slate-950">Live preview</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Source resolution: {sourceImage.width} × {sourceImage.height}px
                  </p>
                </div>
                {isRendering ? (
                  <span className="text-xs font-medium text-indigo-700" role="status">
                    Rendering…
                  </span>
                ) : (
                  <span className="text-xs font-medium text-emerald-700">Ready</span>
                )}
              </div>

              <div className="relative grid min-h-72 place-items-center overflow-auto bg-slate-100 p-3 sm:min-h-[32rem] sm:p-6">
                <canvas
                  aria-label={`Watermarked preview of ${documentRecord.name}`}
                  className="block h-auto max-h-[70vh] max-w-full rounded-lg bg-white shadow-lg"
                  ref={canvasRef}
                >
                  Watermarked preview of {documentRecord.name}
                </canvas>
                {isRendering ? (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-100/40">
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                      Updating preview…
                    </span>
                  </div>
                ) : null}
              </div>
            </section>
          ) : pdfSource ? (
            <PdfWatermarkPreview
              documentName={documentRecord.name}
              settings={settings}
              source={pdfSource}
            />
          ) : null}

          {currentRenderError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {currentRenderError}
            </p>
          ) : null}
          {exportError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {exportError}
            </p>
          ) : null}
          {exportMessage ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
              {exportMessage}
            </p>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Watermark controls">
          <h2 className="text-lg font-bold text-slate-950">Watermark settings</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isPdfEditor
              ? 'The PDF is generated once when you download it; controls do not reprocess the file.'
              : 'Changes use the same Canvas renderer as the downloaded PNG.'}
          </p>
          <div className="mt-6">
            <WatermarkControls
              disabled={isExporting}
              isDownloadReady={downloadReadiness.isReady}
              onPurposeChange={handlePurposeChange}
              onRecipientBlur={handleRecipientBlur}
              onRecipientChange={handleRecipientChange}
              onResetText={handleResetText}
              onSettingsChange={handleSettingsChange}
              onTextChange={handleTextChange}
              purpose={purposeState.purpose}
              readinessMessage={downloadReadiness.message}
              recipient={purposeState.recipient}
              recipientError={recipientError}
              settings={settings}
              showResetText={purposeState.textSource === 'manual'}
              textError={textError}
            />
          </div>
        </aside>
      </div>
    </section>
  )
}
