export type ReaderMode = 'light' | 'dark' | 'read' | 'low-light' | 'ambient' | 'focus'

export type FontFamilyOption = 'system' | 'serif' | 'sans' | 'mono'
export type SourceTypeFilter = 'all' | 'markdown' | 'text'

export interface ReaderSettings {
  mode: ReaderMode
  fontFamily: FontFamilyOption
  fontSize: number
  lineHeight: number
  contentWidth: number
  centered: boolean
  codeWrap: boolean
  showToc: boolean
  showFileTree: boolean
  showStatusBar: boolean
  autoRefresh: boolean
  focusParagraphs: boolean
}

export interface FileNode {
  id: string
  name: string
  path: string
  kind: 'file' | 'directory'
  extension?: string
  children: FileNode[]
  fileHandle?: FileSystemFileHandle
  directoryHandle?: FileSystemDirectoryHandle
}

export interface TocItem {
  id: string
  depth: number
  text: string
}

export interface ReaderDocument {
  id: string
  title: string
  path: string
  sourceType: 'folder-file' | 'single-file' | 'remote-url' | 'file-url'
  content: string
  updatedAt: number
  fileHandle?: FileSystemFileHandle
  sourceUrl?: string
  fileType: 'markdown' | 'text'
}

export interface RecentDocument {
  id: string
  title: string
  path: string
  sourceType: ReaderDocument['sourceType']
  fileType: ReaderDocument['fileType']
  updatedAt: number
  sourceUrl?: string
}

export interface ProgressRecord {
  documentId: string
  scrollTop: number
  progress: number
  updatedAt: number
}

export interface BookmarkRecord {
  id: string
  documentId: string
  label: string
  headingId?: string
  createdAt: number
}

export interface NoteRecord {
  id: string
  documentId: string
  quote: string
  note: string
  createdAt: number
}

export interface HighlightRecord {
  id: string
  documentId: string
  quote: string
  createdAt: number
}

export interface SearchHit {
  documentId: string
  path: string
  title: string
  snippet: string
  score: number
}

export interface LibraryState {
  recentDocuments: RecentDocument[]
  progressRecords: ProgressRecord[]
  bookmarks: BookmarkRecord[]
  notes: NoteRecord[]
  highlights: HighlightRecord[]
}

export interface PersistedState {
  settings: ReaderSettings
  library: LibraryState
  folderHandle?: FileSystemDirectoryHandle
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  mode: 'dark',
  fontFamily: 'system',
  fontSize: 17,
  lineHeight: 1.7,
  contentWidth: 920,
  centered: true,
  codeWrap: false,
  showToc: true,
  showFileTree: true,
  showStatusBar: true,
  autoRefresh: true,
  focusParagraphs: false,
}

export const EMPTY_LIBRARY: LibraryState = {
  recentDocuments: [],
  progressRecords: [],
  bookmarks: [],
  notes: [],
  highlights: [],
}
