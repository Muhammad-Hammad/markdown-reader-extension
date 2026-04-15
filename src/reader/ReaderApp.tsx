import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import DOMPurify from 'dompurify'
import Fuse from 'fuse.js'
import {
  BookOpenText,
  BookText,
  ChevronDown,
  ChevronRight,
  Download,
  FileSearch,
  FolderOpen,
  Globe,
  Highlighter,
  Keyboard,
  LayoutTemplate,
  ListTree,
  MoonStar,
  NotebookPen,
  PanelLeft,
  PanelRight,
  RefreshCcw,
  Search,
  Settings2,
  Sparkles,
  Sun,
} from 'lucide-react'
import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkBreaks from 'remark-breaks'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { loadPersistedState, saveFolderHandle, saveLibrary, saveSettings } from '../shared/db'
import {
  buildSearchIndex,
  ensurePermission,
  filterTree,
  flattenTree,
  readDroppedFile,
  readFromSourceUrl,
  readNodeDocument,
  readFileHandle,
  scanDirectory,
} from '../shared/fs'
import {
  DEFAULT_SETTINGS,
  EMPTY_LIBRARY,
  type BookmarkRecord,
  type FileNode,
  type HighlightRecord,
  type NoteRecord,
  type ReaderDocument,
  type ReaderMode,
  type ReaderSettings,
  type RecentDocument,
  type SearchHit,
  type SourceTypeFilter,
  type TocItem,
} from '../shared/types'

const MODE_CYCLE: ReaderMode[] = ['light', 'dark', 'read', 'low-light', 'ambient', 'focus']

const FONT_OPTIONS: Array<{ label: string; value: ReaderSettings['fontFamily'] }> = [
  { label: 'System', value: 'system' },
  { label: 'Sans', value: 'sans' },
  { label: 'Serif', value: 'serif' },
  { label: 'Mono', value: 'mono' },
]

const SOURCE_FILTERS: Array<{ label: string; value: SourceTypeFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Text', value: 'text' },
]

const KEYBOARD_SHORTCUTS = [
  ['Ctrl+Shift+M', 'Open the reader tab'],
  ['Ctrl+K', 'Open command palette'],
  ['Ctrl+Shift+F', 'Focus content search'],
  ['Ctrl+Shift+L', 'Toggle TOC'],
  ['Ctrl+Shift+D', 'Cycle reader mode'],
  ['/', 'Focus file filter'],
  ['?', 'Open keyboard help'],
]

