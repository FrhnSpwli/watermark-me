import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { convertComposerSelection } from '../lib/conversion/conversionEngine'
import {
  createArtifactsZip,
  downloadBlob,
  getArtifactDownload,
} from '../lib/conversion/conversionDownload'
import {
  createArtifactFilenames,
  createConversionInputKey,
  createZipFilename,
  getConversionErrorMessage,
  getConversionOptions,
  getDefaultConversionTarget,
  isConversionInputCurrent,
  isConversionCancellation,
} from '../lib/conversion/conversionOutput'
import type { ComposerItem } from '../types/composer'
import type {
  ConversionMimeType,
  ConversionProgress,
  ConversionResult,
} from '../types/conversion'

type ConversionLifecycle =
  | { status: 'idle' }
  | {
      status: 'converting'
      inputKey: string
      progress: ConversionProgress
    }
  | {
      status: 'success'
      inputKey: string
      result: ConversionResult
      filenames: string[]
    }
  | { status: 'error'; inputKey: string; message: string }
  | { status: 'cancelled'; inputKey: string }

type DownloadLifecycle =
  | { status: 'idle' }
  | { status: 'preparing'; percent: number }
  | { status: 'started'; message: string }
  | { status: 'error'; message: string }

interface UseComposerConversionOptions {
  documentId: string
  documentName: string
  items: ComposerItem[]
  sourcesReady: boolean
}

