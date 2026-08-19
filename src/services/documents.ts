import type { PostgrestError, SupabaseClient, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type {
  DocumentFileRecord,
  DocumentKind,
  DocumentUploadBatchResult,
  DocumentUploadFailure,
  DocumentUploadMode,
  DocumentRecord,
  SourceMoveDirection,
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

export function createDocumentSourceStoragePath(
  userId: string,
  documentId: string,
  fileId: string,
  extension: string,
) {
  return `${userId}/${documentId}/${fileId}/original.${extension}`
}

export function sortDocumentSources(sources: DocumentFileRecord[]) {
  return [...sources].sort((left, right) => left.sort_order - right.sort_order)
}

export function getNextSourceOrder(sources: DocumentFileRecord[]) {
  return sources.length === 0
    ? 0
    : Math.max(...sources.map((source) => source.sort_order)) + 1
}

export function moveDocumentSource(
  sources: DocumentFileRecord[],
  sourceId: string,
  direction: SourceMoveDirection,
) {
  const orderedSources = sortDocumentSources(sources)
  const sourceIndex = orderedSources.findIndex((source) => source.id === sourceId)
  const targetIndex = direction === 'up' ? sourceIndex - 1 : sourceIndex + 1

  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= orderedSources.length) {
    return orderedSources.map((source, sortOrder) => ({ ...source, sort_order: sortOrder }))
  }

  const nextSources = [...orderedSources]
  const [source] = nextSources.splice(sourceIndex, 1)
  nextSources.splice(targetIndex, 0, source)

  return nextSources.map((nextSource, sortOrder) => ({
    ...nextSource,
    sort_order: sortOrder,
  }))
}

export function removeDocumentSourceFromList(
  sources: DocumentFileRecord[],
  sourceId: string,
) {
  if (sources.length <= 1) {
    throw new DocumentServiceError(
      'A document must keep at least one source. Delete the document to remove its final source.',
      'validation',
    )
  }

  return sortDocumentSources(sources)
    .filter((source) => source.id !== sourceId)
    .map((source, sortOrder) => ({ ...source, sort_order: sortOrder }))
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

async function uploadStorageObject(
  client: SupabaseClient,
  file: File,
  storagePath: string,
) {
  const { error } = await client.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  })

  if (!error) {
    return
  }

  logServiceError('storage upload failed', error)
  throw new DocumentServiceError(
    isNetworkError(error)
      ? 'The upload could not reach private storage. Check your connection and try again.'
      : 'The file could not be uploaded to private storage. Please try again.',
    isNetworkError(error) ? 'network' : 'upload',
  )
}

async function removeStorageObjects(client: SupabaseClient, storagePaths: string[]) {
  const paths = [...new Set(storagePaths)]

  if (paths.length === 0) {
    return
  }

  const { error } = await client.storage.from(DOCUMENT_BUCKET).remove(paths)

  if (error) {
    logServiceError('storage rollback failed', error)
    throw new DocumentServiceError(
      'The uploaded file could not be cleaned up automatically. Do not retry yet; contact the project administrator.',
      'rollback-failed',
    )
  }
}

async function insertDocumentMetadata(
  client: SupabaseClient,
  document: Pick<DocumentRecord, 'id' | 'user_id' | 'name' | 'document_type' | 'mime_type' | 'file_size' | 'storage_path'>,
) {
  const { data, error } = await client
    .from('documents')
    .insert(document)
    .select(DOCUMENT_COLUMNS)
    .single<DocumentRecord>()

  if (error || !data) {
    logServiceError('document metadata insert failed', error)
    throw getSafeQueryError(error, 'The document metadata could not be saved.')
  }

  return data
}

async function insertDocumentFile(client: SupabaseClient, source: DocumentFileRecord) {
  const { error } = await client.from('document_files').insert({
    id: source.id,
    document_id: source.document_id,
    original_name: source.original_name,
    mime_type: source.mime_type,
    file_size: source.file_size,
    storage_path: source.storage_path,
    sort_order: source.sort_order,
  })

  if (error) {
    logServiceError('document source insert failed', error)
    throw getSafeQueryError(error, 'The document source metadata could not be saved.')
  }
}

function createSourceMetadata(
  file: File,
  documentId: string,
  fileId: string,
  userId: string,
  sortOrder: number,
): DocumentFileRecord {
  const validatedFile = validateDocumentFile(file)
  const now = new Date().toISOString()

  return validateDocumentSourceFileMetadata({
    id: fileId,
    document_id: documentId,
    original_name: file.name.trim(),
    mime_type: file.type,
    file_size: file.size,
    storage_path: createDocumentSourceStoragePath(
      userId,
      documentId,
      fileId,
      validatedFile.extension,
    ),
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  })
}

