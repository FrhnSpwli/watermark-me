import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PdfWatermarkPreview } from '../components/watermark/PdfWatermarkPreview'
import { WatermarkControls } from '../components/watermark/WatermarkControls'
import { RouteLoadingScreen } from '../components/ui/RouteLoadingScreen'
import { useWatermarkEditorInput } from '../hooks/useWatermarkEditorInput'
import {
  canvasToPngBlob,
  generateWatermarkedImageBlob,
  ImageWatermarkError,
  renderImageWatermark,
} from '../lib/watermark/imageWatermark'
import { DEFAULT_WATERMARK_SETTINGS } from '../lib/watermark/watermarkConfig'
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
  buildWatermarkOutputFilenames,
  buildWatermarkZipFilename,
  createWatermarkResultSignature,
  isWatermarkCancellation,
  isWatermarkResultCurrent,
  watermarkGeneratedImageArtifacts,
} from '../lib/watermark/watermarkOutput'
import {
  createArtifactsZip,
  downloadBlob,
} from '../lib/conversion/conversionDownload'
import { getWatermarkHandoffId } from '../lib/watermark/watermarkHandoff'
import type {
  WatermarkProgress,
  WatermarkPurpose,
  WatermarkResult,
  WatermarkSettings,
} from '../types/watermark'

type WatermarkAppearanceSettings = Pick<
  WatermarkSettings,
  'opacity' | 'rotationDegrees' | 'fontSizeRatio' | 'position'
>

type ActionStage = 'idle' | 'generating' | 'preparing-download'

interface RenderErrorState {
  signature: string
  message: string
}

interface GeneratedResultState {
  signature: string
  result: WatermarkResult
}

function getWatermarkErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ImageWatermarkError) {
    return error.message
  }
  if (error instanceof Error && error.name === 'PdfWatermarkError') {
    return error.message
  }
  if (error instanceof Error && error.name === 'WatermarkOutputError') {
    return error.message
  }
  return fallback
}

