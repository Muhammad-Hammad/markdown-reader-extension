import { openDB } from 'idb'
import { DEFAULT_SETTINGS, EMPTY_LIBRARY, type LibraryState, type PersistedState, type ReaderSettings } from './types'

interface ReaderDb {
  settings: {
    key: string
    value: ReaderSettings
  }
  library: {
    key: string
    value: LibraryState
  }
  handles: {
    key: string
    value: FileSystemDirectoryHandle
  }
}

const DB_NAME = 'markdown-reader-db'
const DB_VERSION = 1
const SETTINGS_KEY = 'reader-settings'
const LIBRARY_KEY = 'reader-library'
const FOLDER_HANDLE_KEY = 'folder-handle'

async function getDatabase() {
  return openDB<ReaderDb>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('settings')
      database.createObjectStore('library')
      database.createObjectStore('handles')
    },
  })
}

export async function loadPersistedState(): Promise<PersistedState> {
  const database = await getDatabase()
  const [settings, library, folderHandle] = await Promise.all([
    database.get('settings', SETTINGS_KEY),
    database.get('library', LIBRARY_KEY),
    database.get('handles', FOLDER_HANDLE_KEY),
  ])

  return {
    settings: settings ?? DEFAULT_SETTINGS,
    library: library ?? EMPTY_LIBRARY,
    folderHandle,
  }
}

export async function saveSettings(settings: ReaderSettings) {
  const database = await getDatabase()
  await database.put('settings', settings, SETTINGS_KEY)
}

export async function saveLibrary(library: LibraryState) {
  const database = await getDatabase()
  await database.put('library', library, LIBRARY_KEY)
}

export async function saveFolderHandle(folderHandle?: FileSystemDirectoryHandle) {
  const database = await getDatabase()

  if (!folderHandle) {
    await database.delete('handles', FOLDER_HANDLE_KEY)
    return
  }

  await database.put('handles', folderHandle, FOLDER_HANDLE_KEY)
}
