import clsx from 'clsx'
import DOMPurify from 'dompurify'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import type { ReadAloudSpokenFeedback } from '../hooks/useReadAloudController'
import type { ReaderDocument, TocItem } from '../../shared/types'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'
import { buildTextPositionIndex, captureSelectionLocation, createTextRange } from '../utils'
import DocumentHero from './DocumentHero'
import DocumentStatusBar from './DocumentStatusBar'
import EmptyState from './EmptyState'
import FrontmatterCard from './FrontmatterCard'
import NoteComposerModal from './NoteComposerModal'
import ReadAloudPanel from './ReadAloudPanel'

const SENTENCE_HIGHLIGHT_NAME = 'reader-read-aloud-sentence'
const WORD_HIGHLIGHT_NAME = 'reader-read-aloud-word'

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
    actions: { saveSelectionAsNote, setStatusMessage, setTocItems },
    refs: { articleRef, contentScrollRef },
    state: { activeDocument, currentSelection, settings },
  } = useReaderWorkspaceContext()
  const textIndexRef = useRef<ReturnType<typeof buildTextPositionIndex> | null>(null)
  const lastTocSignatureRef = useRef('[]')
  const [noteComposerOpen, setNoteComposerOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSelectionQuote, setNoteSelectionQuote] = useState('')
  const [noteSelectionLocation, setNoteSelectionLocation] = useState<{
    headingId?: string
    selectionStart?: number
    selectionEnd?: number
  } | null>(null)

  const handleSpokenFeedback = useCallback((feedback: ReadAloudSpokenFeedback | null) => {
    syncSpeechHighlights(textIndexRef.current, feedback)
  }, [])

  const openNoteComposer = useCallback(() => {
    const selectedQuote = currentSelection.trim() || window.getSelection()?.toString().trim() || ''

    if (!selectedQuote) {
      setStatusMessage('Select text inside the document first.')
      return
    }

    setNoteSelectionQuote(selectedQuote)
    setNoteSelectionLocation(
      articleRef.current ? captureSelectionLocation(articleRef.current, window.getSelection()) : null,
    )
    setNoteDraft('')
    setNoteComposerOpen(true)
  }, [articleRef, currentSelection, setStatusMessage])

  const closeNoteComposer = useCallback(() => {
    setNoteComposerOpen(false)
    setNoteSelectionQuote('')
    setNoteSelectionLocation(null)
  }, [])

  const handleNoteSave = useCallback(() => {
    const noteSnapshot = {
      quote: noteSelectionQuote,
      ...(noteSelectionLocation ?? {}),
    }
    const saved = saveSelectionAsNote(noteDraft, noteSnapshot)
    if (saved) {
      setNoteComposerOpen(false)
      setNoteDraft('')
      setNoteSelectionQuote('')
      setNoteSelectionLocation(null)
    }
  }, [noteDraft, noteSelectionLocation, noteSelectionQuote, saveSelectionAsNote])

  useLayoutEffect(() => {
    const article = articleRef.current

    if (!article) {
      textIndexRef.current = null
      lastTocSignatureRef.current = '[]'
      setTocItems([])
      clearSpeechHighlights()
      return
    }

    const syncArticleState = () => {
      const nextTocItems = scanTocItems(article)
      const nextSignature = JSON.stringify(nextTocItems)

      if (lastTocSignatureRef.current !== nextSignature) {
        lastTocSignatureRef.current = nextSignature
        setTocItems(nextTocItems)
      }

      textIndexRef.current = buildTextPositionIndex(article)
      clearSpeechHighlights()
    }

    syncArticleState()

    const observer = new MutationObserver(() => {
      syncArticleState()
    })

    observer.observe(article, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => observer.disconnect()
  }, [activeDocument?.content, activeDocument?.id, articleRef, setTocItems])

  useEffect(
    () => () => {
      clearSpeechHighlights()
    },
    [],
  )

  return (
    <main className="content-panel">
      <DocumentHero
        activeLabel={activeLabel}
        activeHeadingId={activeHeadingId}
        stats={stats}
        onOpenNoteComposer={openNoteComposer}
      />

      <ReadAloudPanel activeHeadingId={activeHeadingId} onSpokenFeedback={handleSpokenFeedback} />

      {noteComposerOpen ? (
        <NoteComposerModal
          noteDraft={noteDraft}
          selectionQuote={noteSelectionQuote}
          onClose={closeNoteComposer}
          onDraftChange={setNoteDraft}
          onSave={handleNoteSave}
        />
      ) : null}

      <div className="document-frame" ref={contentScrollRef} tabIndex={-1}>
        <ReaderDocumentArticle
          activeDocument={activeDocument}
          articleRef={articleRef}
          components={components}
          focusMode={settings.mode === 'focus'}
          isCentered={settings.centered}
        />
      </div>

      {settings.showStatusBar ? <DocumentStatusBar stats={stats} /> : null}
    </main>
  )
}