export function WatermarkEditorPage() {
  const { documentId = '' } = useParams<{ documentId: string }>()
  const location = useLocation()
  const handoffId = getWatermarkHandoffId(location.state)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const generationController = useRef<AbortController | null>(null)
  const [reloadRevision, setReloadRevision] = useState(0)
  const {
    input,
    sourceImage,
    pdfSource,
    error: inputError,
    isLoading,
    loadMessage,
    previewLoading,
    activeArtifactIndex,
    setActiveArtifactIndex,
    generatedImageArtifacts,
  } = useWatermarkEditorInput({ documentId, handoffId, reloadRevision })
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
  const [actionStage, setActionStage] = useState<ActionStage>('idle')
  const [progress, setProgress] = useState<WatermarkProgress | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [generatedResult, setGeneratedResult] =
    useState<GeneratedResultState | null>(null)
  const isBusy = actionStage !== 'idle'
  const settings = useMemo<WatermarkSettings>(
    () => ({
      ...appearance,
      text: purposeState.text,
      textStyle: purposeState.textStyle,
    }),
    [appearance, purposeState.text, purposeState.textStyle],
  )
  const readiness = useMemo(
    () => validateWatermarkDownload(purposeState),
    [purposeState],
  )
  const renderSignature = useMemo(
    () =>
      JSON.stringify({
        sourceKey: input?.sourceKey,
        activeArtifactIndex,
        width: sourceImage?.width,
        height: sourceImage?.height,
        settings,
      }),
    [
      activeArtifactIndex,
      input?.sourceKey,
      settings,
      sourceImage?.height,
      sourceImage?.width,
    ],
  )
  const resultSignature = createWatermarkResultSignature(
    input?.sourceKey ?? `document:${documentId}`,
    settings,
    purposeState.purpose,
    purposeState.recipient,
    purposeState.sessionDate,
  )
  const currentResult =
    generatedResult &&
    isWatermarkResultCurrent(generatedResult.signature, resultSignature)
      ? generatedResult.result
      : null

  useEffect(
    () => () => {
      generationController.current?.abort()
      generationController.current = null
    },
    [],
  )

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
          message: getWatermarkErrorMessage(
            error,
            'The preview could not be rendered.',
          ),
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
  const isPdfEditor = input?.kind === 'pdf'
  const batchCount = generatedImageArtifacts?.length ?? 1

  const invalidateResult = () => {
    setGeneratedResult(null)
    setActionError(null)
    setActionMessage(null)
  }

  const handlePurposeChange = (purpose: WatermarkPurpose) => {
    invalidateResult()
    setPurposeState((current) => changeWatermarkPurpose(current, purpose))
    setRecipientError(null)
    setTextError(null)
  }

  const handleRecipientChange = (recipient: string) => {
    invalidateResult()
    setPurposeState((current) => changeWatermarkRecipient(current, recipient))
    setRecipientError(null)
  }

  const handleRecipientBlur = () => {
    invalidateResult()
    const nextState = normalizePurposeRecipient(purposeState)
    const nextReadiness = validateWatermarkDownload(nextState)
    setPurposeState(nextState)
    setRecipientError(nextReadiness.recipientError)
  }

  const handleTextChange = (text: string) => {
    invalidateResult()
    setTextError(null)
    setPurposeState((current) => changeWatermarkText(current, text))
  }

  const handleResetText = () => {
    invalidateResult()
    setTextError(null)
    setPurposeState((current) => resetWatermarkText(current))
  }

  const handleSettingsChange = (nextSettings: WatermarkSettings) => {
    invalidateResult()
    setAppearance({
      opacity: nextSettings.opacity,
      rotationDegrees: nextSettings.rotationDegrees,
      fontSizeRatio: nextSettings.fontSizeRatio,
      position: nextSettings.position,
    })
  }

  const handleRetry = () => {
    invalidateResult()
    setReloadRevision((current) => current + 1)
  }

  const handleGenerate = async () => {
    if (!input || isBusy || (!sourceImage && !pdfSource)) {
      return
    }

    setRecipientError(readiness.recipientError)
    setTextError(readiness.textError)
    setActionError(null)
    setActionMessage(null)
    setGeneratedResult(null)
    if (!readiness.isReady) {
      return
    }

    const controller = new AbortController()
    generationController.current = controller
    setActionStage('generating')
    setProgress({ completed: 0, total: batchCount })
    const capturedSignature = resultSignature

    try {
      let result: WatermarkResult
      if (generatedImageArtifacts) {
        const filenames = buildWatermarkOutputFilenames(
          input.context.name,
          purposeState.purpose,
          readiness.normalizedRecipient,
          purposeState.sessionDate,
          generatedImageArtifacts.length,
          'png',
        )
        result = await watermarkGeneratedImageArtifacts({
          artifacts: generatedImageArtifacts,
          filenames,
          settings,
          signal: controller.signal,
          render: generateWatermarkedImageBlob,
          onProgress: setProgress,
        })
      } else if (sourceImage) {
        if (!canvasRef.current) {
          throw new ImageWatermarkError(
            'The image preview is not ready yet.',
            'export',
          )
        }
        renderImageWatermark(canvasRef.current, sourceImage, settings)
        const blob = await canvasToPngBlob(canvasRef.current, controller.signal)
        result = {
          artifacts: [{
            blob,
            mimeType: 'image/png',
            extension: 'png',
            filename: buildWatermarkOutputFilenames(
              input.context.name,
              purposeState.purpose,
              readiness.normalizedRecipient,
              purposeState.sessionDate,
              1,
              'png',
            )[0],
          }],
        }
        setProgress({ completed: 1, total: 1 })
      } else if (pdfSource) {
        controller.signal.throwIfAborted()
        const { generateWatermarkedPdf } = await import(
          '../lib/watermark/pdfWatermark'
        )
        const pdfResult = await generateWatermarkedPdf(pdfSource.bytes, settings)
        controller.signal.throwIfAborted()
        result = {
          artifacts: [{
            blob: new Blob([new Uint8Array(pdfResult.bytes)], {
              type: 'application/pdf',
            }),
            mimeType: 'application/pdf',
            extension: 'pdf',
            filename: buildWatermarkOutputFilenames(
              input.context.name,
              purposeState.purpose,
              readiness.normalizedRecipient,
              purposeState.sessionDate,
              1,
              'pdf',
            )[0],
          }],
        }
        setProgress({ completed: 1, total: 1 })
      } else {
        return
      }

      if (
        generationController.current === controller &&
        !controller.signal.aborted
      ) {
        setGeneratedResult({ signature: capturedSignature, result })
        setActionMessage(
          result.artifacts.length === 1
            ? 'Watermarked copy generated in this browser.'
            : `${result.artifacts.length} watermarked images generated in the original conversion order.`,
        )
      }
    } catch (error) {
      if (generationController.current === controller) {
        if (isWatermarkCancellation(error)) {
          setActionMessage(
            'Watermark generation cancelled. Settings were kept for another try.',
          )
        } else {
          setActionError(
            getWatermarkErrorMessage(
              error,
              'The watermarked output could not be generated in this browser.',
            ),
          )
        }
      }
    } finally {
      if (generationController.current === controller) {
        generationController.current = null
        setActionStage('idle')
      }
    }
  }

  const handleCancel = () => {
    generationController.current?.abort()
  }

  const handleDownload = async () => {
    if (!currentResult || isBusy) {
      return
    }

    setActionError(null)
    try {
      if (currentResult.artifacts.length === 1) {
        const artifact = currentResult.artifacts[0]
        downloadBlob(artifact.blob, artifact.filename)
        setActionMessage(`Download started for ${artifact.filename}.`)
        return
      }

      setActionStage('preparing-download')
      const filenames = currentResult.artifacts.map((artifact) => artifact.filename)
      const zipBlob = await createArtifactsZip(
        currentResult.artifacts,
        filenames,
      )
      const zipFilename = buildWatermarkZipFilename(filenames[0])
      downloadBlob(zipBlob, zipFilename)
      setActionMessage(`Download started for ${zipFilename}.`)
    } catch {
      setActionError('The browser could not prepare this download. Please try again.')
    } finally {
      setActionStage('idle')
    }
  }

  if (isLoading) {
    return <RouteLoadingScreen message={loadMessage} />
  }

  if (inputError || !input) {
    const isTemporary = inputError?.code !== 'document-unavailable'
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Watermark editor
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          {isTemporary ? 'Temporary conversion unavailable' : 'Document unavailable'}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          {inputError?.message ?? 'This watermark input is unavailable.'}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            to={isTemporary ? `/documents/${documentId}/compose` : '/dashboard'}
          >
            {isTemporary ? 'Return to Composer' : 'Back to documents'}
          </Link>
          {!isTemporary ? (
            <button
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={handleRetry}
              type="button"
            >
              Try again
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  const backTarget =
    input.authority === 'generated'
      ? `/documents/${input.context.id}/compose`
      : `/documents/${input.context.id}`

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex rounded-lg text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline"
            to={backTarget}
          >
            &larr; Back to {input.authority === 'generated' ? 'Composer' : 'document'}
          </Link>
          <h1 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Watermark {input.context.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {input.authority === 'generated'
              ? 'This converted output is being watermarked in your browser. Neither intermediate nor final files are uploaded.'
              : 'Preview and export happen locally in this browser. Your private original remains unchanged.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            disabled={
              isBusy ||
              previewLoading ||
              isRendering ||
              Boolean(currentRenderError)
            }
            onClick={() => void handleGenerate()}
            type="button"
          >
            {actionStage === 'generating'
              ? `Watermarking ${progress?.completed ?? 0} of ${progress?.total ?? batchCount}...`
              : currentResult
                ? 'Regenerate Watermarked Copy'
                : `Generate Watermarked ${batchCount > 1 ? 'Copies' : 'Copy'}`}
          </button>
          {actionStage === 'generating' ? (
            <button
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={handleCancel}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0">
          {generatedImageArtifacts && generatedImageArtifacts.length > 1 ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Converted file {activeArtifactIndex + 1} of {generatedImageArtifacts.length}
                </p>
                <p className="mt-1 max-w-md truncate text-xs text-slate-500">
                  {generatedImageArtifacts[activeArtifactIndex].filename}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={isBusy || activeArtifactIndex === 0}
                  onClick={() => setActiveArtifactIndex(activeArtifactIndex - 1)}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={
                    isBusy ||
                    activeArtifactIndex === generatedImageArtifacts.length - 1
                  }
                  onClick={() => setActiveArtifactIndex(activeArtifactIndex + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

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
                    Source resolution: {sourceImage.width} &times; {sourceImage.height}px
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-700">
                  {isRendering ? 'Rendering...' : 'Ready'}
                </span>
              </div>
              <div className="relative grid min-h-72 place-items-center overflow-auto bg-slate-100 p-3 sm:min-h-[32rem] sm:p-6">
                <canvas
                  aria-label={`Watermarked preview of ${input.context.name}`}
                  className="block h-auto max-h-[70vh] max-w-full rounded-lg bg-white shadow-lg"
                  ref={canvasRef}
                />
              </div>
            </section>
          ) : previewLoading ? (
            <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-600" role="status">
              Preparing this converted image preview...
            </div>
          ) : pdfSource ? (
            <PdfWatermarkPreview
              documentName={input.context.name}
              settings={settings}
              source={pdfSource}
            />
          ) : null}

          {currentRenderError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {currentRenderError}
            </p>
          ) : null}
          {actionStage === 'generating' && progress ? (
            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900" role="status" aria-live="polite">
              Watermarking {progress.completed} of {progress.total}{' '}
              {progress.total === 1 ? 'file' : 'files'}...
            </div>
          ) : null}
          {actionError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {actionError}
            </p>
          ) : null}
          {actionMessage ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
              {actionMessage}
            </p>
          ) : null}
          {currentResult ? (
            <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="font-bold text-emerald-950">Watermarked output ready</h2>
              <p className="mt-1 text-sm text-emerald-900">
                {currentResult.artifacts.length}{' '}
                {currentResult.artifacts.length === 1 ? 'file' : 'files'} generated locally.
              </p>
              <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto rounded-lg bg-white/70 p-3 font-mono text-xs text-slate-700">
                {currentResult.artifacts.map((artifact) => (
                  <li className="break-all" key={artifact.filename}>
                    {artifact.filename}
                  </li>
                ))}
              </ul>
              <button
                className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isBusy}
                onClick={() => void handleDownload()}
                type="button"
              >
                {actionStage === 'preparing-download'
                  ? 'Preparing Watermarked ZIP...'
                  : currentResult.artifacts.length === 1
                    ? 'Download Watermarked Copy'
                    : 'Download Watermarked ZIP'}
              </button>
            </section>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Watermark controls">
          <h2 className="text-lg font-bold text-slate-950">Watermark settings</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {generatedImageArtifacts && generatedImageArtifacts.length > 1
              ? `One shared configuration will be applied to all ${generatedImageArtifacts.length} images.`
              : isPdfEditor
                ? 'The same settings will be applied to every PDF page.'
                : 'Changes use the same Canvas renderer as the final PNG.'}
          </p>
          <div className="mt-6">
            <WatermarkControls
              disabled={isBusy}
              isDownloadReady={readiness.isReady}
              onPurposeChange={handlePurposeChange}
              onRecipientBlur={handleRecipientBlur}
              onRecipientChange={handleRecipientChange}
              onResetText={handleResetText}
              onSettingsChange={handleSettingsChange}
              onTextChange={handleTextChange}
              purpose={purposeState.purpose}
              readinessMessage={readiness.message}
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
