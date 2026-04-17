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
  supportsDirectoryPicker,
  supportsOpenFilePicker,
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
  type TocItem,
} from '../../shared/types'
import {
  buildExportHtml,
  captureSelectionLocation,
  collectDirectoryPaths,
  downloadTextFile,
  findNodeById,
  getErrorMessage,
  joinPathSegments,
  resolveNoteTextRange,
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
  const [tocItems, setTocItems] = useState<TocItem[]>([])
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
  const scrollRestoreFrameRef = useRef(0)

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
    setActiveHeadingId('')
    setActiveParagraphIndex(0)
    setCurrentSelection('')
    setTocItems([])
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
    if (!supportsDirectoryPicker() || !window.showDirectoryPicker) {
      setStatusMessage(
        'Native folder access is not available in this browser. Use Chrome or Brave for folders, or open a file instead.',
      )
      return
    }

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
    if (!supportsOpenFilePicker() || !window.showOpenFilePicker) {
      setStatusMessage(
        'Native file picking is not available here. Drop a Markdown file into the reader or drop a raw Markdown URL.',
      )
      return
    }

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
    if (!sourceInput.trim()) {
      setStatusMessage('Paste a raw Markdown URL or file:// link first.')
      return
    }

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

  const jumpToNote = useCallback(
    (note: NoteRecord) => {
      if (note.documentId !== activeDocument?.id) {
        setStatusMessage('Open the document for this note first.')
        return
      }

      const article = articleRef.current
      if (!article) {
        setStatusMessage('The document is not ready yet.')
        return
      }

      const { range } = resolveNoteTextRange(article, note)
      if (range) {
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)

        const target = range.startContainer.parentElement?.closest('p, li, blockquote, h1, h2, h3, h4') ?? article
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        contentScrollRef.current?.focus()
        setCurrentSelection(note.quote)

        if (note.headingId) {
          setActiveHeadingId(note.headingId)
        }

        setStatusMessage('Jumped to the saved note location.')
        return
      }

      if (note.headingId) {
        jumpToHeading(note.headingId)
        setStatusMessage('Jumped to the saved note section.')
        return
      }

      setStatusMessage('Saved note location is unavailable.')
    },
    [activeDocument?.id, jumpToHeading],
  )

  const bookmarkCurrentSection = useCallback(
    (label: string, headingId?: string) => {
      if (!activeDocument) {
        setStatusMessage('Open a document first.')
        return
      }

      const normalizedLabel = label.trim()
      const duplicate = library.bookmarks.some(
        (item) =>
          item.documentId === activeDocument.id &&
          item.headingId === headingId &&
          item.label.trim().toLowerCase() === normalizedLabel.toLowerCase(),
      )
      if (duplicate) {
        setStatusMessage(`Already bookmarked ${normalizedLabel}.`)
        return
      }

      const bookmark: BookmarkRecord = {
        id: `${activeDocument.id}-${Date.now()}`,
        documentId: activeDocument.id,
        label: normalizedLabel,
        headingId,
        createdAt: Date.now(),
      }

      updateLibrary((current) => ({
        ...current,
        bookmarks: [bookmark, ...current.bookmarks],
      }))
      setStatusMessage(`Bookmarked ${normalizedLabel}`)
    },
    [activeDocument, library.bookmarks, updateLibrary],
  )

  const saveSelectionAsHighlight = useCallback(() => {
    const quote = currentSelection.trim()
    if (!activeDocument || !quote) {
      setStatusMessage('Select text inside the document first.')
      return
    }

    const duplicate = library.highlights.some(
      (item) => item.documentId === activeDocument.id && item.quote.trim() === quote,
    )
    if (duplicate) {
      setStatusMessage('That highlight is already saved.')
      return
    }

    const highlight: HighlightRecord = {
      id: `${activeDocument.id}-highlight-${Date.now()}`,
      documentId: activeDocument.id,
      quote,
      createdAt: Date.now(),
    }

    updateLibrary((current) => ({
      ...current,
      highlights: [highlight, ...current.highlights],
    }))
    setStatusMessage('Saved selection as a highlight.')
  }, [activeDocument, currentSelection, library.highlights, updateLibrary])

  const saveSelectionAsNote = useCallback(
    (
      noteText: string,
      noteMeta?: {
        quote?: string
        headingId?: string
        selectionStart?: number
        selectionEnd?: number
      },
    ) => {
      const quote = noteMeta?.quote?.trim() || currentSelection.trim()
      const normalizedNote = noteText.trim()
      if (!activeDocument || !quote) {
        setStatusMessage('Select text inside the document first.')
        return false
      }

      if (!normalizedNote) {
        setStatusMessage('Write a note before saving.')
        return false
      }

      const fallbackSelectionLocation =
        noteMeta ?? (articleRef.current ? captureSelectionLocation(articleRef.current, window.getSelection()) : null)

      const note: NoteRecord = {
        id: `${activeDocument.id}-note-${Date.now()}`,
        documentId: activeDocument.id,
        quote,
        note: normalizedNote,
        headingId: fallbackSelectionLocation?.headingId,
        selectionStart: fallbackSelectionLocation?.selectionStart,
        selectionEnd: fallbackSelectionLocation?.selectionEnd,
        createdAt: Date.now(),
      }

      updateLibrary((current) => ({
        ...current,
        notes: [note, ...current.notes],
      }))
      setStatusMessage('Saved a note for the current selection.')
      return true
    },
    [activeDocument, currentSelection, updateLibrary],
  )

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
      const recentDocument = library.recentDocuments.find((item) => item.id === documentId)

      const openCachedRecentDocument = () => {
        if (!recentDocument?.cachedContent) {
          return false
        }

        setDocument({
          id: recentDocument.id,
          title: recentDocument.title,
          path: recentDocument.path,
          content: recentDocument.cachedContent,
          sourceType: recentDocument.sourceType,
          updatedAt: recentDocument.updatedAt,
          sourceUrl: recentDocument.sourceUrl,
          fileType: recentDocument.fileType,
        })
        setStatusMessage(`Opened cached copy of ${recentDocument.title}`)
        return true
      }

      try {
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
          return
        }

        if (openCachedRecentDocument()) {
          return
        }

        setStatusMessage('This recent document is unavailable until its folder or source is restored.')
      } catch (error) {
        if (openCachedRecentDocument()) {
          return
        }

        setStatusMessage(getErrorMessage(error))
      }
    },
    [library.recentDocuments, setDocument, tree],
  )

  useEffect(() => {
    void (async () => {
      const persisted = await loadPersistedState()
      setSettings(persisted.settings)
      setLibrary(persisted.library)

      if (persisted.folderHandle && (await ensurePermission(persisted.folderHandle, 'read', false))) {
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
      cachedContent: activeDocument.content,
      sourceUrl: activeDocument.sourceUrl,
    }

    updateLibrary((current) => ({
      ...current,
      recentDocuments: [recentDocument, ...current.recentDocuments.filter((item) => item.id !== recentDocument.id)].slice(0, 10),
    }))

    setStatusMessage(`Opened ${activeDocument.title}`)
    setSourceInput(activeDocument.sourceUrl ?? activeDocument.path)
  }, [activeDocument, updateLibrary])

  // Restore saved scroll position when a document becomes active. The window is
  // the scroll container now, so we read/write scrollY instead of an internal
  // element. Double rAF lets the article mount + images reflow before we jump.
  useEffect(() => {
    if (!activeDocument) {
      return
    }

    const savedProgress = library.progressRecords.find((item) => item.documentId === activeDocument.id)
    const targetScroll = savedProgress?.scrollTop ?? 0

    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetScroll, behavior: 'auto' })
      })
      scrollRestoreFrameRef.current = secondFrame
    })
    scrollRestoreFrameRef.current = firstFrame

    setProgress(savedProgress?.progress ?? 0)

    return () => {
      if (scrollRestoreFrameRef.current) {
        window.cancelAnimationFrame(scrollRestoreFrameRef.current)
        scrollRestoreFrameRef.current = 0
      }
    }
    // We intentionally only re-run on document change, not on every progress
    // mutation — otherwise each scroll tick would re-trigger a jump-to-saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocument?.id])

  // Window-level scroll tracker. rAF coalesces events to one update per frame
  // for the visible progress bar; persistence to IndexedDB is debounced so
  // saveLibrary doesn't fire on every frame (that was the scroll lag).
  useEffect(() => {
    if (!activeDocument) {
      return
    }

    const scrollingElement = document.scrollingElement ?? document.documentElement
    let rafId = 0
    let persistTimer = 0
    let lastScrollTop = 0
    let lastProgress = 0

    const persistProgress = () => {
      updateLibrary((current) => ({
        ...current,
        progressRecords: [
          {
            documentId: activeDocument.id,
            scrollTop: lastScrollTop,
            progress: lastProgress,
            updatedAt: Date.now(),
          },
          ...current.progressRecords.filter((item) => item.documentId !== activeDocument.id),
        ].slice(0, 40),
      }))
    }

    const computeProgress = () => {
      rafId = 0
      const maxScroll = Math.max(scrollingElement.scrollHeight - window.innerHeight, 1)
      lastScrollTop = window.scrollY
      lastProgress = Math.min(Math.max(lastScrollTop / maxScroll, 0), 1)
      setProgress(lastProgress)

      window.clearTimeout(persistTimer)
      persistTimer = window.setTimeout(persistProgress, 250)
    }

    const handleScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(computeProgress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId) window.cancelAnimationFrame(rafId)
      window.clearTimeout(persistTimer)
      if (lastProgress > 0) persistProgress()
    }
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
      jumpToNote,
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
      setTocItems,
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
      tocItems,
      tree,
      typeFilter,
    },
  }
}

const EMPTY_TREE: FileNode[] = []
const DEFAULT_STATUS_MESSAGE = 'Load a folder, drop a file, or drop a raw Markdown URL.'