export function useComposerConversion({
  documentId,
  documentName,
  items,
  sourcesReady,
}: UseComposerConversionOptions) {
  const options = useMemo(() => getConversionOptions(items), [items])
  const defaultTarget = useMemo(
    () => getDefaultConversionTarget(items, options),
    [items, options],
  )
  const [requestedTarget, setRequestedTarget] =
    useState<ConversionMimeType | null>(null)
  const target = options.some((option) => option.target === requestedTarget)
    ? requestedTarget
    : defaultTarget
  const selectedOption =
    options.find((option) => option.target === target) ?? null
  const inputKey = createConversionInputKey(documentId, items, target)
  const latestInputKey = useRef(inputKey)
  const abortController = useRef<AbortController | null>(null)
  const [lifecycle, setLifecycle] = useState<ConversionLifecycle>({
    status: 'idle',
  })
  const [downloadLifecycle, setDownloadLifecycle] =
    useState<DownloadLifecycle>({ status: 'idle' })

  useEffect(() => {
    latestInputKey.current = inputKey
  }, [inputKey])

  useEffect(
    () => () => {
      abortController.current?.abort()
      abortController.current = null
    },
    [],
  )

  const isConverting =
    lifecycle.status === 'converting' &&
    isConversionInputCurrent(lifecycle.inputKey, inputKey)
  const isPreparingDownload = downloadLifecycle.status === 'preparing'
  const interactionLocked = isConverting || isPreparingDownload
  const canConvert = Boolean(
    sourcesReady && inputKey && selectedOption && !interactionLocked,
  )
  const currentSuccess =
    lifecycle.status === 'success' &&
    isConversionInputCurrent(lifecycle.inputKey, inputKey)
      ? lifecycle
      : null
  const currentError =
    lifecycle.status === 'error' &&
    isConversionInputCurrent(lifecycle.inputKey, inputKey)
      ? lifecycle.message
      : null
  const wasCancelled =
    lifecycle.status === 'cancelled' &&
    isConversionInputCurrent(lifecycle.inputKey, inputKey)

  const invalidate = useCallback(() => {
    abortController.current?.abort()
    abortController.current = null
    setLifecycle({ status: 'idle' })
    setDownloadLifecycle({ status: 'idle' })
  }, [])

  const selectTarget = useCallback((nextTarget: ConversionMimeType) => {
    if (nextTarget === target) {
      return
    }

    invalidate()
    setRequestedTarget(nextTarget)
  }, [invalidate, target])

  const convert = useCallback(async () => {
    if (!canConvert || !inputKey || !target) {
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setDownloadLifecycle({ status: 'idle' })
    setLifecycle({
      status: 'converting',
      inputKey,
      progress: {
        completed: 0,
        total: items.filter((item) => item.selected).length,
        stage: 'loading-source',
      },
    })

    try {
      const { createPrivateDocumentSourceResolver } = await import(
        '../services/conversionSources'
      )
      const result = await convertComposerSelection({
        items,
        target,
        signal: controller.signal,
        sourceResolver: createPrivateDocumentSourceResolver(documentId),
        onProgress: (progress) => {
          if (
            abortController.current === controller &&
            latestInputKey.current === inputKey
          ) {
            setLifecycle({ status: 'converting', inputKey, progress })
          }
        },
      })

      if (
        abortController.current !== controller ||
        latestInputKey.current !== inputKey ||
        controller.signal.aborted
      ) {
        return
      }

      setLifecycle({
        status: 'success',
        inputKey,
        result,
        filenames: createArtifactFilenames(
          documentName,
          result.artifacts,
          items,
        ),
      })
    } catch (error) {
      if (
        abortController.current !== controller ||
        latestInputKey.current !== inputKey
      ) {
        return
      }

      setLifecycle(
        isConversionCancellation(error)
          ? { status: 'cancelled', inputKey }
          : {
              status: 'error',
              inputKey,
              message: getConversionErrorMessage(error),
            },
      )
    } finally {
      if (abortController.current === controller) {
        abortController.current = null
      }
    }
  }, [
    canConvert,
    documentId,
    documentName,
    inputKey,
    items,
    target,
  ])

  const cancel = useCallback(() => {
    const controller = abortController.current
    if (!controller || !inputKey) {
      return
    }

    controller.abort()
    setLifecycle({ status: 'cancelled', inputKey })
  }, [inputKey])

  const download = useCallback(async () => {
    if (!currentSuccess || interactionLocked) {
      return
    }

    const { result, filenames } = currentSuccess
    try {
      if (result.artifacts.length === 1) {
        downloadBlob(result.artifacts[0].blob, filenames[0])
        setDownloadLifecycle({
          status: 'started',
          message: `Download started for ${filenames[0]}.`,
        })
        return
      }

      setDownloadLifecycle({ status: 'preparing', percent: 0 })
      const zipBlob = await createArtifactsZip(
        result.artifacts,
        filenames,
        (percent) => {
          if (latestInputKey.current === currentSuccess.inputKey) {
            setDownloadLifecycle({ status: 'preparing', percent })
          }
        },
      )

      if (latestInputKey.current !== currentSuccess.inputKey) {
        return
      }

      const zipFilename = createZipFilename(documentName)
      downloadBlob(zipBlob, zipFilename)
      setDownloadLifecycle({
        status: 'started',
        message: `Download started for ${zipFilename}.`,
      })
    } catch {
      if (latestInputKey.current === currentSuccess.inputKey) {
        setDownloadLifecycle({
          status: 'error',
          message: 'The browser could not prepare this download. Please try again.',
        })
      }
    }
  }, [currentSuccess, documentName, interactionLocked])

  const downloadArtifact = useCallback((index: number) => {
    if (!currentSuccess || interactionLocked) {
      return
    }

    const artifactDownload = getArtifactDownload(
      currentSuccess.result.artifacts,
      currentSuccess.filenames,
      index,
    )
    if (!artifactDownload) {
      return
    }

    try {
      downloadBlob(artifactDownload.blob, artifactDownload.filename)
      setDownloadLifecycle({
        status: 'started',
        message: `Download started for ${artifactDownload.filename}.`,
      })
    } catch {
      setDownloadLifecycle({
        status: 'error',
        message: 'The browser could not start this download. Please try again.',
      })
    }
  }, [currentSuccess, interactionLocked])

  return {
    options,
    target,
    selectedOption,
    selectTarget,
    invalidate,
    canConvert,
    convert,
    cancel,
    lifecycle,
    isConverting,
    interactionLocked,
    currentSuccess,
    currentError,
    wasCancelled,
    downloadLifecycle,
    download,
    downloadArtifact,
  }
}

export type ComposerConversionController = ReturnType<
  typeof useComposerConversion
>
