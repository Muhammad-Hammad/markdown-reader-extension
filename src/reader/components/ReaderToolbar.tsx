import clsx from 'clsx'
import {
  BookOpenText,
  FolderOpen,
  Globe,
  PanelLeft,
  PanelRight,
  Pin,
  PinOff,
  RefreshCcw,
  Search,
  Settings2,
} from 'lucide-react'
import { BRAND_MARK_PATH, BRAND_NAME, BRAND_TAGLINE } from '../../shared/brand'
import ThemeSwitcher from './ThemeSwitcher'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

function ReaderToolbar() {
  const {
    refs: { contentScrollRef, fileSearchInputRef },
    actions: {
      openFolder,
      openSingleFile,
      refreshFolder,
      setSearchOpen,
      setSettingsOpen,
      updateSettings,
    },
    state: { folderHandle, settings, sourceInput },
  } = useReaderWorkspaceContext()
  const isLibraryFocusMode = settings.showFileTree && settings.leftPanelMode === 'full'
  const decodedSource = sourceInput ? decodeAddress(sourceInput) : 'No document open'
  const toggleLibraryFocusMode = (nextMode: 'docked' | 'full') => {
    updateSettings({
      leftPanelMode: nextMode,
      showFileTree: true,
    })

    window.setTimeout(() => {
      const focusTarget = nextMode === 'full' ? contentScrollRef.current : fileSearchInputRef.current
      focusTarget?.focus()
    }, 20)
  }

  return (
    <header className="reader-toolbar">
      <div className="toolbar-group">
        <div className="toolbar-brand" aria-label={`${BRAND_NAME} brand`}>
          <img src={BRAND_MARK_PATH} alt="" width="34" height="34" className="toolbar-brand-mark" />
          <div className="toolbar-brand-copy">
            <strong>{BRAND_NAME}</strong>
            <span>{folderHandle ? `Mounted · ${folderHandle.name}` : BRAND_TAGLINE}</span>
          </div>
          {folderHandle ? <span className="toolbar-brand-dot" aria-label="Folder mounted" /> : null}
        </div>
        <button type="button" className="toolbar-button primary" onClick={openFolder}>
          <FolderOpen size={16} />
          Open folder
        </button>
        <button type="button" className="toolbar-button ghost" onClick={openSingleFile}>
          <BookOpenText size={16} />
          Open file
        </button>
        <button type="button" className="toolbar-button ghost" onClick={refreshFolder}>
          <RefreshCcw size={16} />
          Rescan
        </button>
      </div>

      <div className="source-bar" title={sourceInput ? decodedSource : undefined}>
        <Globe size={16} />
        <span className="source-address">{decodedSource}</span>
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={clsx('toolbar-button', 'icon', { 'toggle-active': settings.showFileTree })}
          onClick={() =>
            updateSettings({
              leftPanelMode: settings.showFileTree ? 'docked' : settings.leftPanelMode,
              showFileTree: !settings.showFileTree,
            })
          }
          title="Toggle file tree"
        >
          <PanelLeft size={16} />
        </button>
        <button
          type="button"
          className={clsx('toolbar-button', 'icon', { 'toggle-active': isLibraryFocusMode })}
          onClick={() => toggleLibraryFocusMode(isLibraryFocusMode ? 'docked' : 'full')}
          title={isLibraryFocusMode ? 'Leave reading focus mode' : 'Enter reading focus mode'}
        >
          {isLibraryFocusMode ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <button
          type="button"
          className={clsx('toolbar-button', 'icon', { 'toggle-active': settings.showToc })}
          onClick={() => updateSettings({ showToc: !settings.showToc })}
          title="Toggle TOC"
        >
          <PanelRight size={16} />
        </button>
        <ThemeSwitcher />
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
  )
}

function decodeAddress(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default ReaderToolbar
