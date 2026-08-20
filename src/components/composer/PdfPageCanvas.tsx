import { useEffect, useRef, useState } from 'react'
import type { PdfPreviewDocument } from '../../lib/pdfPreview/pdfPreview'

interface PdfPageCanvasProps {
  document: PdfPreviewDocument
  pageNumber: number
  mode: 'thumbnail' | 'preview'
  label: string
}

export function PdfPageCanvas({
  document,
  pageNumber,
  mode,
  label,
}: PdfPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isVisible, setIsVisible] = useState(mode === 'preview')
  const [containerWidth, setContainerWidth] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (mode === 'preview') {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px' },
    )
    observer.observe(container)

    return () => observer.disconnect()
  }, [mode])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const updateWidth = () => setContainerWidth(container.clientWidth)
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isVisible || containerWidth < 1) {
      return
    }

    const controller = new AbortController()

    void import('../../lib/pdfPreview/pdfPreview')
      .then(({ renderPdfPage }) =>
        renderPdfPage({
          document,
          pageNumber,
          canvas,
          cssWidth: mode === 'thumbnail' ? Math.min(containerWidth, 180) : containerWidth,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          signal: controller.signal,
        }),
      )
      .then(() => {
        if (!controller.signal.aborted) {
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [containerWidth, document, isVisible, mode, pageNumber])

  return (
    <div
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100 ${
        mode === 'thumbnail' ? 'min-h-36' : 'min-h-72'
      }`}
      ref={containerRef}
    >
      {isVisible ? (
        <canvas
          aria-label={label}
          className={`block max-w-full bg-white shadow-sm ${status === 'ready' ? '' : 'invisible'}`}
          ref={canvasRef}
          role="img"
        />
      ) : null}
      {status === 'loading' ? (
        <span className="absolute text-xs font-medium text-slate-500">Loading preview...</span>
      ) : null}
      {status === 'error' ? (
        <span className="absolute px-3 text-center text-xs font-medium text-red-700">
          Preview unavailable
        </span>
      ) : null}
    </div>
  )
}
