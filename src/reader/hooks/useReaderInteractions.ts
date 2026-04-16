import { type RefObject, useEffect } from 'react'
import { readFromSourceUrl } from '../../shared/fs'
import type { ReaderDocument } from '../../shared/types'

interface ReaderInteractionOptions {
  activeDocument?: ReaderDocument
  articleRef: RefObject<HTMLElement | null>
  contentScrollRef: RefObject<HTMLDivElement | null>
  fileSearchInputRef: RefObject<HTMLInputElement | null>
  contentSearchInputRef: RefObject<HTMLInputElement | null>
  autoRefresh: boolean
  cycleMode: () => void
  onActiveHeadingChange: (headingId: string) => void
  onActiveParagraphChange: (index: number) => void
  onDocumentRefresh: (document: ReaderDocument) => void
  onCommandPaletteToggle: () => void
  onHelpOpen: () => void
  onSelectionChange: (selection: string) => void
  onSearchOpen: () => void
  onStatusMessage: (message: string) => void
  onTocToggle: () => void
}

export function useReaderInteractions({
  activeDocument,
  articleRef,
  autoRefresh,
  contentScrollRef,
  contentSearchInputRef,
  cycleMode,
  fileSearchInputRef,
  onActiveHeadingChange,
  onActiveParagraphChange,
  onCommandPaletteToggle,
  onDocumentRefresh,
  onHelpOpen,
  onSearchOpen,
  onSelectionChange,
  onStatusMessage,
  onTocToggle,
}: ReaderInteractionOptions) {
  useEffect(() => {
    if (!activeDocument || !autoRefresh) {
      return
    }

    const refreshDocument = async () => {
      try {
        if (activeDocument.fileHandle) {
          const file = await activeDocument.fileHandle.getFile()
          if (file.lastModified > activeDocument.updatedAt) {
            onDocumentRefresh({
              ...activeDocument,
              content: await file.text(),
              updatedAt: file.lastModified,
            })
            onStatusMessage(`Auto-refreshed ${activeDocument.title}`)
          }
          return
        }

        if (activeDocument.sourceUrl) {
          const refreshed = await readFromSourceUrl(activeDocument.sourceUrl)
          if (refreshed.content !== activeDocument.content) {
            onDocumentRefresh(refreshed)
            onStatusMessage(`Fetched latest content from ${activeDocument.sourceUrl}`)
          }
        }
      } catch {
        onStatusMessage('Auto-refresh skipped because the current source is unavailable.')
      }
    }

    const interval = window.setInterval(() => {
      void refreshDocument()
    }, 4000)

    return () => window.clearInterval(interval)
  }, [activeDocument, autoRefresh, onDocumentRefresh, onStatusMessage])

  useEffect(() => {
    const container = articleRef.current
    if (!container) {
      return
    }

    const headings = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4'))
    if (headings.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]

        if (visible?.target instanceof HTMLElement) {
          onActiveHeadingChange(visible.target.id)
        }
      },
      {
        root: contentScrollRef.current,
        rootMargin: '-10% 0px -70% 0px',
        threshold: [0.1, 0.5, 1],
      },
    )

    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [activeDocument?.id, articleRef, contentScrollRef, onActiveHeadingChange])

  useEffect(() => {
    const container = articleRef.current
    if (!container) {
      return
    }

    const paragraphs = Array.from(container.querySelectorAll<HTMLElement>('p'))
    paragraphs.forEach((paragraph, index) => {
      paragraph.dataset.focusIndex = String(index)
    })

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]

        if (visible?.target instanceof HTMLElement) {
          onActiveParagraphChange(Number(visible.target.dataset.focusIndex ?? '0'))
        }
      },
      {
        root: contentScrollRef.current,
        rootMargin: '-10% 0px -40% 0px',
        threshold: [0.4, 0.7, 1],
      },
    )

    paragraphs.forEach((paragraph) => observer.observe(paragraph))
    return () => observer.disconnect()
  }, [activeDocument?.id, articleRef, contentScrollRef, onActiveParagraphChange])

  useEffect(() => {
    const updateSelection = () => {
      const selection = window.getSelection()
      onSelectionChange(selection?.toString().trim() ?? '')
    }

    document.addEventListener('selectionchange', updateSelection)
    return () => document.removeEventListener('selectionchange', updateSelection)
  }, [onSelectionChange])

  useEffect(() => {
    const handleKeydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        onHelpOpen()
      }

      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        fileSearchInputRef.current?.focus()
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onCommandPaletteToggle()
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        onSearchOpen()
        window.setTimeout(() => contentSearchInputRef.current?.focus(), 20)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        onTocToggle()
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        cycleMode()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [contentSearchInputRef, cycleMode, fileSearchInputRef, onCommandPaletteToggle, onHelpOpen, onSearchOpen, onTocToggle])
}
