import { Link } from 'react-router-dom'
import type { DocumentRecord } from '../../types/documents'
import { formatDocumentDate, formatFileSize } from '../../utils/format'

interface DocumentCardProps {
  document: DocumentRecord
}

function getTypeLabel(document: DocumentRecord) {
  if (document.document_type === 'pdf' || document.mime_type === 'application/pdf') {
    return 'PDF'
  }

  if (document.mime_type === 'image/png') {
    return 'PNG'
  }

  return 'JPEG'
}

export function DocumentCard({ document }: DocumentCardProps) {
  const typeLabel = getTypeLabel(document)

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700"
        >
          {typeLabel}
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
          Private original
        </span>
      </div>

      <h3 className="mt-5 break-words text-base font-bold leading-6 text-slate-950">
        {document.name}
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        {document.files && document.files.length > 1
          ? `${document.files.length} source files`
          : formatFileSize(document.file_size)}{' '}
        · {formatDocumentDate(document.created_at)}
      </p>

      <Link
        aria-label={`Open details for ${document.name}`}
        className="mt-6 inline-flex w-full justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        to={`/documents/${document.id}`}
      >
        Open details
      </Link>
    </article>
  )
}
