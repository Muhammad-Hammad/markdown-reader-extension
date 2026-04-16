import clsx from 'clsx'
import DOMPurify from 'dompurify'
import { Download, Highlighter, NotebookPen, Sparkles } from 'lucide-react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkBreaks from 'remark-breaks'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'
import EmptyState from './EmptyState'
import FrontmatterCard from './FrontmatterCard'

function DocumentPanel({
  activeLabel,
  activeHeadingId,
  components,
  stats,
}: {
  activeLabel: string
  activeHeadingId: string
  components: Components
  stats: { characters: number; readMinutes: number; words: number }
}) {
  const {
    actions: {
      bookmarkCurrentSection,
      exportHighlights,
      exportHtml,
      printDocument,
      saveSelectionAsHighlight,
      saveSelectionAsNote,
    },
    derived: { activeHighlights },
    refs: { articleRef, contentScrollRef },
    state: { activeDocument, progress, settings },
  } = useReaderWorkspaceContext()

  return (
    <main className="content-panel">
      <section className="hero-strip">
        <div>
          <h1>{activeDocument?.title ?? 'Markdown Reader Workspace'}</h1>
          <p>{activeDocument?.path ?? 'Drop a file, open a folder, or paste a source URL to get started.'}</p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => bookmarkCurrentSection(activeLabel, activeHeadingId)}
          >
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
              <FrontmatterCard content={activeDocument.content} />
              <ReactMarkdown
                remarkPlugins={[remarkFrontmatter, remarkGfm, remarkMath, remarkBreaks]}
                rehypePlugins={[rehypeRaw, rehypeSlug, rehypeKatex, rehypeHighlight]}
                components={components}
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
            <button
              type="button"
              className="toolbar-button"
              onClick={() => exportHighlights(activeHighlights.map((item) => item.quote))}
            >
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
  )
}

export default DocumentPanel
