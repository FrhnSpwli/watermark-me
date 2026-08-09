import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  getDocumentErrorMessage,
  uploadDocument,
  validateDocumentFile,
} from '../../services/documents'
import type { DocumentRecord } from '../../types/documents'
import { formatFileSize } from '../../utils/format'

interface UploadDocumentPanelProps {
  onClose: () => void
  onUploaded: (document: DocumentRecord) => void
}

export function UploadDocumentPanel({ onClose, onUploaded }: UploadDocumentPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(null)
    setValidationError(null)
    setSubmissionError(null)
    setSuccessMessage(null)

    if (!file) {
      return
    }

    try {
      validateDocumentFile(file)
      setSelectedFile(file)
    } catch (error) {
      setValidationError(
        getDocumentErrorMessage(error, 'The selected file is not supported.'),
      )
      event.target.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isUploading) {
      return
    }

    if (!selectedFile) {
      setValidationError('Choose a document before uploading.')
      return
    }

    setIsUploading(true)
    setSubmissionError(null)
    setSuccessMessage(null)

    try {
      const document = await uploadDocument(selectedFile)
      onUploaded(document)
      setSuccessMessage(`${document.name} was uploaded securely.`)
      setSelectedFile(null)

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    } catch (error) {
      setSubmissionError(
        getDocumentErrorMessage(error, 'The document could not be uploaded.'),
      )
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section
      aria-busy={isUploading}
      aria-labelledby="upload-document-title"
      className="mt-8 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950" id="upload-document-title">
            Upload document
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Choose a supported original to store in your private document library.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">JPG / JPEG</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">PNG</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">PDF</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">Up to 10 MB</span>
          </div>
        </div>
        <button
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:text-slate-400"
          disabled={isUploading}
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>

      <form className="mt-6" noValidate onSubmit={handleSubmit}>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="document-file">
          Document file
        </label>
        <input
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          aria-describedby={`document-file-help${validationError ? ' document-file-error' : ''}`}
          aria-invalid={Boolean(validationError)}
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-600 shadow-sm outline-none file:mr-4 file:border-0 file:bg-indigo-50 file:px-4 file:py-3 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={isUploading}
          id="document-file"
          onChange={handleFileChange}
          ref={inputRef}
          type="file"
        />
        <p className="mt-2 text-xs leading-5 text-slate-500" id="document-file-help">
          The original will be stored in your private account storage.
        </p>

        {selectedFile ? (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Selected file
            </p>
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-all font-medium text-slate-800">{selectedFile.name}</span>
              <span className="shrink-0 text-slate-500">{formatFileSize(selectedFile.size)}</span>
            </div>
          </div>
        ) : null}

        {validationError ? (
          <p className="mt-4 text-sm text-red-700" id="document-file-error" role="alert">
            {validationError}
          </p>
        ) : null}

        {submissionError ? (
          <div
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
            role="alert"
          >
            {submissionError}
          </div>
        ) : null}

        {successMessage ? (
          <div
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
            role="status"
          >
            {successMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:text-slate-400"
            disabled={isUploading}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
            disabled={isUploading || !selectedFile}
            type="submit"
          >
            {isUploading ? 'Uploading securely…' : 'Upload document'}
          </button>
        </div>
      </form>
    </section>
  )
}