function getDocumentFieldsFromSource(
  userId: string,
  name: string,
  source: DocumentFileRecord,
) {
  return {
    id: source.document_id,
    user_id: userId,
    name: validateDocumentName(name),
    document_type: source.mime_type === 'application/pdf' ? 'pdf' : 'image',
    mime_type: source.mime_type,
    file_size: source.file_size,
    storage_path: source.storage_path,
  } as const
}

export async function uploadSeparateDocuments(files: File[]): Promise<DocumentUploadBatchResult> {
  const { client, user } = await getAuthenticatedClient()
  const documents: DocumentRecord[] = []
  const failures: DocumentUploadFailure[] = []

  for (const file of files) {
    let storagePath: string | null = null
    let documentId: string | null = null
    let parentCreated = false

    try {
      const validatedFile = validateDocumentFile(file)
      documentId = createDocumentId()
      const fileId = createDocumentId()
      storagePath = createDocumentSourceStoragePath(
        user.id,
        documentId,
        fileId,
        validatedFile.extension,
      )
      const source = createSourceMetadata(file, documentId, fileId, user.id, 0)

      await uploadStorageObject(client, file, storagePath)
      const document = await insertDocumentMetadata(
        client,
        getDocumentFieldsFromSource(user.id, file.name, source),
      )
      parentCreated = true
      await insertDocumentFile(client, source)
      documents.push(normalizeDocumentRecord({ ...document, document_files: [source] }))
    } catch (error) {
      if (storagePath) {
        try {
          await removeStorageObjects(client, [storagePath])
          if (parentCreated && documentId) {
            const { error: deleteError } = await client
              .from('documents')
              .delete()
              .eq('id', documentId)
            if (deleteError) {
              throw deleteError
            }
          }
        } catch (cleanupError) {
          logServiceError('separate upload cleanup failed', cleanupError)
          failures.push({
            fileName: file.name,
            message: 'The upload failed and its private file could not be cleaned up automatically.',
          })
          continue
        }
      }

      failures.push({
        fileName: file.name,
        message: getDocumentErrorMessage(error, 'This file could not be uploaded.'),
      })
    }
  }

  return { documents, failures }
}

export async function uploadCombinedDocument(
  files: File[],
  name: string,
): Promise<DocumentRecord> {
  if (files.length < 2) {
    throw new DocumentServiceError(
      'Choose at least two files to create a combined document.',
      'validation',
    )
  }

  const normalizedName = validateDocumentName(name)
  files.forEach((file) => validateDocumentFile(file))
  const { client, user } = await getAuthenticatedClient()
  const documentId = createDocumentId()
  const sources = files.map((file, index) =>
    createSourceMetadata(file, documentId, createDocumentId(), user.id, index),
  )
  const uploadedPaths: string[] = []
  let parentCreated = false

  try {
    for (let index = 0; index < files.length; index += 1) {
      await uploadStorageObject(client, files[index], sources[index].storage_path)
      uploadedPaths.push(sources[index].storage_path)
    }

    const document = await insertDocumentMetadata(
      client,
      getDocumentFieldsFromSource(user.id, normalizedName, sources[0]),
    )
    parentCreated = true

    for (const source of sources) {
      await insertDocumentFile(client, source)
    }

    return normalizeDocumentRecord({ ...document, document_files: sources })
  } catch (error) {
    try {
      await removeStorageObjects(client, uploadedPaths)
      if (parentCreated) {
        const { error: deleteError } = await client
          .from('documents')
          .delete()
          .eq('id', documentId)
        if (deleteError) {
          throw deleteError
        }
      }
    } catch (cleanupError) {
      logServiceError('combined upload cleanup failed', cleanupError)
      throw new DocumentServiceError(
        'The combined upload failed and automatic cleanup was incomplete. Contact the project administrator before retrying.',
        'rollback-failed',
      )
    }

    throw new DocumentServiceError(
      getDocumentErrorMessage(error, 'The combined document could not be uploaded. All uploaded files were removed.'),
      error instanceof DocumentServiceError ? error.code : 'upload',
    )
  }
}

export async function uploadDocuments(
  files: File[],
  mode: DocumentUploadMode,
  combinedName?: string,
): Promise<DocumentUploadBatchResult> {
  if (files.length === 0) {
    throw new DocumentServiceError('Choose at least one document before uploading.', 'validation')
  }

  if (mode === 'combined') {
    const document = await uploadCombinedDocument(files, combinedName ?? files[0].name)
    return { documents: [document], failures: [] }
  }

  return uploadSeparateDocuments(files)
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const result = await uploadSeparateDocuments([file])

  if (result.documents[0]) {
    return result.documents[0]
  }

  throw new DocumentServiceError(
    result.failures[0]?.message ?? 'The document could not be uploaded.',
    'upload',
  )
}

async function updateDocumentCompatibilityMirror(
  client: SupabaseClient,
  document: DocumentRecord,
  source: DocumentFileRecord,
) {
  const { error } = await client
    .from('documents')
    .update({
      document_type: source.mime_type === 'application/pdf' ? 'pdf' : 'image',
      mime_type: source.mime_type,
      file_size: source.file_size,
      storage_path: source.storage_path,
    })
    .eq('id', document.id)

  if (error) {
    logServiceError('compatibility mirror update failed', error)
    throw getSafeQueryError(error, 'The document source order was not fully saved.')
  }
}

