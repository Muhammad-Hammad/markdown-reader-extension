import { ChevronUp, Download, FileText, Highlighter, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

interface DocumentStatusBarProps {
  stats: { characters: number; readMinutes: number; words: number }
}

function DocumentStatusBar({ stats }: DocumentStatusBarProps) {
  const {
    actions: { exportHighlights, exportHtml, printDocument },
    derived: { activeHighlights },
    state: { activeDocument, progress },
  } = useReaderWorkspaceContext()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const progressPercent = Math.round(progress * 100)
  const hasHighlights = activeHighlights.length > 0
  const disableExports = !activeDocument

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current) return
      if (menuRef.current.contains(event.target as Node)) return
      setMenuOpen(false)
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [menuOpen])

  return (
    <footer className="status-bar">
      <div className="status-metrics">
        <span>{stats.words.toLocaleString()} words</span>
        <span>{stats.characters.toLocaleString()} chars</span>
        <span>{stats.readMinutes} min read</span>
        <span className="status-progress" aria-label={`Reading progress ${progressPercent}%`}>
          <span className="status-progress-track" aria-hidden>
            <span className="status-progress-fill" style={{ width: `${progressPercent}%` }} />
          </span>
          <span className="status-progress-label">{progressPercent}%</span>
        </span>
      </div>
      <div className="status-actions">
        <div className="export-menu" ref={menuRef}>
          <button
            type="button"
            className="toolbar-button ghost"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={disableExports}
          >
            <Download size={14} />
            Export
            <ChevronUp size={14} aria-hidden />
          </button>
          {menuOpen ? (
            <div className="export-menu-list" role="menu">
              <button
                type="button"
                className="export-menu-item"
                role="menuitem"
                onClick={() => {
                  exportHtml()
                  setMenuOpen(false)
                }}
                disabled={disableExports}
              >
                <FileText size={14} />
                Export rendered HTML
              </button>
              <button
                type="button"
                className="export-menu-item"
                role="menuitem"
                onClick={() => {
                  exportHighlights(activeHighlights.map((item) => item.quote))
                  setMenuOpen(false)
                }}
                disabled={!hasHighlights}
              >
                <Highlighter size={14} />
                Export highlights ({activeHighlights.length})
              </button>
              <button
                type="button"
                className="export-menu-item"
                role="menuitem"
                onClick={() => {
                  printDocument()
                  setMenuOpen(false)
                }}
                disabled={disableExports}
              >
                <Printer size={14} />
                Print / Save as PDF
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  )
}

export default DocumentStatusBar
