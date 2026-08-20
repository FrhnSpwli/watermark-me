import type { PdfPreviewDocument } from '../../lib/pdfPreview/pdfPreview'
import { getComposerItemLabel } from '../../lib/composer/composerState'
import type { ComposerItem } from '../../types/composer'
import { PdfPageCanvas } from './PdfPageCanvas'

interface ComposerActivePreviewProps {
  item: ComposerItem | null
  imageUrls: ReadonlyMap<string, string>
  pdfDocuments: ReadonlyMap<string, PdfPreviewDocument>
}

export function ComposerActivePreview({
  item,
  imageUrls,
  pdfDocuments,
}: ComposerActivePreviewProps) {
  const label = item ? getComposerItemLabel(item) : ''

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
            Active preview
          </p>
          <h2 className="mt-1 font-bold text-slate-950">
            {item ? label : 'Choose an item'}
          </h2>
        </div>
        {item ? (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              item.selected
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {item.selected ? 'Included' : 'Excluded'}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex min-h-72 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3">
        {!item ? (
          <p className="max-w-sm text-center text-sm leading-6 text-slate-500">
            Select an image or PDF page in the source browser or output order to inspect it here.
          </p>
        ) : item.kind === 'image-file' && imageUrls.get(item.sourceFileId) ? (
          <img
            alt={label}
            className="max-h-[65vh] max-w-full object-contain"
            src={imageUrls.get(item.sourceFileId)}
          />
        ) : item.kind === 'pdf-page' && pdfDocuments.get(item.sourceFileId) ? (
          <PdfPageCanvas
            document={pdfDocuments.get(item.sourceFileId)!}
            label={label}
            mode="preview"
            pageNumber={item.pageNumber}
          />
        ) : (
          <p className="text-sm font-medium text-red-700">This preview is unavailable.</p>
        )}
      </div>
    </section>
  )
}
