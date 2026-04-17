import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReaderDocument } from '../../shared/types'
import { getTextStats, normalizePlainText, type TextStats } from '../utils'

export type ReadAloudSourceMode = 'document' | 'selection' | 'section' | 'paragraph'
type PlaybackState = 'idle' | 'playing' | 'paused'

export interface ReadAloudSourceSummary {
  mode: ReadAloudSourceMode
  label: string
  text: string
  stats: TextStats
  documentOffsetStart: number | null
}

export interface ReadAloudSpokenFeedback {
  sourceMode: ReadAloudSourceMode
  chunkText: string
  currentWord: string
  documentOffsetStart: number | null
  wordOffsetStart: number | null
}

const MAX_SPEECH_CHUNK_LENGTH = 900

interface UseReadAloudControllerOptions {
  activeDocument?: ReaderDocument
  activeHeadingId: string
  activeParagraphIndex: number
  articleRef: RefObject<HTMLElement | null>
  currentSelection: string
  onSpokenFeedback?: (feedback: ReadAloudSpokenFeedback | null) => void
  onRateChange: (rate: number) => void
  onStatusMessage: (message: string) => void
  onVoiceURIChange: (voiceURI: string) => void
  rate: number
  voiceURI: string
}

export function useReadAloudController({
  activeDocument,
  activeHeadingId,
  activeParagraphIndex,
  articleRef,
  currentSelection,
  onSpokenFeedback,
  onRateChange,
  onStatusMessage,
  onVoiceURIChange,
  rate,
  voiceURI,
}: UseReadAloudControllerOptions) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const playbackTokenRef = useRef(0)
  const playbackOffsetRef = useRef(0)
  const lastRateRef = useRef(rate)
  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
  const [activeSourceMode, setActiveSourceMode] = useState<ReadAloudSourceMode | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [sources, setSources] = useState<Record<ReadAloudSourceMode, ReadAloudSourceSummary>>(() =>
    getReadAloudSources({
      activeHeadingId: '',
      activeParagraphIndex: 0,
      article: null,
      currentSelection: '',
    }),
  )

  const refreshVoices = useCallback(() => {
    if (!isSupported) {
      return
    }

    const nextVoices = window.speechSynthesis.getVoices()
    setVoices(nextVoices)

    if (!voiceURI && nextVoices.length > 0) {
      const preferredVoice =
        nextVoices.find((voice) => voice.default) ??
        nextVoices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ??
        nextVoices[0]
      onVoiceURIChange(preferredVoice.voiceURI)
    }
  }, [isSupported, onVoiceURIChange, voiceURI])

  const selectedVoice = useMemo(() => {
    if (voices.length === 0) {
      return null
    }

    return voices.find((voice) => voice.voiceURI === voiceURI) ?? voices[0]
  }, [voiceURI, voices])

  const stop = useCallback(
    (shouldResetSource = true) => {
      if (!isSupported) {
        return
      }

      playbackTokenRef.current += 1
      window.speechSynthesis.cancel()
      utteranceRef.current = null
      playbackOffsetRef.current = 0
      setPlaybackState('idle')
      onSpokenFeedback?.(null)
      if (shouldResetSource) {
        setActiveSourceMode(null)
      }
    },
    [isSupported, onSpokenFeedback],
  )

  const startPlayback = useCallback(
    (mode: ReadAloudSourceMode, startOffset = 0) => {
      if (!isSupported) {
        onStatusMessage('Read aloud is not supported in this browser.')
        return
      }

      const source = sources[mode]
      if (!source?.text) {
        onStatusMessage(`No readable ${source?.label.toLowerCase() ?? 'content'} is available yet.`)
        return
      }

      const clampedStartOffset = Math.max(0, Math.min(Math.round(startOffset), Math.max(source.text.length - 1, 0)))
      const textToRead = source.text.slice(clampedStartOffset)
      if (!textToRead) {
        stop()
        return
      }

      playbackOffsetRef.current = clampedStartOffset
      window.speechSynthesis.cancel()
      playbackTokenRef.current += 1
      const playbackToken = playbackTokenRef.current

      const chunks = chunkTextForSpeech(textToRead).map((chunk) => ({
        ...chunk,
        start: chunk.start + clampedStartOffset,
        end: chunk.end + clampedStartOffset,
      }))
      if (chunks.length === 0) {
        onStatusMessage(`No readable ${source.label.toLowerCase()} is available yet.`)
        return
      }

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk.text)
        utterance.rate = rate
        if (selectedVoice) {
          utterance.voice = selectedVoice
          utterance.lang = selectedVoice.lang
        }

        utterance.onstart = () => {
          if (playbackToken !== playbackTokenRef.current) {
            return
          }
          playbackOffsetRef.current = chunk.start
          setPlaybackState('playing')
          setActiveSourceMode(mode)
          onSpokenFeedback?.({
            sourceMode: mode,
            chunkText: chunk.text,
            currentWord: getChunkWord(chunk.text, 0),
            documentOffsetStart:
              source.documentOffsetStart === null ? null : source.documentOffsetStart + chunk.start,
            wordOffsetStart: 0,
          })
        }
        utterance.onpause = () => {
          if (playbackToken !== playbackTokenRef.current) {
            return
          }
          setPlaybackState('paused')
        }
        utterance.onresume = () => {
          if (playbackToken !== playbackTokenRef.current) {
            return
          }
          setPlaybackState('playing')
        }
        utterance.onboundary = (event) => {
          if (playbackToken !== playbackTokenRef.current) {
            return
          }

          const wordOffsetStart = event.name === 'word' ? event.charIndex : null
          playbackOffsetRef.current = chunk.start + Math.max(event.charIndex, 0)
          onSpokenFeedback?.({
            sourceMode: mode,
            chunkText: chunk.text,
            currentWord: getChunkWord(chunk.text, event.charIndex),
            documentOffsetStart:
              source.documentOffsetStart === null ? null : source.documentOffsetStart + chunk.start,
            wordOffsetStart,
          })
        }
        utterance.onend = () => {
          if (playbackToken !== playbackTokenRef.current || index !== chunks.length - 1) {
            playbackOffsetRef.current = chunk.end
            return
          }
          playbackOffsetRef.current = source.text.length
          utteranceRef.current = null
          setPlaybackState('idle')
          setActiveSourceMode(null)
          onSpokenFeedback?.(null)
        }
        utterance.onerror = () => {
          if (playbackToken !== playbackTokenRef.current) {
            return
          }
          utteranceRef.current = null
          setPlaybackState('idle')
          setActiveSourceMode(null)
          onSpokenFeedback?.(null)
          onStatusMessage('Read aloud stopped because the selected voice failed.')
        }

        if (index === 0) {
          utteranceRef.current = utterance
        }
        window.speechSynthesis.speak(utterance)
      })
      onStatusMessage(`Reading ${source.label.toLowerCase()}.`)
    },
    [isSupported, onSpokenFeedback, onStatusMessage, rate, selectedVoice, sources, stop],
  )

  const play = useCallback(
    (mode: ReadAloudSourceMode) => {
      playbackOffsetRef.current = 0
      startPlayback(mode, 0)
    },
    [startPlayback],
  )

  const togglePlayback = useCallback(() => {
    if (!isSupported) {
      return
    }

    if (playbackState === 'playing') {
      window.speechSynthesis.pause()
      return
    }

    if (playbackState === 'paused') {
      window.speechSynthesis.resume()
      return
    }

    if (activeSourceMode) {
      play(activeSourceMode)
    }
  }, [activeSourceMode, isSupported, playbackState, play])

  useEffect(() => {
    if (!isSupported) {
      return
    }

    const speechSynthesisApi = window.speechSynthesis
    const voiceRefreshTimeout = window.setTimeout(() => {
      refreshVoices()
    }, 0)
    speechSynthesisApi.addEventListener('voiceschanged', refreshVoices)

    return () => {
      window.clearTimeout(voiceRefreshTimeout)
      speechSynthesisApi.removeEventListener('voiceschanged', refreshVoices)
    }
  }, [isSupported, refreshVoices])

  useEffect(() => {
    if (!isSupported) {
      lastRateRef.current = rate
      return
    }

    if (lastRateRef.current === rate) {
      return
    }

    lastRateRef.current = rate
    if (playbackState !== 'playing' || !activeSourceMode) {
      return
    }

    const restartTimeout = window.setTimeout(() => {
      startPlayback(activeSourceMode, playbackOffsetRef.current)
    }, 0)

    return () => window.clearTimeout(restartTimeout)
  }, [activeSourceMode, isSupported, playbackState, rate, startPlayback])

  useEffect(() => {
    const article = articleRef.current
    setSources(
      getReadAloudSources({
        activeHeadingId,
        activeParagraphIndex,
        article,
        currentSelection,
      }),
    )
  }, [activeHeadingId, activeParagraphIndex, articleRef, currentSelection, activeDocument?.content, activeDocument?.id])

  useEffect(() => {
    const stopTimeout = window.setTimeout(() => {
      stop()
    }, 0)

    return () => window.clearTimeout(stopTimeout)
  }, [activeDocument?.content, activeDocument?.id, stop])

  useEffect(
    () => () => {
      stop()
    },
    [stop],
  )

  return {
    activeSourceMode,
    isSupported,
    playbackState,
    play,
    selectedVoice,
    setRate: onRateChange,
    setVoiceURI: onVoiceURIChange,
    sources,
    stop,
    togglePlayback,
    voices,
  }
}

