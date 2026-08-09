import type { PostgrestError, SupabaseClient, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { DocumentKind, DocumentRecord } from '../types/documents'

export const DOCUMENT_BUCKET = 'documents'
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
export const MAX_DOCUMENT_NAME_LENGTH = 255
export const DOCUMENT_ACCESS_SECONDS = 60

const DOCUMENT_COLUMNS =
  'id,user_id,name,document_type,mime_type,file_size,storage_path,created_at,updated_at'

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/pdf': ['pdf'],
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type DocumentServiceErrorCode =
  | 'authentication'
  | 'validation'
  | 'not-found'
  | 'upload'
  | 'rollback-failed'
  | 'partial-delete'
  | 'access'
  | 'network'
  | 'unexpected'

export class DocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly code: DocumentServiceErrorCode = 'unexpected',
  ) {
    super(message)
    this.name = 'DocumentServiceError'
  }
}

interface ValidatedDocumentFile {
  extension: string
  documentType: DocumentKind
}

interface AuthenticatedClient {
  client: SupabaseClient
  user: User
}

function isNetworkError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|network|load failed/i.test(error.message))
  )
}

function getPostgrestCode(error: unknown) {
  return (error as Partial<PostgrestError> | null)?.code
}

function logServiceError(operation: string, error: unknown) {
  console.error(`[documents] ${operation}`, error)
}

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new DocumentServiceError(
      'Document storage is not configured. Check the Supabase environment variables.',
      'authentication',
    )
  }

  return supabase
}

async function getAuthenticatedClient(): Promise<AuthenticatedClient> {
  const client = requireClient()
  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error) {
    logServiceError('get authenticated user failed', error)
    throw new DocumentServiceError(
      isNetworkError(error)
        ? 'Unable to reach the authentication service. Check your connection and try again.'
        : 'Your session could not be verified. Please log in again.',
      isNetworkError(error) ? 'network' : 'authentication',
    )
  }

  if (!user) {
    throw new DocumentServiceError('You must be logged in to manage documents.', 'authentication')
  }

  return { client, user }
}

function getFileExtension(filename: string) {
  const match = filename.toLowerCase().match(/\.([^.]+)$/)
  return match?.[1] ?? ''
}

export function validateDocumentFile(file: File): ValidatedDocumentFile {
  const extension = getFileExtension(file.name)
  const allowedExtensions = MIME_EXTENSIONS[file.type]

  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    throw new DocumentServiceError(
      'Choose a JPG, JPEG, PNG, or PDF file whose extension matches its file type.',
      'validation',
    )
  }

  const normalizedName = file.name.trim()

  if (!normalizedName || normalizedName.length > MAX_DOCUMENT_NAME_LENGTH) {
    throw new DocumentServiceError(
      `The filename must be between 1 and ${MAX_DOCUMENT_NAME_LENGTH} characters.`,
      'validation',
    )
  }

  if (file.size < 1) {
    throw new DocumentServiceError('The selected file is empty.', 'validation')
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new DocumentServiceError('The selected file is larger than the 10 MB limit.', 'validation')
  }

  return {
    extension,
    documentType: file.type === 'application/pdf' ? 'pdf' : 'image',
  }
}

export function validateDocumentName(name: string) {
  const normalizedName = name.trim()

  if (!normalizedName) {
    throw new DocumentServiceError('Document name cannot be empty.', 'validation')
  }

  if (normalizedName.length > MAX_DOCUMENT_NAME_LENGTH) {
    throw new DocumentServiceError(
      `Document name must be ${MAX_DOCUMENT_NAME_LENGTH} characters or fewer.`,
      'validation',
    )
  }

  return normalizedName
}

function createDocumentId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new DocumentServiceError(
      'This browser cannot generate a secure document ID. Use a current browser over HTTPS or localhost.',
      'validation',
    )
  }

  return globalThis.crypto.randomUUID()
}

function validateDocumentId(documentId: string) {
  if (!UUID_PATTERN.test(documentId)) {
    throw new DocumentServiceError(
      'This document was not found or is not available to your account.',
      'not-found',
    )
  }
}

function getSafeQueryError(error: unknown, fallback: string) {
  if (isNetworkError(error)) {
    return new DocumentServiceError(
      'Unable to reach document storage. Check your connection and try again.',
      'network',
    )
  }

  const code = getPostgrestCode(error)

  if (code === '42501') {
    return new DocumentServiceError('You do not have permission to access this document.', 'access')
  }

  if (code === '23505') {
    return new DocumentServiceError('A document with this storage path already exists.', 'upload')
  }

  if (code === '23514' || code === '22001') {
    return new DocumentServiceError('The document metadata is not valid.', 'validation')
  }

  return new DocumentServiceError(fallback)
}

