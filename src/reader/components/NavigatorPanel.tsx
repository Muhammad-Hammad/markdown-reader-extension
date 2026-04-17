import clsx from 'clsx'
import { ChevronDown, Keyboard, ListTree } from 'lucide-react'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { TocItem } from '../../shared/types'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'
import { getAncestorHeadingIds } from '../utils'

function NavigatorPanel({ tocItems }: { tocItems: TocItem[] }) {
  const {
    actions: { jumpToHeading, jumpToNote, setHelpOpen, setTocFilter },
    derived: { activeBookmarks, activeHighlights, activeNotes },
    state: { activeHeadingId, settings, tocFilter },
  } = useReaderWorkspaceContext()

  const activeAncestorIds = useMemo(
    () => getAncestorHeadingIds(tocItems, activeHeadingId),
    [tocItems, activeHeadingId],
  )

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

      <div className="panel-stack panel-stack--scroll">
        <div className="panel-sticky-top">
          <label className="search-input">
            <ListTree size={14} />
            <input
              value={tocFilter}
              onChange={(event) => setTocFilter(event.target.value)}
              placeholder="Filter headings"
            />
          </label>
        </div>

        <CollapsibleSection title="Table of contents" count={tocItems.length}>
          <ul className="toc-list">
            {tocItems.map((item) => (
              <li
                key={item.id}
                className={clsx('toc-item', { 'active-ancestor': activeAncestorIds.has(item.id) })}
                data-depth={item.depth}
                style={{ '--toc-depth': item.depth } as CSSProperties}
              >
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
        </CollapsibleSection>

        <CollapsibleSection title="Bookmarks" count={activeBookmarks.length}>
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
        </CollapsibleSection>

        <CollapsibleSection title="Notes" count={activeNotes.length}>
          <ul className="compact-list">
            {activeNotes.map((note) => (
              <li key={note.id}>
                <button type="button" className="search-result note-link" onClick={() => jumpToNote(note)}>
                  <strong>{note.quote}</strong>
                  <p>{note.note}</p>
                  <span>{note.headingId ? `Section: ${getHeadingLabel(tocItems, note.headingId)}` : 'Saved note location'}</span>
                </button>
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="Highlights" count={activeHighlights.length}>
          <ul className="compact-list">
            {activeHighlights.map((highlight) => (
              <li key={highlight.id} className="annotation-card">
                <strong>{highlight.quote}</strong>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      </div>
    </aside>
  )
}

interface CollapsibleSectionProps {
  title: string
  count: number
  children: ReactNode
  defaultExpanded?: boolean
}

function CollapsibleSection({ title, count, children, defaultExpanded = true }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section className="sidebar-section">
      <button
        type="button"
        className="panel-section-header"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="sidebar-title">{title}</span>
        <span className="panel-section-meta">
          <span className="section-count-badge" aria-label={`${count} items`}>
            {count}
          </span>
          <ChevronDown size={16} className="panel-section-chevron" aria-hidden />
        </span>
      </button>
      {expanded ? <div className="panel-section-body">{children}</div> : null}
    </section>
  )
}

function getHeadingLabel(tocItems: TocItem[], headingId: string) {
  return tocItems.find((item) => item.id === headingId)?.text ?? headingId
}

export default NavigatorPanel
