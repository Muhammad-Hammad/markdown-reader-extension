import clsx from 'clsx'
import { Keyboard, ListTree } from 'lucide-react'
import type { TocItem } from '../../shared/types'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

function NavigatorPanel({ tocItems }: { tocItems: TocItem[] }) {
  const {
    actions: { jumpToHeading, setHelpOpen, setTocFilter },
    derived: { activeBookmarks, activeHighlights, activeNotes },
    state: { activeHeadingId, settings, tocFilter },
  } = useReaderWorkspaceContext()

  if (!settings.showToc) {
    return null
  }

  return (
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
            {tocItems.map((item) => (
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
  )
}

export default NavigatorPanel
