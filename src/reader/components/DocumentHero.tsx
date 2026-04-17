import { Highlighter, NotebookPen, Sparkles } from 'lucide-react'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

interface DocumentHeroProps {
  activeLabel: string
  activeHeadingId: string
  stats: { characters: number; readMinutes: number; words: number }
  onOpenNoteComposer: () => void
}

function DocumentHero({ activeLabel, activeHeadingId, stats, onOpenNoteComposer }: DocumentHeroProps) {
  const {
    actions: { bookmarkCurrentSection, saveSelectionAsHighlight },
    state: { activeDocument },
  } = useReaderWorkspaceContext()

  const title = activeDocument?.title ?? 'Markdown Reader Workspace'
  const subtitle = activeDocument?.path ?? 'Drop a file, open a folder, or paste a source URL to get started.'
  const eyebrowLabel = activeDocument ? 'Now reading' : 'Waiting for a source'

  return (
    <section className="hero-strip">
      <div className="hero-lede">
        <div className="hero-eyebrow">
          <span className="hero-eyebrow-accent">{eyebrowLabel}</span>
          {activeDocument ? (
            <>
              <span className="hero-meta-dot" aria-hidden />
              <span>{stats.words.toLocaleString()} words</span>
              <span className="hero-meta-dot" aria-hidden />
              <span>{stats.readMinutes} min read</span>
            </>
          ) : null}
        </div>
        <h1 title={title}>{title}</h1>
        <p className="hero-subtitle" title={subtitle}>{subtitle}</p>
      </div>
      <div className="hero-actions">
        <button
          type="button"
          className="toolbar-button ghost"
          onClick={() => bookmarkCurrentSection(activeLabel, activeHeadingId)}
          disabled={!activeDocument}
        >
          <Sparkles size={16} />
          Bookmark section
        </button>
        <button
          type="button"
          className="toolbar-button ghost"
          onClick={saveSelectionAsHighlight}
          disabled={!activeDocument}
        >
          <Highlighter size={16} />
          Save highlight
        </button>
        <button
          type="button"
          className="toolbar-button ghost"
          onClick={onOpenNoteComposer}
          disabled={!activeDocument}
        >
          <NotebookPen size={16} />
          Save note
        </button>
      </div>
    </section>
  )
}

export default DocumentHero
