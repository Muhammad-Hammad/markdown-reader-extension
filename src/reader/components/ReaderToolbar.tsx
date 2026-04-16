import { BookOpenText, Globe, MoonStar, PanelLeft, PanelRight, RefreshCcw, Search, Settings2, Sun, FolderOpen } from 'lucide-react'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

function ReaderToolbar() {
  const {
    actions: {
      cycleMode,
      openFolder,
      openSingleFile,
      openSource,
      refreshFolder,
      setSearchOpen,
      setSettingsOpen,
      updateSettings,
      setSourceInput,
    },
    state: { settings, sourceInput },
  } = useReaderWorkspaceContext()

  return (
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
  )
}

export default ReaderToolbar
