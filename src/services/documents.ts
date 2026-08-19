import type { PostgrestError, SupabaseClient, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type {
  DocumentFileRecord,
  DocumentKind,
  DocumentRecord,
} from '../types/documents'

export const DOCUMENT_BUCKET = 'documents'
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
export const MAX_DOCUMENT_NAME_LENGTH = 255
export const DOCUMENT_ACCESS_SECONDS = 60

const DOCUMENT_COLUMNS =
  'id,user_id,name,document_type,mime_type,file_size,storage_path,created_at,updated_at'

const DOCUMENT_FILE_COLUMNS =
  'id,document_id,original_name,mime_type,file_size,storage_path,sort_order,created_at,updated_at'

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/pdf': ['pdf'],
}

const SUPPORTED_DOCUMENT_MIME_TYPES = new Set(Object.keys(MIME_EXTENSIONS))

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

function normalizeDocumentPath(storagePath: string) {
  const trimmed = storagePath.trim()

  if (!trimmed) {
    throw new DocumentServiceError('A source storage path is required.', 'validation')
  }

  return trimmed
}

export function createLegacyDocumentSourceFile(
  document: Pick<
    DocumentRecord,
    'id' | 'name' | 'mime_type' | 'file_size' | 'storage_path' | 'created_at' | 'updated_at'
  >,
): DocumentFileRecord {
  return {
    id: document.id,
    document_id: document.id,
    original_name: document.name,
    mime_type: document.mime_type,
    file_size: document.file_size,
    storage_path: normalizeDocumentPath(document.storage_path),
    sort_order: 0,
    created_at: document.created_at,
    updated_at: document.updated_at,
  }
}

export function validateDocumentSourceFileMetadata(
  source: Partial<DocumentFileRecord>,
): DocumentFileRecord {
  const sourceId = source.id ?? ''
  const documentId = source.document_id ?? ''
  const originalName = source.original_name?.trim() ?? ''
  const mimeType = source.mime_type ?? ''
  const storagePath = source.storage_path ? normalizeDocumentPath(source.storage_path) : ''
  const sortOrder = typeof source.sort_order === 'number' ? source.sort_order : Number(source.sort_order)
  const fileSize = typeof source.file_size === 'number' ? source.file_size : Number(source.file_size)

  if (!UUID_PATTERN.test(sourceId)) {
    throw new DocumentServiceError('A valid document-source ID is required.', 'validation')
  }

  if (!UUID_PATTERN.test(documentId)) {
    throw new DocumentServiceError('A valid parent document ID is required.', 'validation')
  }

  if (!originalName || originalName.length > MAX_DOCUMENT_NAME_LENGTH) {
    throw new DocumentServiceError(
      `The source name must be between 1 and ${MAX_DOCUMENT_NAME_LENGTH} characters.`,
      'validation',
    )
  }

  if (!SUPPORTED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    throw new DocumentServiceError('The source file type is not supported.', 'validation')
  }

  if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > MAX_DOCUMENT_SIZE) {
    throw new DocumentServiceError('The source file size is outside the supported range.', 'validation')
  }

  if (!Number.isFinite(sortOrder) || sortOrder < 0) {
    throw new DocumentServiceError('Source ordering must be a non-negative integer.', 'validation')
  }

  if (!storagePath || storagePath.split('/').length < 3 || storagePath.split('/').length > 4) {
    throw new DocumentServiceError(
      'The source storage path must use the document owner path convention.',
      'validation',
    )
  }

  return {
    id: sourceId,
    document_id: documentId,
    original_name: originalName,
    mime_type: mimeType,
    file_size: fileSize,
    storage_path: storagePath,
    sort_order: Math.trunc(sortOrder),
    created_at: source.created_at ?? new Date().toISOString(),
    updated_at: source.updated_at ?? new Date().toISOString(),
  }
}

function normalizeDocumentFiles(
  document: DocumentRecord & { document_files?: DocumentFileRecord[] },
): DocumentFileRecord[] {
  const providedFiles = Array.isArray(document.files)
    ? document.files
    : Array.isArray(document.document_files)
      ? document.document_files
      : []

  if (providedFiles.length > 0) {
    return providedFiles.map((file) =>
      validateDocumentSourceFileMetadata({
        ...file,
        document_id: file.document_id || document.id,
        original_name: file.original_name || document.name,
      }),
    )
  }

  return [createLegacyDocumentSourceFile(document)]
}

export function normalizeDocumentRecord(
  document: DocumentRecord & { document_files?: DocumentFileRecord[] },
): DocumentRecord & { files: DocumentFileRecord[] } {
  const files = normalizeDocumentFiles(document)
  const orderedFiles = [...files].sort((left, right) => left.sort_order - right.sort_order)

  return {
    ...document,
    files: orderedFiles,
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
    .select(`${DOCUMENT_COLUMNS},document_files(${DOCUMENT_FILE_COLUMNS})`)
    .order('created_at', { ascending: false })
    .returns<Array<DocumentRecord & { document_files?: DocumentFileRecord[] }>>()

  if (error) {
    logServiceError('list failed', error)
    throw getSafeQueryError(error, 'We could not load your documents. Please try again.')
  }

  return (data ?? []).map((document) => normalizeDocumentRecord(document))
}

export async function getDocument(documentId: string): Promise<DocumentRecord> {
  validateDocumentId(documentId)
  const { client } = await getAuthenticatedClient()
  const { data, error } = await client
    .from('documents')
    .select(`${DOCUMENT_COLUMNS},document_files(${DOCUMENT_FILE_COLUMNS})`)
    .eq('id', documentId)
    .maybeSingle<DocumentRecord & { document_files?: DocumentFileRecord[] }>()

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

  return normalizeDocumentRecord(data)
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
  const storagePaths = [...new Set(document.files?.map((file) => file.storage_path) ?? [document.storage_path])]
  const { client } = await getAuthenticatedClient()
  const { error: storageError } = await client.storage
    .from(DOCUMENT_BUCKET)
    .remove(storagePaths)

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
  const primarySource = document.files?.[0] ?? createLegacyDocumentSourceFile(document)
  const { client } = await getAuthenticatedClient()
  const { data, error } = await client.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(primarySource.storage_path, DOCUMENT_ACCESS_SECONDS)

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
