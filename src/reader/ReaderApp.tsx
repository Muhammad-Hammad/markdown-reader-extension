import clsx from 'clsx'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import DocumentPanel from './components/DocumentPanel'
import FilePanel from './components/FilePanel'
import ImageLightbox from './components/ImageLightbox'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import NavigatorPanel from './components/NavigatorPanel'
import ReaderToolbar from './components/ReaderToolbar'
import SearchModal from './components/SearchModal'
import SettingsModal from './components/SettingsModal'
import CommandPaletteModal from './components/CommandPaletteModal'
import { ReaderWorkspaceProvider } from './ReaderWorkspaceContext'
import { useReaderDocumentView } from './hooks/useReaderDocumentView'
import { useReaderInteractions } from './hooks/useReaderInteractions'
import { useReaderWorkspace } from './hooks/useReaderWorkspace'
import { BRAND_TITLE_SUFFIX } from '../shared/brand'
import { getBookmarkLabel } from './utils'

function ReaderApp() {
  const workspace = useReaderWorkspace()
  const {
    actions,
    refs,
    state: { activeDocument, activeHeadingId, activeParagraphIndex, settings, statusMessage, tocFilter, tocItems, progress },
  } = workspace
  const isLeftPanelFull = settings.showFileTree && settings.leftPanelMode === 'full'

  const { imageSources, markdownComponents, rootStyle, stats } = useReaderDocumentView({
    activeDocument,
    activeParagraphIndex,
    articleRef: refs.articleRef,
    onLightboxOpen: actions.setLightboxIndex,
    settings,
  })

  const filteredTocItems = useMemo(
    () => tocItems.filter((item) => item.text.toLowerCase().includes(tocFilter.trim().toLowerCase())),
    [tocFilter, tocItems],
  )

  const bookmarkLabel = getBookmarkLabel(
    tocItems,
    activeHeadingId,
    activeDocument?.title ?? 'Current section',
  )

  useEffect(() => {
    document.title = activeDocument ? `${activeDocument.title} · ${BRAND_TITLE_SUFFIX}` : BRAND_TITLE_SUFFIX
  }, [activeDocument])

  // Measure the sticky chrome (toolbar + progress rail) so sidebars can offset
  // against it. Writing to a CSS variable keeps the paint on the compositor
  // instead of re-rendering React on every resize.
  const shellRef = useRef<HTMLDivElement | null>(null)
  const chromeRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const chrome = chromeRef.current
    const shell = shellRef.current
    if (!chrome || !shell) return

    const applyHeight = () => {
      shell.style.setProperty('--reader-chrome-height', `${chrome.offsetHeight}px`)
    }

    applyHeight()
    const observer = new ResizeObserver(applyHeight)
    observer.observe(chrome)
    return () => observer.disconnect()
  }, [])

  useReaderInteractions({
    activeDocument,
    leftPanelMode: settings.leftPanelMode,
    articleRef: refs.articleRef,
    autoRefresh: settings.autoRefresh,
    contentScrollRef: refs.contentScrollRef,
    contentSearchInputRef: refs.contentSearchInputRef,
    cycleMode: actions.cycleMode,
    fileSearchInputRef: refs.fileSearchInputRef,
    onActiveHeadingChange: actions.setActiveHeadingId,
    onActiveParagraphChange: actions.setActiveParagraphIndex,
    onCommandPaletteToggle: () => actions.setCommandPaletteOpen((current) => !current),
    onDocumentRefresh: actions.setDocument,
    onHelpOpen: () => actions.setHelpOpen(true),
    onLibraryFocusModeChange: (nextMode) =>
      actions.updateSettings({
        leftPanelMode: nextMode,
        showFileTree: true,
      }),
    onSearchOpen: () => actions.setSearchOpen(true),
    onSelectionChange: actions.setCurrentSelection,
    onStatusMessage: actions.setStatusMessage,
    onTocToggle: () => actions.updateSettings({ showToc: !settings.showToc }),
  })

  return (
    <ReaderWorkspaceProvider value={workspace}>
      <div
        ref={shellRef}
        className={clsx('reader-shell', `mode-${settings.mode}`)}
        style={rootStyle}
        onDragOver={(event) => event.preventDefault()}
        onDrop={actions.handleDrop}
      >
        <div ref={chromeRef} className="reader-chrome">
          <ReaderToolbar />
          <div className="progress-rail">
            <span className="progress-bar" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        <div
          className={clsx('reader-layout', {
            'file-panel-hidden': !settings.showFileTree,
            'toc-panel-hidden': !settings.showToc,
            'left-panel-full': isLeftPanelFull,
          })}
        >
          <FilePanel />
          <DocumentPanel
            activeHeadingId={activeHeadingId}
            activeLabel={bookmarkLabel}
            components={markdownComponents}
            stats={stats}
          />
          <NavigatorPanel tocItems={filteredTocItems} />
        </div>

        <div className="status-toast">{statusMessage}</div>

        <SearchModal />
        <KeyboardShortcutsModal />
        <SettingsModal />
        <CommandPaletteModal />
        <ImageLightbox imageSources={imageSources} />
      </div>
    </ReaderWorkspaceProvider>
  )
}

export default ReaderApp
