export interface DocumentFileRecord {
  id: string
  document_id: string
  original_name: string
  mime_type: string
  file_size: number
  storage_path: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DocumentRecord {
  id: string
  user_id: string
  name: string
  document_type: string | null
  mime_type: string
  file_size: number
  storage_path: string
  created_at: string
  updated_at: string
  files?: DocumentFileRecord[]
  document_files?: DocumentFileRecord[]
}

export type DocumentKind = 'image' | 'pdf'

export type DocumentUploadMode = 'separate' | 'combined'

export interface DocumentUploadFailure {
  fileName: string
  message: string
}

export interface DocumentUploadBatchResult {
  documents: DocumentRecord[]
  failures: DocumentUploadFailure[]
}

export type SourceMoveDirection = 'up' | 'down'
