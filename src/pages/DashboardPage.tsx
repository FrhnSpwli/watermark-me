import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DocumentCard } from '../components/documents/DocumentCard'
import { UploadDocumentPanel } from '../components/documents/UploadDocumentPanel'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../hooks/useAuth'
import {
  getDocumentErrorMessage,
  listDocuments,
} from '../services/documents'
import type { DocumentRecord } from '../types/documents'

function getNavigationMessage(state: unknown) {
  if (
    typeof state === 'object' &&
    state !== null &&
    'message' in state &&
    typeof state.message === 'string'
  ) {
    return state.message
  }

  return null
}

export function DashboardPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const metadataName = user?.user_metadata.full_name
  const displayName =
    typeof metadataName === 'string' && metadataName.trim()
      ? metadataName.trim()
      : user?.email ?? 'there'
  const navigationMessage = getNavigationMessage(location.state)

  const loadUserDocuments = async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      setDocuments(await listDocuments())
    } catch (error) {
      setLoadError(
        getDocumentErrorMessage(error, 'We could not load your documents.'),
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    void listDocuments()
      .then((data) => {
        if (isActive) {
          setDocuments(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setLoadError(
            getDocumentErrorMessage(error, 'We could not load your documents.'),
          )
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
  }, [])

  const handleUploaded = (uploadedDocuments: DocumentRecord[]) => {
    setLoadError(null)
    setIsLoading(false)
    setDocuments((current) => [
      ...uploadedDocuments,
      ...current.filter(
        (item) => !uploadedDocuments.some((uploaded) => uploaded.id === item.id),
      ),
    ])
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          description={`Welcome back, ${displayName}. Upload, review, and create purpose-specific copies of your private documents.`}
          eyebrow="Workspace"
          title="My Documents"
        />
        <button
          className="inline-flex shrink-0 justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          onClick={() => setIsUploadOpen((current) => !current)}
          type="button"
        >
          {isUploadOpen ? 'Close upload' : 'Upload Document'}
        </button>
      </div>

      {navigationMessage ? (
        <div
          className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {navigationMessage}
        </div>
      ) : null}

      {isUploadOpen ? (
        <UploadDocumentPanel
          onClose={() => setIsUploadOpen(false)}
          onUploaded={handleUploaded}
        />
      ) : null}

      <div className="mt-10 flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Document library</h2>
          <p className="mt-1 text-sm text-slate-500">
            {documents.length === 1
              ? '1 private document'
              : `${documents.length} private documents`}
          </p>
        </div>
        {!isLoading ? (
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={loadUserDocuments}
            type="button"
          >
            Refresh
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-6 grid min-h-48 place-items-center rounded-2xl border border-slate-200 bg-white" role="status">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <span
              aria-hidden="true"
              className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 motion-reduce:animate-none"
            />
            Loading documents…
          </div>
        </div>
      ) : loadError ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
          <h3 className="font-semibold text-red-900">Documents unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-red-800">{loadError}</p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={loadUserDocuments}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No documents yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Upload your first document to create a protected watermarked copy.
          </p>
          <button
            className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => setIsUploadOpen(true)}
            type="button"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <DocumentCard document={document} key={document.id} />
          ))}
        </div>
      )}
    </section>
  )
}