export function getDocumentErrorMessage(error: unknown, fallback: string) {
  return error instanceof DocumentServiceError ? error.message : fallback
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const { client } = await getAuthenticatedClient()
  const { data, error } = await client
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .order('created_at', { ascending: false })
    .returns<DocumentRecord[]>()

  if (error) {
    logServiceError('list failed', error)
    throw getSafeQueryError(error, 'We could not load your documents. Please try again.')
  }

  return data ?? []
}

export async function getDocument(documentId: string): Promise<DocumentRecord> {
  validateDocumentId(documentId)
  const { client } = await getAuthenticatedClient()
  const { data, error } = await client
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('id', documentId)
    .maybeSingle<DocumentRecord>()

  if (error) {
    logServiceError('get failed', error)
    throw getSafeQueryError(error, 'We could not load this document.')
  }

  if (!data) {
    throw new DocumentServiceError(
      'This document was not found or is not available to your account.',
      'not-found',
    )
  }

  return data
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const validatedFile = validateDocumentFile(file)
  const { client, user } = await getAuthenticatedClient()
  const documentId = createDocumentId()
  const storagePath = `${user.id}/${documentId}/original.${validatedFile.extension}`

  const { error: uploadError } = await client.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    logServiceError('storage upload failed', uploadError)
    throw new DocumentServiceError(
      isNetworkError(uploadError)
        ? 'The upload could not reach private storage. Check your connection and try again.'
        : 'The file could not be uploaded to private storage. Please try again.',
      isNetworkError(uploadError) ? 'network' : 'upload',
    )
  }

  const { data, error: metadataError } = await client
    .from('documents')
    .insert({
      id: documentId,
      user_id: user.id,
      name: file.name.trim(),
      document_type: validatedFile.documentType,
      mime_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
    })
    .select(DOCUMENT_COLUMNS)
    .single<DocumentRecord>()

  if (!metadataError && data) {
    return data
  }

  logServiceError('metadata insert failed', metadataError)
  const { error: rollbackError } = await client.storage
    .from(DOCUMENT_BUCKET)
    .remove([storagePath])

  if (rollbackError) {
    logServiceError('upload rollback failed', rollbackError)
    throw new DocumentServiceError(
      'The metadata could not be saved and automatic file cleanup also failed. Do not retry yet; contact the project administrator with the time of this error.',
      'rollback-failed',
    )
  }

  throw getSafeQueryError(
    metadataError,
    'The document metadata could not be saved. The uploaded file was removed safely.',
  )
}

export async function renameDocument(
  documentId: string,
  name: string,
): Promise<DocumentRecord> {
  validateDocumentId(documentId)
  const normalizedName = validateDocumentName(name)
  const { client } = await getAuthenticatedClient()
  const { data, error } = await client
    .from('documents')
    .update({ name: normalizedName })
    .eq('id', documentId)
    .select(DOCUMENT_COLUMNS)
    .maybeSingle<DocumentRecord>()

  if (error) {
    logServiceError('rename failed', error)
    throw getSafeQueryError(error, 'We could not rename this document.')
  }

  if (!data) {
    throw new DocumentServiceError(
      'This document was not found or is not available to your account.',
      'not-found',
    )
  }

  return data
}

export async function deleteDocument(documentId: string): Promise<void> {
  const document = await getDocument(documentId)
  const { client } = await getAuthenticatedClient()
  const { error: storageError } = await client.storage
    .from(DOCUMENT_BUCKET)
    .remove([document.storage_path])

  if (storageError) {
    logServiceError('storage delete failed', storageError)
    throw new DocumentServiceError(
      'The private file could not be deleted, so its metadata was kept. Please try again.',
      isNetworkError(storageError) ? 'network' : 'access',
    )
  }

  const { data, error: metadataError } = await client
    .from('documents')
    .delete()
    .eq('id', documentId)
    .select('id')
    .maybeSingle<{ id: string }>()

  if (metadataError || !data) {
    logServiceError('metadata delete failed after storage delete', metadataError)
    throw new DocumentServiceError(
      'The original file was deleted, but its metadata could not be removed. Retry deletion to finish cleanup.',
      'partial-delete',
    )
  }
}

export async function createDocumentAccessUrl(documentId: string): Promise<string> {
  const document = await getDocument(documentId)
  const { client } = await getAuthenticatedClient()
  const { data, error } = await client.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, DOCUMENT_ACCESS_SECONDS)

  if (error || !data?.signedUrl) {
    logServiceError('signed URL creation failed', error)
    throw new DocumentServiceError(
      isNetworkError(error)
        ? 'Unable to reach private storage. Check your connection and try again.'
        : 'A private access link could not be created for this document.',
      isNetworkError(error) ? 'network' : 'access',
    )
  }

  return data.signedUrl
}
