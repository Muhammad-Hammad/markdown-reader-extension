import { type RefObject, useEffect } from 'react'
import { readFromSourceUrl } from '../../shared/fs'
import type { ReaderDocument } from '../../shared/types'

interface ReaderInteractionOptions {
  activeDocument?: ReaderDocument
  leftPanelMode: 'docked' | 'full'
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
  onLibraryFocusModeChange: (nextMode: 'docked' | 'full') => void
  onSelectionChange: (selection: string) => void
  onSearchOpen: () => void
  onStatusMessage: (message: string) => void
  onTocToggle: () => void
}

export function useReaderInteractions({
  activeDocument,
  leftPanelMode,
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
  onLibraryFocusModeChange,
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
        root: null,
        rootMargin: '-10% 0px -70% 0px',
        threshold: [0.1, 0.5, 1],
      },
    )

    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [activeDocument?.content, activeDocument?.id, articleRef, contentScrollRef, onActiveHeadingChange])

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
        root: null,
        rootMargin: '-10% 0px -40% 0px',
        threshold: [0.4, 0.7, 1],
      },
    )

    paragraphs.forEach((paragraph) => observer.observe(paragraph))
    return () => observer.disconnect()
  }, [activeDocument?.content, activeDocument?.id, articleRef, contentScrollRef, onActiveParagraphChange])

  useEffect(() => {
    let frameId = 0
    const updateSelection = () => {
      const selection = window.getSelection()
      onSelectionChange(selection?.toString().trim() ?? '')
    }
    const scheduleSelectionUpdate = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(updateSelection)
    }
    const article = articleRef.current

    document.addEventListener('selectionchange', scheduleSelectionUpdate)
    article?.addEventListener('pointerup', scheduleSelectionUpdate)
    article?.addEventListener('keyup', scheduleSelectionUpdate)

    return () => {
      window.cancelAnimationFrame(frameId)
      document.removeEventListener('selectionchange', scheduleSelectionUpdate)
      article?.removeEventListener('pointerup', scheduleSelectionUpdate)
      article?.removeEventListener('keyup', scheduleSelectionUpdate)
    }
  }, [articleRef, onSelectionChange])

  useEffect(() => {
    const handleKeydown = (event: globalThis.KeyboardEvent) => {
      if (document.querySelector('.modal-shell')) {
        return
      }

      if (isEditableTarget(event.target) && !event.ctrlKey && !event.metaKey) {
        return
      }

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

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        const nextMode = leftPanelMode === 'full' ? 'docked' : 'full'
        onLibraryFocusModeChange(nextMode)
        window.setTimeout(() => {
          const focusTarget = nextMode === 'full' ? contentScrollRef.current : fileSearchInputRef.current
          focusTarget?.focus()
        }, 20)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [
    contentSearchInputRef,
    cycleMode,
    fileSearchInputRef,
    leftPanelMode,
    onCommandPaletteToggle,
    onHelpOpen,
    onLibraryFocusModeChange,
    onSearchOpen,
    onTocToggle,
  ])
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}
