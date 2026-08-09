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
}

export type DocumentKind = 'image' | 'pdf'