function getReadAloudSources({
  activeHeadingId,
  activeParagraphIndex,
  article,
  currentSelection,
}: {
  activeHeadingId: string
  activeParagraphIndex: number
  article: HTMLElement | null
  currentSelection: string
}): Record<ReadAloudSourceMode, ReadAloudSourceSummary> {
  const documentText = article ? getReadableArticleText(article) : ''
  const selectionText = normalizePlainText(currentSelection)
  const selectionOffset = selectionText && documentText ? documentText.indexOf(selectionText) : -1
  const section = getSectionText(article, activeHeadingId, documentText)
  const paragraph = getParagraphText(article, activeParagraphIndex, documentText)

  return {
    document: buildSourceSummary('document', 'Document', documentText, documentText ? 0 : null),
    selection: buildSourceSummary('selection', 'Selection', selectionText, selectionOffset >= 0 ? selectionOffset : null),
    section: buildSourceSummary('section', section.label, section.text, section.documentOffsetStart),
    paragraph: buildSourceSummary('paragraph', 'Current paragraph onward', paragraph.text, paragraph.documentOffsetStart),
  }
}

function buildSourceSummary(
  mode: ReadAloudSourceMode,
  label: string,
  text: string,
  documentOffsetStart: number | null,
): ReadAloudSourceSummary {
  return {
    mode,
    label,
    text,
    stats: getTextStats(text),
    documentOffsetStart,
  }
}

