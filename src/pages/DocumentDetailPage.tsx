import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { RouteLoadingScreen } from '../components/ui/RouteLoadingScreen'
import {
  createDocumentAccessUrl,
  deleteDocument,
  DOCUMENT_ACCESS_SECONDS,
  getDocument,
  getDocumentErrorMessage,
  renameDocument,
  addDocumentSource,
  removeDocumentSource,
  reorderDocumentSources,
  resolveDocumentWatermarkSource,
  validateDocumentFile,
} from '../services/documents'
import type { DocumentFileRecord, DocumentRecord } from '../types/documents'
import { formatDocumentDate, formatFileSize } from '../utils/format'

function getTypeLabel(document: DocumentRecord) {
  if (document.mime_type === 'application/pdf') {
    return 'PDF document'
  }

  if (document.mime_type === 'image/png') {
    return 'PNG image'
  }

  return 'JPEG image'
}

export function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const accessTimer = useRef<number | null>(null)
  const [document, setDocument] = useState<DocumentRecord | null>(null)
  const [loadedDocumentId, setLoadedDocumentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isSavingName, setIsSavingName] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isCreatingAccess, setIsCreatingAccess] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [accessUrl, setAccessUrl] = useState<string | null>(null)
  const [accessSourceId, setAccessSourceId] = useState<string | null>(null)
  const [sourceActionId, setSourceActionId] = useState<string | null>(null)
  const [sourceError, setSourceError] = useState<string | null>(null)

  const loadDocument = useCallback(async () => {
    if (!documentId) {
      setLoadError('This document link is invalid.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const nextDocument = await getDocument(documentId)
      setDocument(nextDocument)
      setRenameValue(nextDocument.name)
    } catch (error) {
      setLoadError(
        getDocumentErrorMessage(
          error,
          'This document is unavailable or could not be loaded.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    const requestedDocumentId = documentId ?? ''
    let isActive = true

    void getDocument(requestedDocumentId)
      .then((nextDocument) => {
        if (isActive) {
          setDocument(nextDocument)
          setRenameValue(nextDocument.name)
          setLoadError(null)
          setLoadedDocumentId(requestedDocumentId)
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setDocument(null)
          setLoadError(
            getDocumentErrorMessage(
              error,
              'This document is unavailable or could not be loaded.',
            ),
          )
          setLoadedDocumentId(requestedDocumentId)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [documentId])

  useEffect(
    () => () => {
      if (accessTimer.current !== null) {
        window.clearTimeout(accessTimer.current)
      }
    },
    [],
  )

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!document || isSavingName) {
      return
    }

    setIsSavingName(true)
    setRenameError(null)
    setActionMessage(null)

    try {
      const updatedDocument = await renameDocument(document.id, renameValue)
      setDocument(updatedDocument)
      setRenameValue(updatedDocument.name)
      setIsRenaming(false)
      setActionMessage('Document name updated. The private original remains unchanged.')
    } catch (error) {
      setRenameError(getDocumentErrorMessage(error, 'The document could not be renamed.'))
    } finally {
      setIsSavingName(false)
    }
  }

  const handleDelete = async () => {
    if (!document || isDeleting) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${document.name}"?\n\nThis will permanently delete the original file from your account.`,
    )

    if (!confirmed) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)
    setActionMessage(null)

    try {
      await deleteDocument(document.id)
      navigate('/dashboard', {
        replace: true,
        state: { message: `${document.name} was permanently deleted.` },
      })
    } catch (error) {
      setDeleteError(getDocumentErrorMessage(error, 'The document could not be deleted.'))
      setIsDeleting(false)
    }
  }

  const handleCreateAccess = async () => {
    if (!document || isCreatingAccess) {
      return
    }

    setIsCreatingAccess(true)
    setAccessError(null)
    setAccessUrl(null)
    setAccessSourceId(null)

    if (accessTimer.current !== null) {
      window.clearTimeout(accessTimer.current)
    }

    try {
      setAccessUrl(await createDocumentAccessUrl(document.id))
      accessTimer.current = window.setTimeout(() => {
        setAccessUrl(null)
        accessTimer.current = null
      }, DOCUMENT_ACCESS_SECONDS * 1000)
    } catch (error) {
      setAccessError(
        getDocumentErrorMessage(error, 'A private access link could not be created.'),
      )
    } finally {
      setIsCreatingAccess(false)
    }
  }

  const handleCreateSourceAccess = async (sourceId: string) => {
    if (!document || isCreatingAccess) {
      return
    }

    setIsCreatingAccess(true)
    setAccessError(null)
    setAccessUrl(null)
    setAccessSourceId(null)

    if (accessTimer.current !== null) {
      window.clearTimeout(accessTimer.current)
    }

    try {
      setAccessUrl(await createDocumentAccessUrl(document.id, sourceId))
      setAccessSourceId(sourceId)
      accessTimer.current = window.setTimeout(() => {
        setAccessUrl(null)
        setAccessSourceId(null)
        accessTimer.current = null
      }, DOCUMENT_ACCESS_SECONDS * 1000)
    } catch (error) {
      setAccessError(
        getDocumentErrorMessage(error, 'A private source access link could not be created.'),
      )
    } finally {
      setIsCreatingAccess(false)
    }
  }

  const handleAddSource = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!document || !file || sourceActionId) {
      return
    }

    setSourceActionId('add')
    setSourceError(null)

    try {
      validateDocumentFile(file)
      setDocument(await addDocumentSource(document.id, file))
      setActionMessage(`${file.name} was added without changing existing originals.`)
    } catch (error) {
      setSourceError(getDocumentErrorMessage(error, 'The source could not be added.'))
    } finally {
      setSourceActionId(null)
    }
  }

  const handleMoveSource = async (sourceId: string, direction: 'up' | 'down') => {
    if (!document || sourceActionId) {
      return
    }

    setSourceActionId(sourceId)
    setSourceError(null)

    try {
      setDocument(await reorderDocumentSources(document.id, sourceId, direction))
    } catch (error) {
      setSourceError(getDocumentErrorMessage(error, 'The source order could not be saved.'))
    } finally {
      setSourceActionId(null)
    }
  }

  const handleRemoveSource = async (source: DocumentFileRecord) => {
    if (!document || sourceActionId || (document.files?.length ?? 0) <= 1) {
      return
    }

    const confirmed = window.confirm(
      `Remove "${source.original_name}" from ${document.name}?\n\nOnly this original source will be permanently deleted.`,
    )

    if (!confirmed) {
      return
    }

    setSourceActionId(source.id)
    setSourceError(null)

    try {
      setDocument(await removeDocumentSource(document.id, source.id))
      setActionMessage(`${source.original_name} was removed from this document.`)
    } catch (error) {
      setSourceError(getDocumentErrorMessage(error, 'The source could not be removed.'))
    } finally {
      setSourceActionId(null)
    }
  }

  if (isLoading || loadedDocumentId !== (documentId ?? '')) {
    return <RouteLoadingScreen message="Loading document…" />
  }

  if (loadError || !document) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <PageHeader
          description={loadError ?? 'This document is not available.'}
          eyebrow="Document"
          title="Document unavailable"
        />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            to="/dashboard"
          >
            Back to documents
          </Link>
          <button
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={loadDocument}
            type="button"
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  const sources = document.files ?? []
  const watermarkSourceResolution = resolveDocumentWatermarkSource(document)
  const canWatermark = watermarkSourceResolution.status === 'ready'

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Link
        className="inline-flex rounded-lg text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
        to="/dashboard"
      >
        ← Back to My Documents
      </Link>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <PageHeader
            description="Basic metadata for the private original stored in your account."
            eyebrow="Document details"
            title={document.name}
          />

          {actionMessage ? (
            <div
              className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              role="status"
            >
              {actionMessage}
            </div>
          ) : null}

          <dl className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {[
              ['File type', getTypeLabel(document)],
              ['MIME type', document.mime_type],
              ['File size', formatFileSize(document.file_size)],
              ['Uploaded', formatDocumentDate(document.created_at)],
            ].map(([label, value]) => (
              <div
                className="grid gap-1 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:grid-cols-[9rem_1fr] sm:gap-4"
                key={label}
              >
                <dt className="text-sm font-medium text-slate-500">{label}</dt>
                <dd className="break-all text-sm font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-950">Sources ({sources.length})</h2>
                <p className="mt-1 text-sm text-slate-500">Original files are immutable and remain privately stored.</p>
              </div>
              <label className="inline-flex cursor-pointer justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
                {sourceActionId === 'add' ? 'Adding…' : 'Add source'}
                <input
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  disabled={Boolean(sourceActionId) || isDeleting}
                  onChange={handleAddSource}
                  type="file"
                />
              </label>
            </div>
            <ol className="mt-5 space-y-3">
              {sources.map((source, index) => (
                <li className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={source.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{index + 1}. {source.original_name}</p>
                      <p className="mt-1 break-all text-sm text-slate-500">
                        {source.mime_type} · {formatFileSize(source.file_size)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                        disabled={Boolean(sourceActionId) || index === 0 || isDeleting}
                        onClick={() => handleMoveSource(source.id, 'up')}
                        type="button"
                      >
                        Move up
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                        disabled={Boolean(sourceActionId) || index === sources.length - 1 || isDeleting}
                        onClick={() => handleMoveSource(source.id, 'down')}
                        type="button"
                      >
                        Move down
                      </button>
                      <button
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                        disabled={Boolean(sourceActionId) || sources.length <= 1 || isDeleting}
                        onClick={() => void handleRemoveSource(source)}
                        type="button"
                      >
                        Remove
                      </button>
                      <button
                        className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-indigo-300"
                        disabled={isCreatingAccess || isDeleting}
                        onClick={() => void handleCreateSourceAccess(source.id)}
                        type="button"
                      >
                        View source
                      </button>
                    </div>
                  </div>
                  {accessUrl && accessSourceId === source.id ? (
                    <a
                      className="mt-3 inline-flex text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline"
                      href={accessUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open source · available for 60 seconds
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
            {sourceError ? (
              <p className="mt-4 text-sm leading-6 text-red-700" role="alert">{sourceError}</p>
            ) : null}
            {accessError ? (
              <p className="mt-4 text-sm leading-6 text-red-700" role="alert">{accessError}</p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4" aria-label="Document actions">
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Create a watermarked copy</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Generate a purpose-specific copy in your browser without changing the private original.
            </p>
            {canWatermark ? (
              <Link
                className="mt-4 inline-flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                to={`/documents/${document.id}/watermark`}
              >
                Add Watermark
              </Link>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {watermarkSourceResolution.status === 'multiple'
                  ? 'Watermarking this multi-source document will be available after the composer phase.'
                  : watermarkSourceResolution.status === 'missing'
                    ? 'This document does not have source metadata available for watermarking.'
                    : 'This document type is not supported by the watermark editor.'}
              </p>
            )}
          </section>

          {sources.length === 1 ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Private original</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Open the stored original in a new tab. Access expires automatically
              after one minute.
            </p>
            <button
              className="mt-4 w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:text-indigo-300"
              disabled={isCreatingAccess || isDeleting}
              onClick={handleCreateAccess}
              type="button"
            >
              {isCreatingAccess ? 'Preparing private view…' : 'View original'}
            </button>
            {accessUrl ? (
              <a
                className="mt-3 inline-flex w-full justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                href={accessUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open original · available for 60 seconds
              </a>
            ) : null}
            {accessError ? (
              <p className="mt-3 text-sm leading-6 text-red-700" role="alert">
                {accessError}
              </p>
            ) : null}
          </section> : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Rename</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This changes metadata only. The private original is not moved or renamed.
            </p>
            {isRenaming ? (
              <form className="mt-4" onSubmit={handleRename}>
                <label className="block text-sm font-semibold text-slate-800" htmlFor="document-name">
                  Document name
                </label>
                <input
                  aria-describedby={renameError ? 'document-name-error' : undefined}
                  aria-invalid={Boolean(renameError)}
                  className={`mt-2 w-full rounded-xl border bg-white px-3.5 py-3 text-base shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 ${
                    renameError ? 'border-red-400' : 'border-slate-300'
                  }`}
                  disabled={isSavingName}
                  id="document-name"
                  maxLength={255}
                  onChange={(event) => {
                    setRenameValue(event.target.value)
                    setRenameError(null)
                  }}
                  required
                  type="text"
                  value={renameValue}
                />
                {renameError ? (
                  <p className="mt-2 text-sm text-red-700" id="document-name-error" role="alert">
                    {renameError}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-3">
                  <button
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-indigo-300"
                    disabled={isSavingName}
                    type="submit"
                  >
                    {isSavingName ? 'Saving…' : 'Save name'}
                  </button>
                  <button
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    disabled={isSavingName}
                    onClick={() => {
                      setRenameValue(document.name)
                      setRenameError(null)
                      setIsRenaming(false)
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:text-slate-400"
                disabled={isDeleting}
                onClick={() => setIsRenaming(true)}
                type="button"
              >
                Rename document
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-red-900">Delete document</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Permanently removes the private original and its metadata.
            </p>
            <button
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              disabled={isDeleting || isSavingName}
              onClick={handleDelete}
              type="button"
            >
              {isDeleting ? 'Deleting…' : 'Delete document'}
            </button>
            {deleteError ? (
              <p className="mt-3 text-sm leading-6 text-red-700" role="alert">
                {deleteError}
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  )
}