function ReaderApp() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [library, setLibrary] = useState(EMPTY_LIBRARY)
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle>()
  const [tree, setTree] = useState<FileNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']))
  const [activeDocument, setActiveDocument] = useState<ReaderDocument>()
  const [fileFilter, setFileFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<SourceTypeFilter>('all')
  const [tocFilter, setTocFilter] = useState('')
  const [sourceInput, setSourceInput] = useState('')
  const [statusMessage, setStatusMessage] = useState('Load a folder, drop a file, or paste a raw Markdown URL.')
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
  const [ambientHue, setAmbientHue] = useState(220)
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

  const updateLibrary = useCallback(
    (updater: (current: typeof EMPTY_LIBRARY) => typeof EMPTY_LIBRARY) => {
      setLibrary((current) => {
        const next = updater(current)
        void saveLibrary(next)
        return next
      })
    },
    [],
  )

  const cycleMode = useCallback(() => {
    const currentIndex = MODE_CYCLE.indexOf(settings.mode)
    const nextMode = MODE_CYCLE[(currentIndex + 1) % MODE_CYCLE.length]
    updateSettings({
      mode: nextMode,
      focusParagraphs: nextMode === 'focus',
    })
  }, [settings.mode, updateSettings])

  useEffect(() => {
    void (async () => {
      const persisted = await loadPersistedState()
      setSettings(persisted.settings)
      setLibrary(persisted.library)

      if (persisted.folderHandle && (await ensurePermission(persisted.folderHandle))) {
        setFolderHandle(persisted.folderHandle)
        setStatusMessage(`Restored folder: ${persisted.folderHandle.name}`)
        setIsScanning(true)
        const scannedTree = await scanDirectory(persisted.folderHandle)
        setTree(scannedTree)
        setExpandedPaths(new Set(['/', ...collectDirectoryPaths(scannedTree)]))
        setIsScanning(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!folderHandle) {
      setSearchIndex([])
      return
    }

    let isCancelled = false
    setIsSearching(true)

    void (async () => {
      const hits = await buildSearchIndex(tree)
      if (!isCancelled) {
        setSearchIndex(hits)
        setIsSearching(false)
      }
    })()

    return () => {
      isCancelled = true
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
    if (savedProgress) {
      scrollElement.scrollTop = savedProgress.scrollTop
      setProgress(savedProgress.progress)
    } else {
      scrollElement.scrollTop = 0
      setProgress(0)
    }
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

  useEffect(() => {
    if (!activeDocument || !settings.autoRefresh) {
      return
    }

    const refreshDocument = async () => {
      try {
        if (activeDocument.fileHandle) {
          const file = await activeDocument.fileHandle.getFile()
          if (file.lastModified > activeDocument.updatedAt) {
            const refreshed = await activeDocument.fileHandle.getFile()
            const nextContent = await refreshed.text()
            setActiveDocument((current) =>
              current
                ? {
                    ...current,
                    content: nextContent,
                    updatedAt: refreshed.lastModified,
                  }
                : current,
            )
            setStatusMessage(`Auto-refreshed ${activeDocument.title}`)
          }
          return
        }

        if (activeDocument.sourceUrl) {
          const refreshed = await readFromSourceUrl(activeDocument.sourceUrl)
          if (refreshed.content !== activeDocument.content) {
            setActiveDocument(refreshed)
            setStatusMessage(`Fetched latest content from ${activeDocument.sourceUrl}`)
          }
        }
      } catch {
        setStatusMessage('Auto-refresh skipped because the current source is unavailable.')
      }
    }

    const interval = window.setInterval(() => {
      void refreshDocument()
    }, 4000)

    return () => window.clearInterval(interval)
  }, [activeDocument, settings.autoRefresh])

  useEffect(() => {
    const container = articleRef.current
    if (!container) {
      return
    }

    const headings = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4'))
    if (headings.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]

        if (visible?.target instanceof HTMLElement) {
          setActiveHeadingId(visible.target.id)
        }
      },
      {
        root: contentScrollRef.current,
        rootMargin: '-10% 0px -70% 0px',
        threshold: [0.1, 0.5, 1],
      },
    )

    headings.forEach((heading) => observer.observe(heading))

    return () => observer.disconnect()
  }, [activeDocument])

  useEffect(() => {
    const container = articleRef.current
    if (!container) {
      return
    }

    const paragraphs = Array.from(container.querySelectorAll<HTMLElement>('p'))
    paragraphs.forEach((paragraph, index) => {
      paragraph.dataset.focusIndex = String(index)
    })

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]

        if (visible?.target instanceof HTMLElement) {
          setActiveParagraphIndex(Number(visible.target.dataset.focusIndex ?? '0'))
        }
      },
      {
        root: contentScrollRef.current,
        rootMargin: '-10% 0px -40% 0px',
        threshold: [0.4, 0.7, 1],
      },
    )

    paragraphs.forEach((paragraph) => observer.observe(paragraph))

    return () => observer.disconnect()
  }, [activeDocument, settings.focusParagraphs])

  useEffect(() => {
    const updateSelection = () => {
      const selection = window.getSelection()
      setCurrentSelection(selection?.toString().trim() ?? '')
    }

    document.addEventListener('selectionchange', updateSelection)
    return () => document.removeEventListener('selectionchange', updateSelection)
  }, [])

  useEffect(() => {
    const handleKeydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        setHelpOpen(true)
      }

      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        fileSearchInputRef.current?.focus()
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen((current) => !current)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setSearchOpen(true)
        window.setTimeout(() => contentSearchInputRef.current?.focus(), 20)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        updateSettings({ showToc: !settings.showToc })
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        cycleMode()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [cycleMode, settings.showToc, updateSettings])

  const tocItems = useMemo(() => extractToc(activeDocument?.content ?? ''), [activeDocument?.content])
  const filteredTocItems = useMemo(
    () => tocItems.filter((item) => item.text.toLowerCase().includes(tocFilter.trim().toLowerCase())),
    [tocFilter, tocItems],
  )
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
  const stats = useMemo(() => getDocumentStats(activeDocument?.content ?? ''), [activeDocument?.content])
  const imageSources = useMemo(() => extractImageSources(activeDocument?.content ?? ''), [activeDocument?.content])
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

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: flattenedRows.length,
    getScrollElement: () => treeScrollRef.current,
    estimateSize: () => 32,
    overscan: 12,
  })

  const setDocument = useCallback((document: ReaderDocument) => {
    setActiveDocument(document)
    if (document.sourceType === 'folder-file') {
      setExpandedPaths((current) => new Set([...current, ...document.path.split('/').slice(0, -1).map(joinPathSegments)]))
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

      setIsScanning(true)
      const scannedTree = await scanDirectory(handle)
      setTree(scannedTree)
      setFolderHandle(handle)
      setExpandedPaths(new Set(['/', ...collectDirectoryPaths(scannedTree)]))
      await saveFolderHandle(handle)
      setStatusMessage(`Loaded folder ${handle.name}`)
      setIsScanning(false)
    } catch (error) {
      setStatusMessage(getErrorMessage(error))
      setIsScanning(false)
    }
  }, [])

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

    setIsScanning(true)
    const scannedTree = await scanDirectory(folderHandle)
    setTree(scannedTree)
    setIsScanning(false)
    setStatusMessage(`Rescanned ${folderHandle.name}`)
  }, [folderHandle])

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

  const toggleDirectory = (path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const jumpToHeading = (headingId: string) => {
    const heading = articleRef.current?.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`)
    heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveHeadingId(headingId)
  }

  const bookmarkCurrentSection = () => {
    if (!activeDocument) {
      setStatusMessage('Open a document first.')
      return
    }

    const matchingHeading = tocItems.find((item) => item.id === activeHeadingId)
    const label = matchingHeading?.text ?? activeDocument.title

    const bookmark: BookmarkRecord = {
      id: `${activeDocument.id}-${Date.now()}`,
      documentId: activeDocument.id,
      label,
      headingId: matchingHeading?.id,
      createdAt: Date.now(),
    }

    updateLibrary((current) => ({
      ...current,
      bookmarks: [bookmark, ...current.bookmarks],
    }))
    setStatusMessage(`Bookmarked ${label}`)
  }

  const saveSelectionAsHighlight = () => {
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
  }

  const saveSelectionAsNote = () => {
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
  }

  const exportSettings = () => {
    const payload = JSON.stringify(settings, null, 2)
    downloadTextFile('markdown-reader-settings.json', payload, 'application/json')
  }

  const exportHtml = () => {
    if (!activeDocument || !articleRef.current) {
      setStatusMessage('Open a document before exporting.')
      return
    }

    const articleMarkup = articleRef.current.innerHTML
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(activeDocument.title)}</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      main { max-width: 920px; margin: 0 auto; padding: 48px 24px 96px; }
      img { max-width: 100%; border-radius: 12px; }
      pre { overflow: auto; padding: 16px; border-radius: 12px; background: #0b1220; }
      code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      blockquote { margin: 0; padding: 16px 18px; border-left: 4px solid #60a5fa; background: rgba(96, 165, 250, 0.08); border-radius: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 24px 0; }
      th, td { border: 1px solid rgba(148, 163, 184, 0.24); padding: 10px 12px; }
      a { color: #93c5fd; }
      .mermaid-shell { padding: 16px; background: #fff; border-radius: 16px; }
    </style>
  </head>
  <body>
    <main>${articleMarkup}</main>
  </body>
</html>`

    downloadTextFile(`${activeDocument.title}.html`, html, 'text/html')
    setStatusMessage(`Exported ${activeDocument.title}.html`)
  }

  const exportHighlights = () => {
    if (!activeDocument) {
      return
    }

    const payload = activeHighlights.map((item) => `- ${item.quote}`).join('\n')
    downloadTextFile(`${activeDocument.title}-highlights.md`, payload, 'text/markdown')
  }

  const printDocument = () => {
    window.print()
  }

  const importSettingsFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
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
  }

  const surfaceStyle = getModeStyle(settings.mode, ambientHue)

  const markdownComponents = useMemo<Components>(
    () => ({
      code(properties) {
        const className = properties.className ?? ''
        const rawCode = String(properties.children ?? '')
        const language = className.replace('language-', '')

        if (language === 'mermaid') {
          return <MermaidBlock code={rawCode} mode={settings.mode} />
        }

        if (!className) {
          return <code className="inline-code">{properties.children}</code>
        }

        return (
          <CodeBlock
            code={rawCode.replace(/\n$/, '')}
            className={className}
            wrap={settings.codeWrap}
          />
        )
      },
      img(properties) {
        const source = String(properties.src ?? '')
        const index = imageSources.findIndex((item) => item === source)

        return (
          <button
            type="button"
            className="image-button"
            onClick={() => setLightboxIndex(index >= 0 ? index : 0)}
          >
            <img {...properties} className="markdown-image" alt={properties.alt ?? ''} />
          </button>
        )
      },
      blockquote(properties) {
        const alert = parseAlert(flattenReactText(properties.children))
        if (!alert) {
          return <blockquote>{properties.children}</blockquote>
        }

        return (
          <aside className={`callout callout-${alert.kind.toLowerCase()}`}>
            <strong>{alert.kind}</strong>
            <div>{alert.body}</div>
          </aside>
        )
      },
      p(properties) {
        return (
          <p
            className={clsx({
              'focus-dimmed':
                settings.focusParagraphs &&
                Number(
                  (properties.node?.properties?.['data-focus-index'] as string | undefined) ?? '-1',
                ) !== activeParagraphIndex,
            })}
          >
            {properties.children}
          </p>
        )
      },
    }),
    [activeParagraphIndex, imageSources, settings.codeWrap, settings.focusParagraphs, settings.mode],
  )

  useEffect(() => {
    if (settings.mode !== 'ambient' || !imageSources[0]) {
      setAmbientHue(hashString(activeDocument?.title ?? 'markdown-reader') % 360)
      return
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = imageSources[0]
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const context = canvas.getContext('2d')
      if (!context) {
        return
      }

      context.drawImage(image, 0, 0, 16, 16)
      try {
        const data = context.getImageData(0, 0, 16, 16).data
        let red = 0
        let green = 0
        let blue = 0
        const samples = data.length / 4

        for (let index = 0; index < data.length; index += 4) {
          red += data[index]
          green += data[index + 1]
          blue += data[index + 2]
        }

        const hue = rgbToHue(red / samples, green / samples, blue / samples)
        setAmbientHue(hue)
      } catch {
        setAmbientHue(hashString(activeDocument?.title ?? 'markdown-reader') % 360)
      }
    }
    image.onerror = () => setAmbientHue(hashString(activeDocument?.title ?? 'markdown-reader') % 360)
  }, [activeDocument?.title, imageSources, settings.mode])

  return (
    <div
      className={clsx('reader-shell', `mode-${settings.mode}`)}
      style={
        {
          '--reader-font-size': `${settings.fontSize}px`,
          '--reader-line-height': settings.lineHeight,
          '--reader-content-width': `${settings.contentWidth}px`,
          '--reader-surface': surfaceStyle.surface,
          '--reader-border': surfaceStyle.border,
          '--reader-panel': surfaceStyle.panel,
          '--reader-muted': surfaceStyle.muted,
          '--reader-text': surfaceStyle.text,
          '--reader-heading': surfaceStyle.heading,
          '--reader-accent': surfaceStyle.accent,
          '--reader-accent-soft': surfaceStyle.accentSoft,
          '--reader-shadow': surfaceStyle.shadow,
        } as CSSProperties
      }
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <header className="reader-toolbar">
        <div className="toolbar-group">
          <button type="button" className="toolbar-button primary" onClick={openFolder}>
            <FolderOpen size={16} />
            Open folder
          </button>
          <button type="button" className="toolbar-button" onClick={openSingleFile}>
            <BookOpenText size={16} />
            Open file
          </button>
          <button type="button" className="toolbar-button" onClick={refreshFolder}>
            <RefreshCcw size={16} />
            Rescan
          </button>
        </div>

        <div className="source-bar">
          <Globe size={16} />
          <input
            value={sourceInput}
            onChange={(event) => setSourceInput(event.target.value)}
            placeholder="Paste a raw markdown URL or file:// path"
          />
          <button type="button" className="toolbar-button" onClick={openSource}>
            Open source
          </button>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-button icon"
            onClick={() => updateSettings({ showFileTree: !settings.showFileTree })}
            title="Toggle file tree"
          >
            <PanelLeft size={16} />
          </button>
          <button
            type="button"
            className="toolbar-button icon"
            onClick={() => updateSettings({ showToc: !settings.showToc })}
            title="Toggle TOC"
          >
            <PanelRight size={16} />
          </button>
          <button type="button" className="toolbar-button icon" onClick={cycleMode} title="Cycle mode">
            {settings.mode === 'light' ? <Sun size={16} /> : <MoonStar size={16} />}
          </button>
          <button type="button" className="toolbar-button icon" onClick={() => setSearchOpen(true)} title="Search">
            <Search size={16} />
          </button>
          <button
            type="button"
            className="toolbar-button icon"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </header>

      <div className="progress-rail">
        <span className="progress-bar" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="reader-layout">
        {settings.showFileTree ? (
          <aside className="panel file-panel">
            <div className="panel-header">
              <div>
                <strong>Library</strong>
                <span>{folderHandle?.name ?? 'Local and remote sources'}</span>
              </div>
              <span className="badge">{isScanning ? 'Scanning...' : `${flattenedRows.length} rows`}</span>
            </div>

            <div className="panel-stack">
              <div className="search-stack">
                <label className="search-input">
                  <Search size={14} />
                  <input
                    ref={fileSearchInputRef}
                    value={fileFilter}
                    onChange={(event) => setFileFilter(event.target.value)}
                    placeholder="Filter files and folders"
                  />
                </label>

                <div className="chip-row">
                  {SOURCE_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      className={clsx('chip', { active: typeFilter === filter.value })}
                      onClick={() => setTypeFilter(filter.value)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <section className="dashboard-card">
                <div className="dashboard-header">
                  <BookText size={16} />
                  Continue reading
                </div>
                <ul className="compact-list">
                  {library.recentDocuments.slice(0, 4).map((item) => {
                    const documentProgress = library.progressRecords.find((record) => record.documentId === item.id)

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="list-link"
                          onClick={() => {
                            const targetNode = findNodeById(tree, item.id)
                            if (targetNode) {
                              void readNodeDocument(targetNode).then(setDocument)
                              return
                            }

                            if (item.sourceUrl) {
                              setSourceInput(item.sourceUrl)
                              void readFromSourceUrl(item.sourceUrl).then(setDocument)
                            }
                          }}
                        >
                          <span>{item.title}</span>
                          <small>{Math.round((documentProgress?.progress ?? 0) * 100)}%</small>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <div ref={treeScrollRef} className="tree-scroll">
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = flattenedRows[virtualRow.index]
                    if (!row) {
                      return null
                    }

                    const isExpanded = expandedPaths.has(row.node.path)
                    const isActive = activeDocument?.id === row.node.id

                    return (
                      <div
                        key={row.node.id}
                        className={clsx('tree-row', { active: isActive })}
                        style={{
                          transform: `translateY(${virtualRow.start}px)`,
                          paddingLeft: `${12 + row.depth * 16}px`,
                        }}
                      >
                        {row.node.kind === 'directory' ? (
                          <button
                            type="button"
                            className="tree-button"
                            onClick={() => toggleDirectory(row.node.path)}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>{row.node.name}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="tree-button file"
                            onClick={() => void readNodeDocument(row.node).then(setDocument)}
                          >
                            <span>{row.node.name}</span>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>
        ) : null}

        <main className="content-panel">
          <section className="hero-strip">
            <div>
              <h1>{activeDocument?.title ?? 'Markdown Reader Workspace'}</h1>
              <p>{activeDocument?.path ?? 'Drop a file, open a folder, or paste a source URL to get started.'}</p>
            </div>
            <div className="hero-actions">
              <button type="button" className="toolbar-button" onClick={bookmarkCurrentSection}>
                <Sparkles size={16} />
                Bookmark section
              </button>
              <button type="button" className="toolbar-button" onClick={saveSelectionAsHighlight}>
                <Highlighter size={16} />
                Save highlight
              </button>
              <button type="button" className="toolbar-button" onClick={saveSelectionAsNote}>
                <NotebookPen size={16} />
                Save note
              </button>
            </div>
          </section>

          <div className="document-frame" ref={contentScrollRef}>
            <article
              ref={articleRef}
              className={clsx('markdown-article', {
                centered: settings.centered,
                focus: settings.mode === 'focus',
              })}
            >
              {activeDocument ? (
                <>
                  {renderFrontmatter(activeDocument.content)}
                  <ReactMarkdown
                    remarkPlugins={[remarkFrontmatter, remarkGfm, remarkMath, remarkBreaks]}
                    rehypePlugins={[rehypeRaw, rehypeSlug, rehypeKatex, rehypeHighlight]}
                    components={markdownComponents}
                  >
                    {DOMPurify.sanitize(activeDocument.content)}
                  </ReactMarkdown>
                </>
              ) : (
                <EmptyState />
              )}
            </article>
          </div>

          {settings.showStatusBar ? (
            <footer className="status-bar">
              <div className="status-metrics">
                <span>{stats.words} words</span>
                <span>{stats.characters} chars</span>
                <span>{stats.readMinutes} min read</span>
                <span>{Math.round(progress * 100)}% complete</span>
              </div>
              <div className="status-actions">
                <button type="button" className="toolbar-button" onClick={exportHighlights}>
                  Export highlights
                </button>
                <button type="button" className="toolbar-button" onClick={exportHtml}>
                  <Download size={14} />
                  Export HTML
                </button>
                <button type="button" className="toolbar-button" onClick={printDocument}>
                  Print / PDF
                </button>
              </div>
            </footer>
          ) : null}
        </main>

        {settings.showToc ? (
          <aside className="panel toc-panel">
            <div className="panel-header">
              <div>
                <strong>Navigator</strong>
                <span>TOC, bookmarks, notes, and search</span>
              </div>
              <button type="button" className="toolbar-button icon" onClick={() => setHelpOpen(true)}>
                <Keyboard size={16} />
              </button>
            </div>

            <div className="panel-stack">
              <label className="search-input">
                <ListTree size={14} />
                <input
                  value={tocFilter}
                  onChange={(event) => setTocFilter(event.target.value)}
                  placeholder="Filter headings"
                />
              </label>

              <section className="sidebar-section">
                <div className="sidebar-title">Table of contents</div>
                <ul className="toc-list">
                  {filteredTocItems.map((item) => (
                    <li key={item.id} style={{ paddingLeft: `${(item.depth - 1) * 14}px` }}>
                      <button
                        type="button"
                        className={clsx('list-link', { current: activeHeadingId === item.id })}
                        onClick={() => jumpToHeading(item.id)}
                      >
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="sidebar-section">
                <div className="sidebar-title">Bookmarks</div>
                <ul className="compact-list">
                  {activeBookmarks.map((bookmark) => (
                    <li key={bookmark.id}>
                      <button
                        type="button"
                        className="list-link"
                        onClick={() => bookmark.headingId && jumpToHeading(bookmark.headingId)}
                      >
                        {bookmark.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="sidebar-section">
                <div className="sidebar-title">Notes</div>
                <ul className="compact-list">
                  {activeNotes.map((note) => (
                    <li key={note.id} className="annotation-card">
                      <strong>{note.quote}</strong>
                      <p>{note.note}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="sidebar-section">
                <div className="sidebar-title">Highlights</div>
                <ul className="compact-list">
                  {activeHighlights.map((highlight) => (
                    <li key={highlight.id} className="annotation-card">
                      <strong>{highlight.quote}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="status-toast">{statusMessage}</div>

      {searchOpen ? (
        <Modal title="Full-text folder search" onClose={() => setSearchOpen(false)}>
          <label className="search-input modal-search">
            <FileSearch size={16} />
            <input
              ref={contentSearchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchOpen(false)
                }
              }}
              placeholder={isSearching ? 'Indexing folder contents...' : 'Search path and text snippets'}
            />
          </label>
          <ul className="search-results">
            {fileSearchResults.map((hit) => (
              <li key={`${hit.documentId}-${hit.path}`}>
                <button
                  type="button"
                  className="search-result"
                  onClick={() => {
                    const targetNode = findNodeById(tree, hit.documentId)
                    if (targetNode) {
                      void readNodeDocument(targetNode).then(setDocument)
                    }
                    setSearchOpen(false)
                  }}
                >
                  <strong>{hit.title}</strong>
                  <span>{hit.path}</span>
                  <p>{hit.snippet}</p>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}

      {helpOpen ? (
        <Modal title="Keyboard shortcuts" onClose={() => setHelpOpen(false)}>
          <ul className="shortcut-list">
            {KEYBOARD_SHORTCUTS.map(([keys, action]) => (
              <li key={keys}>
                <kbd>{keys}</kbd>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}

      {settingsOpen ? (
        <Modal title="Reader settings" onClose={() => setSettingsOpen(false)}>
          <div className="settings-grid">
            <label>
              Mode
              <select
                value={settings.mode}
                onChange={(event) =>
                  updateSettings({
                    mode: event.target.value as ReaderMode,
                    focusParagraphs: event.target.value === 'focus',
                  })
                }
              >
                {MODE_CYCLE.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Font family
              <select
                value={settings.fontFamily}
                onChange={(event) =>
                  updateSettings({
                    fontFamily: event.target.value as ReaderSettings['fontFamily'],
                  })
                }
              >
                {FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Font size
              <input
                type="range"
                min={12}
                max={24}
                value={settings.fontSize}
                onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
              />
            </label>
            <label>
              Line height
              <input
                type="range"
                min={1.2}
                max={2.3}
                step={0.05}
                value={settings.lineHeight}
                onChange={(event) => updateSettings({ lineHeight: Number(event.target.value) })}
              />
            </label>
            <label>
              Content width
              <input
                type="range"
                min={680}
                max={1280}
                step={20}
                value={settings.contentWidth}
                onChange={(event) => updateSettings({ contentWidth: Number(event.target.value) })}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.centered}
                onChange={(event) => updateSettings({ centered: event.target.checked })}
              />
              Center content
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.codeWrap}
                onChange={(event) => updateSettings({ codeWrap: event.target.checked })}
              />
              Wrap code blocks
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(event) => updateSettings({ autoRefresh: event.target.checked })}
              />
              Auto-refresh
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.focusParagraphs}
                onChange={(event) => updateSettings({ focusParagraphs: event.target.checked })}
              />
              Focus active paragraph
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="toolbar-button" onClick={exportSettings}>
              Export settings JSON
            </button>
            <label className="toolbar-button file-input-button">
              Import settings JSON
              <input type="file" accept="application/json" onChange={importSettingsFromFile} />
            </label>
          </div>
        </Modal>
      ) : null}

      {commandPaletteOpen ? (
        <Modal title="Command palette" onClose={() => setCommandPaletteOpen(false)}>
          <div className="command-palette">
            <button
              type="button"
              className="search-result"
              onClick={() => {
                void openFolder()
                setCommandPaletteOpen(false)
              }}
            >
              <strong>Open folder</strong>
              <p>Select a directory and scan its nested Markdown files.</p>
            </button>
            <button
              type="button"
              className="search-result"
              onClick={() => {
                void openSingleFile()
                setCommandPaletteOpen(false)
              }}
            >
              <strong>Open single file</strong>
              <p>Pick one `.md`, `.markdown`, or `.txt` document.</p>
            </button>
            <button
              type="button"
              className="search-result"
              onClick={() => {
                setSearchOpen(true)
                setCommandPaletteOpen(false)
              }}
            >
              <strong>Search indexed files</strong>
              <p>Search titles, paths, and text snippets across the current folder.</p>
            </button>
            <button
              type="button"
              className="search-result"
              onClick={() => {
                cycleMode()
                setCommandPaletteOpen(false)
              }}
            >
              <strong>Cycle reader mode</strong>
              <p>Switch between light, dark, read, low-light, ambient, and focus modes.</p>
            </button>
          </div>
        </Modal>
      ) : null}

      {lightboxIndex !== null && imageSources[lightboxIndex] ? (
        <div className="lightbox" role="dialog" aria-modal="true">
          <button type="button" className="lightbox-backdrop" onClick={() => setLightboxIndex(null)} />
          <div className="lightbox-content">
            <img src={imageSources[lightboxIndex]} alt="Expanded markdown asset" />
            <div className="lightbox-actions">
              <button
                type="button"
                className="toolbar-button"
                onClick={() =>
                  setLightboxIndex((current) =>
                    current === null ? 0 : (current - 1 + imageSources.length) % imageSources.length,
                  )
                }
              >
                Previous
              </button>
              <button
                type="button"
                className="toolbar-button"
                onClick={() =>
                  setLightboxIndex((current) => (current === null ? 0 : (current + 1) % imageSources.length))
                }
              >
                Next
              </button>
              <button type="button" className="toolbar-button" onClick={() => setLightboxIndex(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="modal-backdrop" onClick={onClose} />
      <div className="modal-card">
        <div className="modal-header">
          <strong>{title}</strong>
          <button type="button" className="toolbar-button icon" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <section className="empty-state">
      <LayoutTemplate size={48} />
      <h2>Reader workspace is ready</h2>
      <p>
        Match MarkView basics first: nested file browsing, Smart TOC, export, auto-refresh, and
        readable themes. Then keep adding your own modes and productivity layers.
      </p>
      <ul>
        <li>Open a nested local folder with `Open folder`.</li>
        <li>Drop a `.md` or `.txt` file anywhere on the page.</li>
        <li>Paste a raw Markdown URL or `file://` source into the toolbar.</li>
      </ul>
    </section>
  )
}

function CodeBlock({
  className,
  code,
  wrap,
}: {
  className: string
  code: string
  wrap: boolean
}) {
  return (
    <div className="code-block-shell">
      <button
        type="button"
        className="copy-code-button"
        onClick={() => void navigator.clipboard.writeText(code)}
      >
        Copy
      </button>
      <pre className={clsx(className, { wrapped: wrap })}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function MermaidBlock({ code, mode }: { code: string; mode: ReaderMode }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current) {
        return
      }

      try {
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'antiscript',
          theme: mode === 'light' || mode === 'read' ? 'neutral' : 'dark',
        })
        const result = await mermaid.render(id, code)
        containerRef.current.innerHTML = result.svg
        setError('')
      } catch (renderError) {
        setError(getErrorMessage(renderError))
      }
    }

    void render()
  }, [code, mode])

  if (error) {
    return (
      <div className="mermaid-error">
        Mermaid render error
        <pre>{error}</pre>
      </div>
    )
  }

  return <div ref={containerRef} className="mermaid-shell" />
}

function renderFrontmatter(content: string) {
  const entries = Object.entries(parseFrontmatter(content))

  if (entries.length === 0) {
    return null
  }

  return (
    <section className="frontmatter-card">
      <strong>Front matter</strong>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    return {}
  }

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((output, line) => {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex <= 0) {
        return output
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      if (!key) {
        return output
      }

      output[key] = value
      return output
    }, {})
}

function parseAlert(value: string) {
  const match = value.trim().match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)$/i)
  if (!match) {
    return null
  }

  return {
    kind: match[1].toUpperCase(),
    body: match[2].trim(),
  }
}

function flattenReactText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(flattenReactText).join('')
  }

  if (node && typeof node === 'object' && 'props' in node) {
    const value = node as { props?: { children?: ReactNode } }
    return flattenReactText(value.props?.children ?? '')
  }

  return ''
}

function extractToc(content: string): TocItem[] {
  return content
    .split('\n')
    .map((line) => line.match(/^(#{1,4})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      id: slugify(match[2]),
      depth: match[1].length,
      text: match[2].trim(),
    }))
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=<>{}|[\]\\:;"',.?/]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function getDocumentStats(content: string) {
  const clean = content.replace(/```[\s\S]*?```/g, '').trim()
  const words = clean ? clean.split(/\s+/).length : 0
  const characters = clean.length
  const readMinutes = Math.max(1, Math.round(words / 220))

  return { words, characters, readMinutes }
}

function collectDirectoryPaths(nodes: FileNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.kind === 'directory') {
      paths.push(node.path)
      paths.push(...collectDirectoryPaths(node.children))
    }
  }
  return paths
}

function findNodeById(nodes: FileNode[], id: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }

    const child = findNodeById(node.children, id)
    if (child) {
      return child
    }
  }

  return undefined
}

function joinPathSegments(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

function extractImageSources(content: string) {
  return Array.from(content.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)).map((match) => match[1])
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function rgbToHue(red: number, green: number, blue: number) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  if (delta === 0) {
    return 0
  }

  let hue = 0
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }

  return Math.round(hue * 60)
}

function getModeStyle(mode: ReaderMode, ambientHue: number) {
  if (mode === 'light') {
    return {
      surface: '#f8fafc',
      panel: '#ffffff',
      text: '#0f172a',
      heading: '#020617',
      muted: '#475569',
      border: 'rgba(148, 163, 184, 0.28)',
      accent: '#2563eb',
      accentSoft: 'rgba(37, 99, 235, 0.12)',
      shadow: '0 18px 38px rgba(15, 23, 42, 0.08)',
    }
  }

  if (mode === 'read') {
    return {
      surface: '#f8f5eb',
      panel: '#fffdf7',
      text: '#2f2418',
      heading: '#17110c',
      muted: '#6b5f53',
      border: 'rgba(161, 98, 7, 0.14)',
      accent: '#a16207',
      accentSoft: 'rgba(161, 98, 7, 0.12)',
      shadow: '0 18px 38px rgba(68, 64, 60, 0.08)',
    }
  }

  if (mode === 'low-light') {
    return {
      surface: '#16110d',
      panel: '#221711',
      text: '#f4e9d8',
      heading: '#fff7ed',
      muted: '#d6bda0',
      border: 'rgba(251, 146, 60, 0.18)',
      accent: '#fb923c',
      accentSoft: 'rgba(251, 146, 60, 0.12)',
      shadow: '0 18px 38px rgba(15, 23, 42, 0.36)',
    }
  }

  if (mode === 'ambient') {
    return {
      surface: `hsl(${ambientHue} 36% 10%)`,
      panel: `hsl(${ambientHue} 30% 14%)`,
      text: '#e2e8f0',
      heading: '#f8fafc',
      muted: '#cbd5e1',
      border: `hsla(${ambientHue} 52% 62% / 0.22)`,
      accent: `hsl(${ambientHue} 75% 64%)`,
      accentSoft: `hsla(${ambientHue} 75% 64% / 0.16)`,
      shadow: `0 18px 48px hsla(${ambientHue} 70% 10% / 0.5)`,
    }
  }

  if (mode === 'focus') {
    return {
      surface: '#09090b',
      panel: '#111827',
      text: '#e5e7eb',
      heading: '#f9fafb',
      muted: '#9ca3af',
      border: 'rgba(96, 165, 250, 0.18)',
      accent: '#60a5fa',
      accentSoft: 'rgba(96, 165, 250, 0.12)',
      shadow: '0 18px 48px rgba(2, 6, 23, 0.52)',
    }
  }

  return {
    surface: '#020617',
    panel: '#0f172a',
    text: '#e2e8f0',
    heading: '#f8fafc',
    muted: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.16)',
    accent: '#38bdf8',
    accentSoft: 'rgba(56, 189, 248, 0.12)',
    shadow: '0 18px 44px rgba(2, 6, 23, 0.44)',
  }
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export default ReaderApp
