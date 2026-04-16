import Fuse from 'fuse.js'
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { MODE_CYCLE } from '../constants'
import { loadPersistedState, saveFolderHandle, saveLibrary, saveSettings } from '../../shared/db'
import {
  buildSearchIndex,
  ensurePermission,
  filterTree,
  flattenTree,
  readDroppedFile,
  readFileHandle,
  readFromSourceUrl,
  readNodeDocument,
  scanDirectory,
} from '../../shared/fs'
import {
  DEFAULT_SETTINGS,
  EMPTY_LIBRARY,
  type BookmarkRecord,
  type HighlightRecord,
  type NoteRecord,
  type FileNode,
  type ReaderDocument,
  type ReaderSettings,
  type RecentDocument,
  type SearchHit,
  type SourceTypeFilter,
} from '../../shared/types'
import {
  buildExportHtml,
  collectDirectoryPaths,
  downloadTextFile,
  findNodeById,
  getErrorMessage,
  joinPathSegments,
} from '../utils'

export function useReaderWorkspace() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [library, setLibrary] = useState(EMPTY_LIBRARY)
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle>()
  const [tree, setTree] = useState<FileNode[]>(EMPTY_TREE)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']))
  const [activeDocument, setActiveDocument] = useState<ReaderDocument>()
  const [fileFilter, setFileFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<SourceTypeFilter>('all')
  const [tocFilter, setTocFilter] = useState('')
  const [sourceInput, setSourceInput] = useState('')
  const [statusMessage, setStatusMessage] = useState(DEFAULT_STATUS_MESSAGE)
  const [searchIndex, setSearchIndex] = useState<SearchHit[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [activeHeadingId, setActiveHeadingId] = useState('')
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [currentSelection, setCurrentSelection] = useState('')
  const [progress, setProgress] = useState(0)

  const treeScrollRef = useRef<HTMLDivElement | null>(null)
  const contentScrollRef = useRef<HTMLDivElement | null>(null)
  const articleRef = useRef<HTMLElement | null>(null)
  const contentSearchInputRef = useRef<HTMLInputElement | null>(null)
  const fileSearchInputRef = useRef<HTMLInputElement | null>(null)

  const updateSettings = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      void saveSettings(next)
      return next
    })
  }, [])

  const updateLibrary = useCallback((updater: (current: typeof EMPTY_LIBRARY) => typeof EMPTY_LIBRARY) => {
    setLibrary((current) => {
      const next = updater(current)
      void saveLibrary(next)
      return next
    })
  }, [])

  const cycleMode = useCallback(() => {
    const currentIndex = MODE_CYCLE.indexOf(settings.mode)
    const nextMode = MODE_CYCLE[(currentIndex + 1) % MODE_CYCLE.length]
    updateSettings({
      mode: nextMode,
      focusParagraphs: nextMode === 'focus',
    })
  }, [settings.mode, updateSettings])

  const setDocument = useCallback((document: ReaderDocument) => {
    setActiveDocument(document)
    if (document.sourceType === 'folder-file') {
      setExpandedPaths((current) => new Set([...current, ...document.path.split('/').slice(0, -1).map(joinPathSegments)]))
    }
  }, [])

  const refreshTreeFromHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setIsScanning(true)
    try {
      const scannedTree = await scanDirectory(handle)
      setTree(scannedTree)
      setExpandedPaths(new Set(['/', ...collectDirectoryPaths(scannedTree)]))
      return scannedTree
    } finally {
      setIsScanning(false)
    }
  }, [])

  const openFolder = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker()
      const hasPermission = await ensurePermission(handle)
      if (!hasPermission) {
        setStatusMessage('Folder permission was not granted.')
        return
      }

      await refreshTreeFromHandle(handle)
      setFolderHandle(handle)
      await saveFolderHandle(handle)
      setStatusMessage(`Loaded folder ${handle.name}`)
    } catch (error) {
      setStatusMessage(getErrorMessage(error))
    }
  }, [refreshTreeFromHandle])

  const openSingleFile = useCallback(async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Markdown or text',
            accept: {
              'text/plain': ['.md', '.markdown', '.txt'],
            },
          },
        ],
        excludeAcceptAllOption: false,
        multiple: false,
      })

      const hasPermission = await ensurePermission(fileHandle)
      if (!hasPermission) {
        setStatusMessage('File permission was not granted.')
        return
      }

      const document = await readFileHandle(fileHandle, fileHandle.name)
      setDocument(document)
    } catch (error) {
      setStatusMessage(getErrorMessage(error))
    }
  }, [setDocument])

  const openSource = useCallback(async () => {
    try {
      const document = await readFromSourceUrl(sourceInput)
      setDocument(document)
    } catch (error) {
      setStatusMessage(getErrorMessage(error))
    }
  }, [setDocument, sourceInput])

  const refreshFolder = useCallback(async () => {
    if (!folderHandle) {
      setStatusMessage('Open a folder first.')
      return
    }

    await refreshTreeFromHandle(folderHandle)
    setStatusMessage(`Rescanned ${folderHandle.name}`)
  }, [folderHandle, refreshTreeFromHandle])

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const file = event.dataTransfer.files.item(0)
      if (file) {
        const document = await readDroppedFile(file)
        setDocument(document)
        return
      }

      const droppedText = event.dataTransfer.getData('text/plain')
      if (droppedText) {
        setSourceInput(droppedText)
        const document = await readFromSourceUrl(droppedText)
        setDocument(document)
      }
    },
    [setDocument],
  )

  const toggleDirectory = useCallback((path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const jumpToHeading = useCallback((headingId: string) => {
    const heading = articleRef.current?.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`)
    heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveHeadingId(headingId)
  }, [])

  const bookmarkCurrentSection = useCallback(
    (label: string, headingId?: string) => {
      if (!activeDocument) {
        setStatusMessage('Open a document first.')
        return
      }

      const bookmark: BookmarkRecord = {
        id: `${activeDocument.id}-${Date.now()}`,
        documentId: activeDocument.id,
        label,
        headingId,
        createdAt: Date.now(),
      }

      updateLibrary((current) => ({
        ...current,
        bookmarks: [bookmark, ...current.bookmarks],
      }))
      setStatusMessage(`Bookmarked ${label}`)
    },
    [activeDocument, updateLibrary],
  )

  const saveSelectionAsHighlight = useCallback(() => {
    if (!activeDocument || !currentSelection) {
      setStatusMessage('Select text inside the document first.')
      return
    }

    const highlight: HighlightRecord = {
      id: `${activeDocument.id}-highlight-${Date.now()}`,
      documentId: activeDocument.id,
      quote: currentSelection,
      createdAt: Date.now(),
    }

    updateLibrary((current) => ({
      ...current,
      highlights: [highlight, ...current.highlights],
    }))
    setStatusMessage('Saved selection as a highlight.')
  }, [activeDocument, currentSelection, updateLibrary])

  const saveSelectionAsNote = useCallback(() => {
    if (!activeDocument || !currentSelection) {
      setStatusMessage('Select text inside the document first.')
      return
    }

    const noteText = window.prompt('Add a note for the selected text:')
    if (!noteText) {
      return
    }

    const note: NoteRecord = {
      id: `${activeDocument.id}-note-${Date.now()}`,
      documentId: activeDocument.id,
      quote: currentSelection,
      note: noteText.trim(),
      createdAt: Date.now(),
    }

    updateLibrary((current) => ({
      ...current,
      notes: [note, ...current.notes],
    }))
    setStatusMessage('Saved a note for the current selection.')
  }, [activeDocument, currentSelection, updateLibrary])

  const exportSettings = useCallback(() => {
    downloadTextFile('markdown-reader-settings.json', JSON.stringify(settings, null, 2), 'application/json')
  }, [settings])

  const exportHtml = useCallback(() => {
    if (!activeDocument || !articleRef.current) {
      setStatusMessage('Open a document before exporting.')
      return
    }

    const html = buildExportHtml(activeDocument.title, articleRef.current.innerHTML)
    downloadTextFile(`${activeDocument.title}.html`, html, 'text/html')
    setStatusMessage(`Exported ${activeDocument.title}.html`)
  }, [activeDocument])

  const exportHighlights = useCallback(
    (quotes: string[]) => {
      if (!activeDocument) {
        return
      }

      downloadTextFile(`${activeDocument.title}-highlights.md`, quotes.map((item) => `- ${item}`).join('\n'), 'text/markdown')
    },
    [activeDocument],
  )

  const importSettingsFromFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.item(0)
      if (!file) {
        return
      }

      try {
        const parsed = JSON.parse(await file.text()) as Partial<ReaderSettings>
        updateSettings(parsed)
        setStatusMessage('Imported settings from JSON.')
      } catch {
        setStatusMessage('The selected file is not valid settings JSON.')
      }
    },
    [updateSettings],
  )

  const openRecentDocument = useCallback(
    async (documentId: string, sourceUrl?: string) => {
      const targetNode = findNodeById(tree, documentId)
      if (targetNode) {
        const document = await readNodeDocument(targetNode)
        setDocument(document)
        return
      }

      if (sourceUrl) {
        setSourceInput(sourceUrl)
        const document = await readFromSourceUrl(sourceUrl)
        setDocument(document)
      }
    },
    [setDocument, tree],
  )

  useEffect(() => {
    void (async () => {
      const persisted = await loadPersistedState()
      setSettings(persisted.settings)
      setLibrary(persisted.library)

      if (persisted.folderHandle && (await ensurePermission(persisted.folderHandle))) {
        setFolderHandle(persisted.folderHandle)
        setStatusMessage(`Restored folder: ${persisted.folderHandle.name}`)
        await refreshTreeFromHandle(persisted.folderHandle)
      }
    })()
  }, [refreshTreeFromHandle])

  useEffect(() => {
    if (!folderHandle) {
      setSearchIndex([])
      return
    }

    let cancelled = false
    setIsSearching(true)

    void (async () => {
      const hits = await buildSearchIndex(tree)
      if (!cancelled) {
        setSearchIndex(hits)
        setIsSearching(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [folderHandle, tree])

  useEffect(() => {
    if (!activeDocument) {
      return
    }

    const recentDocument: RecentDocument = {
      id: activeDocument.id,
      title: activeDocument.title,
      path: activeDocument.path,
      sourceType: activeDocument.sourceType,
      fileType: activeDocument.fileType,
      updatedAt: Date.now(),
      sourceUrl: activeDocument.sourceUrl,
    }

    updateLibrary((current) => ({
      ...current,
      recentDocuments: [recentDocument, ...current.recentDocuments.filter((item) => item.id !== recentDocument.id)].slice(0, 10),
    }))

    setStatusMessage(`Opened ${activeDocument.title}`)
    setSourceInput(activeDocument.sourceUrl ?? activeDocument.path)
  }, [activeDocument, updateLibrary])

  useEffect(() => {
    const scrollElement = contentScrollRef.current
    if (!scrollElement || !activeDocument) {
      return
    }

    const savedProgress = library.progressRecords.find((item) => item.documentId === activeDocument.id)
    scrollElement.scrollTop = savedProgress?.scrollTop ?? 0
    setProgress(savedProgress?.progress ?? 0)
  }, [activeDocument, library.progressRecords])

  useEffect(() => {
    const scrollElement = contentScrollRef.current
    if (!scrollElement || !activeDocument) {
      return
    }

    const handleScroll = () => {
      const maxScroll = Math.max(scrollElement.scrollHeight - scrollElement.clientHeight, 1)
      const nextProgress = Math.min(scrollElement.scrollTop / maxScroll, 1)
      setProgress(nextProgress)

      updateLibrary((current) => ({
        ...current,
        progressRecords: [
          {
            documentId: activeDocument.id,
            scrollTop: scrollElement.scrollTop,
            progress: nextProgress,
            updatedAt: Date.now(),
          },
          ...current.progressRecords.filter((item) => item.documentId !== activeDocument.id),
        ].slice(0, 40),
      }))
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [activeDocument, updateLibrary])

  const filteredTree = useMemo(() => filterTree(tree, fileFilter, typeFilter), [fileFilter, tree, typeFilter])
  const flattenedRows = useMemo(() => flattenTree(filteredTree, expandedPaths), [expandedPaths, filteredTree])
  const fileSearchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return searchIndex.slice(0, 20)
    }

    const fuse = new Fuse(searchIndex, {
      includeScore: true,
      threshold: 0.35,
      keys: ['title', 'path', 'snippet'],
    })

    return fuse.search(searchQuery).map((result) => ({
      ...result.item,
      score: result.score ?? 0,
    }))
  }, [searchIndex, searchQuery])

  const activeBookmarks = useMemo(
    () => library.bookmarks.filter((item) => item.documentId === activeDocument?.id),
    [activeDocument?.id, library.bookmarks],
  )
  const activeNotes = useMemo(
    () => library.notes.filter((item) => item.documentId === activeDocument?.id),
    [activeDocument?.id, library.notes],
  )
  const activeHighlights = useMemo(
    () => library.highlights.filter((item) => item.documentId === activeDocument?.id),
    [activeDocument?.id, library.highlights],
  )

  return {
    actions: {
      bookmarkCurrentSection,
      cycleMode,
      exportHighlights,
      exportHtml,
      exportSettings,
      handleDrop,
      importSettingsFromFile,
      jumpToHeading,
      openFolder,
      openRecentDocument,
      openSingleFile,
      openSource,
      printDocument: window.print,
      refreshFolder,
      saveSelectionAsHighlight,
      saveSelectionAsNote,
      setCommandPaletteOpen,
      setDocument,
      setFileFilter,
      setHelpOpen,
      setLightboxIndex,
      setSearchOpen,
      setSearchQuery,
      setSettingsOpen,
      setStatusMessage,
      setSourceInput,
      setTocFilter,
      setTypeFilter,
      setActiveHeadingId,
      setActiveParagraphIndex,
      setCurrentSelection,
      setProgress,
      toggleDirectory,
      updateSettings,
    },
    derived: {
      activeBookmarks,
      activeHighlights,
      activeNotes,
      fileSearchResults,
      filteredTree,
      flattenedRows,
    },
    refs: {
      articleRef,
      contentScrollRef,
      contentSearchInputRef,
      fileSearchInputRef,
      treeScrollRef,
    },
    state: {
      activeDocument,
      activeHeadingId,
      activeParagraphIndex,
      commandPaletteOpen,
      currentSelection,
      expandedPaths,
      fileFilter,
      folderHandle,
      helpOpen,
      isScanning,
      isSearching,
      library,
      lightboxIndex,
      progress,
      searchOpen,
      searchQuery,
      settings,
      settingsOpen,
      sourceInput,
      statusMessage,
      tocFilter,
      tree,
      typeFilter,
    },
  }
}

const EMPTY_TREE: FileNode[] = []
const DEFAULT_STATUS_MESSAGE = 'Load a folder, drop a file, or paste a raw Markdown URL.'