function getReadableArticleText(article: HTMLElement) {
  const clone = article.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.frontmatter-card, pre, code, script, style').forEach((node) => node.remove())
  return normalizePlainText(clone.innerText || clone.textContent || '')
}

function getSectionText(article: HTMLElement | null, activeHeadingId: string, documentText: string) {
  if (!article) {
    return {
      label: 'Current section',
      text: '',
      documentOffsetStart: null,
    }
  }

  const headings = Array.from(article.querySelectorAll<HTMLElement>('h1, h2, h3, h4'))
  if (headings.length === 0) {
    return {
      label: 'Current section',
      text: '',
      documentOffsetStart: null,
    }
  }

  const targetHeading = headings.find((heading) => heading.id === activeHeadingId) ?? headings[0]
  const targetLevel = Number(targetHeading.tagName.slice(1))
  const parts = [getNodeText(targetHeading)]

  let sibling = targetHeading.nextElementSibling
  while (sibling) {
    if (/^H[1-4]$/.test(sibling.tagName) && Number(sibling.tagName.slice(1)) <= targetLevel) {
      break
    }

    const value = getNodeText(sibling)
    if (value) {
      parts.push(value)
    }
    sibling = sibling.nextElementSibling
  }

  const text = normalizePlainText(parts.join(' '))
  return {
    label: targetHeading.innerText || targetHeading.textContent || 'Current section',
    text,
    documentOffsetStart: text ? documentText.indexOf(text) : null,
  }
}

