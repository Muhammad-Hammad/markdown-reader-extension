import clsx from 'clsx'
import { useMemo } from 'react'
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
import { getBookmarkLabel } from './utils'

function ReaderApp() {
  const workspace = useReaderWorkspace()
  const {
    actions,
    refs,
    state: { activeDocument, activeHeadingId, activeParagraphIndex, settings, statusMessage, tocFilter, progress },
  } = workspace

  const { imageSources, markdownComponents, rootStyle, stats, tocItems } = useReaderDocumentView({
    activeDocument,
    activeParagraphIndex,
    onLightboxOpen: (index) => actions.setLightboxIndex(index),
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

  useReaderInteractions({
    activeDocument,
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
    onSearchOpen: () => actions.setSearchOpen(true),
    onSelectionChange: actions.setCurrentSelection,
    onStatusMessage: actions.setStatusMessage,
    onTocToggle: () => actions.updateSettings({ showToc: !settings.showToc }),
  })

  return (
    <ReaderWorkspaceProvider value={workspace}>
      <div
        className={clsx('reader-shell', `mode-${settings.mode}`)}
        style={rootStyle}
        onDragOver={(event) => event.preventDefault()}
        onDrop={actions.handleDrop}
      >
        <ReaderToolbar />

        <div className="progress-rail">
          <span className="progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="reader-layout">
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
