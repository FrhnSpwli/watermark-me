import type { PdfPreviewDocument } from '../../lib/pdfPreview/pdfPreview'
import { getComposerItemLabel } from '../../lib/composer/composerState'
import type {
  ComposerItem,
  ComposerSourceLoadStatus,
} from '../../types/composer'
import type { DocumentFileRecord } from '../../types/documents'
import { formatFileSize } from '../../utils/format'
import { PdfPageCanvas } from './PdfPageCanvas'

interface ComposerSourceBrowserProps {
  sources: DocumentFileRecord[]
  sourceStatuses: ReadonlyMap<string, ComposerSourceLoadStatus>
  items: ComposerItem[]
  imageUrls: ReadonlyMap<string, string>
  pdfDocuments: ReadonlyMap<string, PdfPreviewDocument>
  activeItemId: string | null
  selectionDisabled?: boolean
  onActivate: (itemId: string) => void
  onSelect: (itemId: string, selected: boolean) => void
}

export function ComposerSourceBrowser({
  sources,
  sourceStatuses,
  items,
  imageUrls,
  pdfDocuments,
  activeItemId,
  selectionDisabled = false,
  onActivate,
  onSelect,
}: ComposerSourceBrowserProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
          Source browser
        </p>
        <h2 className="mt-1 font-bold text-slate-950">Images and PDF pages</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Every item starts included. Excluded items stay available here for recovery.
        </p>
      </div>

      <div className="mt-5 space-y-6">
        {sources.map((source, sourceIndex) => {
          const status = sourceStatuses.get(source.id) ?? { status: 'loading' as const }
          const sourceItems = items
            .filter((item) => item.sourceFileId === source.id)
            .sort((left, right) => left.initialOrder - right.initialOrder)

          return (
            <section aria-labelledby={`composer-source-${source.id}`} key={source.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3
                    className="break-words text-sm font-bold text-slate-900"
                    id={`composer-source-${source.id}`}
                  >
                    {sourceIndex + 1}. {source.original_name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {source.mime_type} - {formatFileSize(source.file_size)}
                  </p>
                </div>
                {status.status === 'ready' ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Ready
                  </span>
                ) : null}
              </div>

              {status.status === 'loading' ? (
                <div className="mt-3 rounded-xl bg-slate-100 p-4 text-sm text-slate-600" role="status">
                  Loading this private source...
                </div>
              ) : null}
              {status.status === 'error' ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
                  {status.message}
                </div>
              ) : null}
              {status.status === 'ready' ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {sourceItems.map((item) => {
                    const label = getComposerItemLabel(item)
                    const isActive = item.id === activeItemId

                    return (
                      <article
                        className={`rounded-xl border p-2 ${
                          isActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
                        } ${item.selected ? '' : 'opacity-70'}`}
                        key={item.id}
                      >
                        <button
                          aria-label={`Preview ${label}`}
                          className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-1"
                          onClick={() => onActivate(item.id)}
                          onFocus={() => onActivate(item.id)}
                          type="button"
                        >
                          {item.kind === 'image-file' && imageUrls.get(item.sourceFileId) ? (
                            <img
                              alt=""
                              className="h-36 w-full object-contain"
                              loading="lazy"
                              src={imageUrls.get(item.sourceFileId)}
                            />
                          ) : item.kind === 'pdf-page' && pdfDocuments.get(item.sourceFileId) ? (
                            <PdfPageCanvas
                              document={pdfDocuments.get(item.sourceFileId)!}
                              label={label}
                              mode="thumbnail"
                              pageNumber={item.pageNumber}
                            />
                          ) : (
                            <span className="flex h-36 items-center justify-center text-xs text-slate-500">
                              No preview
                            </span>
                          )}
                        </button>
                        <button
                          className="mt-2 block w-full truncate text-left text-xs font-semibold text-slate-800 hover:text-indigo-700"
                          onClick={() => onActivate(item.id)}
                          onFocus={() => onActivate(item.id)}
                          title={label}
                          type="button"
                        >
                          {item.kind === 'pdf-page' ? `Page ${item.pageNumber}` : 'Image'}
                        </button>
                        <label className={`mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700 ${selectionDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          <input
                            checked={item.selected}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            disabled={selectionDisabled}
                            onChange={(event) => onSelect(item.id, event.target.checked)}
                            type="checkbox"
                          />
                          {item.selected ? 'Included' : 'Excluded'}
                        </label>
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </section>
  )
}