export default DocumentPanel

function syncSpeechHighlights(
  textIndex: ReturnType<typeof buildTextPositionIndex> | null,
  spokenFeedback: ReadAloudSpokenFeedback | null,
) {
  clearSpeechHighlights()
  const highlightRegistry = getHighlightRegistry()
  const HighlightConstructor = getHighlightConstructor()
  if (
    !textIndex ||
    !spokenFeedback?.chunkText ||
    spokenFeedback.documentOffsetStart === null ||
    !highlightRegistry ||
    !HighlightConstructor
  ) {
    return
  }

  const sentenceRange = createTextRange(
    textIndex.positions,
    spokenFeedback.documentOffsetStart,
    spokenFeedback.documentOffsetStart + spokenFeedback.chunkText.length,
  )
  if (sentenceRange) {
    highlightRegistry.set(SENTENCE_HIGHLIGHT_NAME, new HighlightConstructor(sentenceRange))
  }

  if (!spokenFeedback.currentWord || spokenFeedback.wordOffsetStart === null) {
    return
  }

  const wordRange = createTextRange(
    textIndex.positions,
    spokenFeedback.documentOffsetStart + spokenFeedback.wordOffsetStart,
    spokenFeedback.documentOffsetStart + spokenFeedback.wordOffsetStart + spokenFeedback.currentWord.length,
  )
  if (wordRange) {
    highlightRegistry.set(WORD_HIGHLIGHT_NAME, new HighlightConstructor(wordRange))
  }
}

function clearSpeechHighlights() {
  const highlightRegistry = getHighlightRegistry()
  highlightRegistry?.delete(SENTENCE_HIGHLIGHT_NAME)
  highlightRegistry?.delete(WORD_HIGHLIGHT_NAME)
}

function getHighlightRegistry() {
  return (globalThis.CSS as typeof CSS & {
    highlights?: {
      delete: (name: string) => void
      set: (name: string, highlight: object) => void
    }
  }).highlights
}

function getHighlightConstructor() {
  return (globalThis as typeof globalThis & {
    Highlight?: new (...ranges: Range[]) => object
  }).Highlight
}

function scanTocItems(article: HTMLElement): TocItem[] {
  const headings = Array.from(article.querySelectorAll<HTMLElement>('h1, h2, h3, h4'))

  return headings
    .map((heading) => ({
      id: heading.id,
      depth: Number(heading.tagName[1]),
      text: heading.textContent?.trim() ?? '',
    }))
    .filter((heading) => heading.id && heading.text)
}

const ReaderDocumentArticle = memo(function ReaderDocumentArticle({
  activeDocument,
  articleRef,
  components,
  focusMode,
  isCentered,
}: {
  activeDocument?: ReaderDocument
  articleRef: React.RefObject<HTMLElement | null>
  components: Components
  focusMode: boolean
  isCentered: boolean
}) {
  return (
    <article
      ref={articleRef}
      className={clsx('markdown-article', {
        centered: isCentered,
        focus: focusMode,
      })}
    >
      {activeDocument ? (
        <>
          <FrontmatterCard content={activeDocument.content} />
          <ReactMarkdown
            remarkPlugins={[remarkFrontmatter, remarkGfm, remarkMath, remarkBreaks]}
            rehypePlugins={[
              rehypeRaw,
              rehypeSlug,
              rehypeKatex,
              // `plainText` tells rehype-highlight to leave these languages
              // completely untouched. Without this, mermaid blocks get wrapped
              // in <span class="hljs-*"> nodes and whitespace/newlines the
              // mermaid parser depends on can be lost in the React tree.
              [rehypeHighlight, { plainText: ['mermaid'], ignoreMissing: true }],
            ]}
            components={components}
          >
            {DOMPurify.sanitize(activeDocument.content)}
          </ReactMarkdown>
        </>
      ) : (
        <EmptyState />
      )}
    </article>
  )
})