async function rewriteSourceOrder(
  client: SupabaseClient,
  sources: DocumentFileRecord[],
) {
  const orderedSources = sortDocumentSources(sources)
  const temporaryOffset = 1000000

  for (let index = 0; index < orderedSources.length; index += 1) {
    const { error } = await client
      .from('document_files')
      .update({ sort_order: temporaryOffset + index })
      .eq('id', orderedSources[index].id)

    if (error) {
      logServiceError('temporary source order update failed', error)
      throw getSafeQueryError(error, 'The source order could not be saved.')
    }
  }

  for (let index = 0; index < orderedSources.length; index += 1) {
    const { error } = await client
      .from('document_files')
      .update({ sort_order: index })
      .eq('id', orderedSources[index].id)

    if (error) {
      logServiceError('source order update failed', error)
      throw getSafeQueryError(error, 'The source order could not be saved.')
    }
  }
}

export async function addDocumentSource(
  documentId: string,
  file: File,
): Promise<DocumentRecord> {
  validateDocumentId(documentId)
  const document = await getDocument(documentId)
  const { client, user } = await getAuthenticatedClient()
  const fileId = createDocumentId()
  const source = createSourceMetadata(
    file,
    document.id,
    fileId,
    user.id,
    getNextSourceOrder(document.files ?? []),
  )

  await uploadStorageObject(client, file, source.storage_path)

  try {
    await insertDocumentFile(client, source)
  } catch (error) {
    try {
      await removeStorageObjects(client, [source.storage_path])
    } catch (cleanupError) {
      logServiceError('add source cleanup failed', cleanupError)
      throw cleanupError
    }

    throw error
  }

  return getDocument(document.id)
}

export async function reorderDocumentSources(
  documentId: string,
  sourceId: string,
  direction: SourceMoveDirection,
): Promise<DocumentRecord> {
  validateDocumentId(documentId)
  const document = await getDocument(documentId)
  const currentSources = document.files ?? []
  const nextSources = moveDocumentSource(currentSources, sourceId, direction)

  if (!currentSources.some((source) => source.id === sourceId)) {
    throw new DocumentServiceError('The selected source was not found.', 'not-found')
  }

  const { client } = await getAuthenticatedClient()
  await rewriteSourceOrder(client, nextSources)

  if (nextSources[0].storage_path !== document.storage_path) {
    await updateDocumentCompatibilityMirror(client, document, nextSources[0])
  }

  return getDocument(document.id)
}

export async function removeDocumentSource(
  documentId: string,
  sourceId: string,
): Promise<DocumentRecord> {
  validateDocumentId(documentId)
  const document = await getDocument(documentId)
  const currentSources = document.files ?? []
  const source = currentSources.find((candidate) => candidate.id === sourceId)

  if (!source) {
    throw new DocumentServiceError('The selected source was not found.', 'not-found')
  }

  const nextSources = removeDocumentSourceFromList(currentSources, sourceId)
  const { client } = await getAuthenticatedClient()

  await removeStorageObjects(client, [source.storage_path])

  const { data, error } = await client
    .from('document_files')
    .delete()
    .eq('id', sourceId)
    .eq('document_id', document.id)
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error || !data) {
    logServiceError('source metadata delete failed after storage delete', error)
    throw new DocumentServiceError(
      'The source file was deleted from storage, but its metadata could not be removed. Contact the project administrator before retrying.',
      'partial-delete',
    )
  }

  try {
    await rewriteSourceOrder(client, nextSources)
    await updateDocumentCompatibilityMirror(client, document, nextSources[0])
  } catch (error) {
    throw new DocumentServiceError(
      getDocumentErrorMessage(
        error,
        'The source was removed, but the remaining source metadata could not be fully normalized.',
      ),
      'partial-delete',
    )
  }

  return getDocument(document.id)
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
    .select(`${DOCUMENT_COLUMNS},document_files(${DOCUMENT_FILE_COLUMNS})`)
    .maybeSingle<DocumentRecord & { document_files?: DocumentFileRecord[] }>()

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

  return normalizeDocumentRecord(data)
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

export async function createDocumentAccessUrl(
  documentId: string,
  sourceId?: string,
): Promise<string> {
  const document = await getDocument(documentId)
  const sources = document.files ?? [createLegacyDocumentSourceFile(document)]
  if (!sourceId && sources.length > 1) {
    throw new DocumentServiceError(
      'Choose a specific source to view from this multi-source document.',
      'validation',
    )
  }

  const primarySource = sourceId
    ? sources.find((source) => source.id === sourceId)
    : sources[0]
  if (!primarySource) {
    throw new DocumentServiceError('The selected source was not found.', 'not-found')
  }
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