function getParagraphText(article: HTMLElement | null, activeParagraphIndex: number, documentText: string) {
  if (!article) {
    return {
      text: '',
      documentOffsetStart: null,
    }
  }

  const paragraphs = Array.from(article.querySelectorAll<HTMLElement>('p'))
  if (paragraphs.length === 0) {
    return {
      text: '',
      documentOffsetStart: null,
    }
  }

  const text = normalizePlainText(
    paragraphs
      .slice(Math.max(activeParagraphIndex, 0))
      .map((paragraph) => getNodeText(paragraph))
      .filter(Boolean)
      .join(' '),
  )
  return {
    text,
    documentOffsetStart: text ? documentText.indexOf(text) : null,
  }
}

function getNodeText(node: Element) {
  if (node.matches('pre, code, script, style, .frontmatter-card')) {
    return ''
  }

  return normalizePlainText((node as HTMLElement).innerText || node.textContent || '')
}

function chunkTextForSpeech(text: string) {
  const normalized = normalizePlainText(text)
  if (!normalized) {
    return []
  }

  const segments = normalized
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  const chunks: Array<{ text: string; start: number; end: number }> = []
  let currentChunk = ''
  let currentChunkStart = 0
  let cursor = 0

  for (const segment of segments) {
    const segmentStart = normalized.indexOf(segment, cursor)
    cursor = segmentStart + segment.length + 1

    if (segment.length > MAX_SPEECH_CHUNK_LENGTH) {
      if (currentChunk) {
        chunks.push({
          text: currentChunk,
          start: currentChunkStart,
          end: currentChunkStart + currentChunk.length,
        })
        currentChunk = ''
      }

      for (const wordChunk of splitLongSegment(segment, segmentStart)) {
        chunks.push(wordChunk)
      }
      continue
    }

    const candidate = currentChunk ? `${currentChunk} ${segment}` : segment
    if (candidate.length > MAX_SPEECH_CHUNK_LENGTH) {
      chunks.push({
        text: currentChunk,
        start: currentChunkStart,
        end: currentChunkStart + currentChunk.length,
      })
      currentChunk = segment
      currentChunkStart = segmentStart
      continue
    }

    if (!currentChunk) {
      currentChunkStart = segmentStart
    }
    currentChunk = candidate
  }

  if (currentChunk) {
    chunks.push({
      text: currentChunk,
      start: currentChunkStart,
      end: currentChunkStart + currentChunk.length,
    })
  }

  return chunks
}

function splitLongSegment(segment: string, segmentStart: number) {
  const words = segment.split(/\s+/)
  const chunks: Array<{ text: string; start: number; end: number }> = []
  let currentChunk = ''
  let currentChunkStart = segmentStart
  let cursor = segmentStart

  for (const word of words) {
    const candidate = currentChunk ? `${currentChunk} ${word}` : word
    if (candidate.length > MAX_SPEECH_CHUNK_LENGTH && currentChunk) {
      chunks.push({
        text: currentChunk,
        start: currentChunkStart,
        end: currentChunkStart + currentChunk.length,
      })
      currentChunk = word
      currentChunkStart = cursor
      cursor = currentChunkStart + currentChunk.length + 1
      continue
    }

    if (!currentChunk) {
      currentChunkStart = cursor
    }
    currentChunk = candidate
    cursor = currentChunkStart + currentChunk.length + 1
  }

  if (currentChunk) {
    chunks.push({
      text: currentChunk,
      start: currentChunkStart,
      end: currentChunkStart + currentChunk.length,
    })
  }

  return chunks
}

function getChunkWord(text: string, charIndex: number) {
  const safeIndex = Math.max(Math.min(charIndex, text.length - 1), 0)
  const left = text.slice(0, safeIndex + 1).search(/\S+$/)
  const rightMatch = text.slice(safeIndex).match(/^\S+/)
  const right = rightMatch ? safeIndex + rightMatch[0].length : safeIndex + 1
  return text.slice(left >= 0 ? left : 0, right).trim()
}
