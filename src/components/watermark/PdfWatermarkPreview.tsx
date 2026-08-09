import type { CSSProperties } from 'react'
import type { PrivatePdfSource } from '../../lib/watermark/pdfWatermark'
import type { WatermarkSettings } from '../../types/watermark'

interface PdfWatermarkPreviewProps {
  documentName: string
  source: PrivatePdfSource
  settings: WatermarkSettings
}

function getPositionStyles(position: WatermarkSettings['position']): CSSProperties {
  const [vertical, horizontal = 'center'] = position.split('-')

  return {
    alignItems:
      vertical === 'top' ? 'flex-start' : vertical === 'bottom' ? 'flex-end' : 'center',
    justifyContent:
      horizontal === 'left' ? 'flex-start' : horizontal === 'right' ? 'flex-end' : 'center',
  }
}

function getOrientationSummary(source: PrivatePdfSource) {
  const orientations = new Set(source.pages.map((page) => page.orientation))

  if (orientations.size === 1) {
    const orientation = source.pages[0]?.orientation ?? 'portrait'
    return `${orientation[0].toLocaleUpperCase()}${orientation.slice(1)} pages`
  }

  return 'Mixed page orientations'
}

function isPurposeHierarchy(settings: WatermarkSettings, lines: string[]) {
  return (
    settings.textStyle === 'purpose' &&
    lines.length === 3 &&
    lines[0]?.toLocaleUpperCase() === 'ONLY FOR'
  )
}

export function PdfWatermarkPreview({
  documentName,
  source,
  settings,
}: PdfWatermarkPreviewProps) {
  const lines = settings.text.replace(/\r\n?/g, '\n').split('\n')
  const hierarchical = isPurposeHierarchy(settings, lines)
  const previewScale = Math.max(0.72, Math.min(1.35, settings.fontSizeRatio / 0.06))
  const firstPage = source.pages[0]

  return (
    <section
      aria-label="PDF watermark configuration preview"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700"
          >
            PDF
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-bold text-slate-950" title={documentName}>
              {documentName}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {source.pageCount} {source.pageCount === 1 ? 'page' : 'pages'} ·{' '}
              {getOrientationSummary(source)}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Applies to every page
        </span>
      </div>

      <div className="bg-slate-100 p-4 sm:p-8">
        <div
          aria-label={`Representative watermark placement for ${documentName}`}
          className="mx-auto aspect-[3/4] w-full max-w-lg overflow-hidden rounded-md border border-slate-200 bg-white p-[5%] shadow-lg"
        >
          <div className="flex size-full" style={getPositionStyles(settings.position)}>
            <div
              className="max-w-[78%] text-center font-sans text-indigo-600"
              style={{
                opacity: settings.opacity,
                transform: `rotate(${settings.rotationDegrees}deg) scale(${previewScale})`,
              }}
            >
              {hierarchical ? (
                <>
                  <p className="text-[0.58rem] font-semibold tracking-[0.14em]">
                    {lines[0]}
                  </p>
                  <p className="mt-1.5 break-words text-sm font-bold leading-tight">
                    {lines[1]}
                  </p>
                  <p className="mt-2 text-[0.58rem] font-medium tracking-[0.06em]">
                    {lines[2]}
                  </p>
                </>
              ) : (
                lines.map((line, index) => (
                  <p className="break-words text-xs font-semibold leading-relaxed" key={index}>
                    {line || '\u00a0'}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-500">
        <p>
          This representative preview keeps PDF processing lightweight. On download,
          the watermark is fitted to every page using its actual dimensions and safe margins.
        </p>
        {firstPage ? (
          <p className="mt-1">
            First page: {Math.round(firstPage.width)} × {Math.round(firstPage.height)} PDF points.
          </p>
        ) : null}
      </div>
    </section>
  )
}
