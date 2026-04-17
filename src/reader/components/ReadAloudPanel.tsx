import { Pause, Play, RotateCcw, Square, Volume2 } from 'lucide-react'
import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import {
  useReadAloudController,
  type ReadAloudSourceMode,
  type ReadAloudSpokenFeedback,
} from '../hooks/useReadAloudController'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

const SOURCE_MODES: Array<{ id: ReadAloudSourceMode; label: string }> = [
  { id: 'document', label: 'Document' },
  { id: 'section', label: 'Section' },
  { id: 'paragraph', label: 'Paragraph' },
  { id: 'selection', label: 'Selection' },
]

const STATE_COPY: Record<'idle' | 'playing' | 'paused', { label: string; tone: 'idle' | 'live' | 'pause' }> = {
  idle: { label: 'Idle', tone: 'idle' },
  playing: { label: 'Now reading', tone: 'live' },
  paused: { label: 'Paused', tone: 'pause' },
}

interface ReadAloudPanelProps {
  activeHeadingId: string
  onSpokenFeedback?: (feedback: ReadAloudSpokenFeedback | null) => void
}

function ReadAloudPanel({ activeHeadingId, onSpokenFeedback }: ReadAloudPanelProps) {
  const {
    actions: { setStatusMessage, updateSettings },
    refs: { articleRef },
    state: { activeDocument, activeParagraphIndex, currentSelection, settings },
  } = useReaderWorkspaceContext()

  // Local mirror of the boundary feedback so we can render the current-word
  // chip in this panel without making the parent re-render on every boundary.
  const [localFeedback, setLocalFeedback] = useState<ReadAloudSpokenFeedback | null>(null)

  const handleSpokenFeedback = useCallback(
    (feedback: ReadAloudSpokenFeedback | null) => {
      setLocalFeedback(feedback)
      onSpokenFeedback?.(feedback)
    },
    [onSpokenFeedback],
  )

  const controller = useReadAloudController({
    activeDocument,
    activeHeadingId,
    activeParagraphIndex,
    articleRef,
    currentSelection,
    onSpokenFeedback: handleSpokenFeedback,
    onRateChange: (nextRate) => updateSettings({ readAloudRate: nextRate }),
    onStatusMessage: setStatusMessage,
    onVoiceURIChange: (nextVoiceURI) => updateSettings({ readAloudVoiceURI: nextVoiceURI }),
    rate: settings.readAloudRate,
    voiceURI: settings.readAloudVoiceURI,
  })

  const {
    activeSourceMode,
    isSupported,
    playbackState,
    play,
    selectedVoice,
    sources,
    stop,
    togglePlayback,
    voices,
  } = controller

  const voiceOptions = useMemo(
    () =>
      voices.map((voice) => ({
        label: `${voice.name}${voice.lang ? ` · ${voice.lang}` : ''}`,
        value: voice.voiceURI,
      })),
    [voices],
  )

  if (!isSupported || !activeDocument) {
    return null
  }

  const isBusy = playbackState !== 'idle'
  const stateCopy = STATE_COPY[playbackState]

  const activeSource = activeSourceMode ? sources[activeSourceMode] : null
  // Compact meta-line shown under the title: voice · rate · what's queued.
  const metaBits = [
    selectedVoice?.name ?? 'System voice',
    `${settings.readAloudRate.toFixed(1)}×`,
    activeSource?.label ?? 'Nothing queued',
  ].filter(Boolean)

  const handleRateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextRate = Number(event.target.value)
    if (!Number.isFinite(nextRate)) return
    updateSettings({ readAloudRate: Math.min(Math.max(nextRate, 0.5), 2) })
  }

  const handleVoiceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ readAloudVoiceURI: event.target.value })
  }

  const handleRestart = () => {
    if (activeSourceMode) {
      play(activeSourceMode)
    }
  }

  const primaryDisabled = !isBusy && !activeSourceMode
  const primaryIcon = playbackState === 'playing' ? <Pause size={16} /> : <Play size={16} />
  const primaryLabel = playbackState === 'playing' ? 'Pause' : playbackState === 'paused' ? 'Resume' : 'Play'
  const currentWord = localFeedback?.currentWord?.trim() ?? ''

  return (
    <section className="read-aloud-card" aria-label="Read aloud controls">
      <header className="ra-header-row">
        <div className="ra-header-title">
          <span className={`ra-state-dot tone-${stateCopy.tone}`} aria-hidden />
          <Volume2 size={16} className="ra-title-icon" aria-hidden />
          <strong>Read aloud</strong>
          <span className="ra-header-meta">{metaBits.join(' · ')}</span>
        </div>
        <span className={`ra-state-label tone-${stateCopy.tone}`}>{stateCopy.label}</span>
      </header>

      <div className="ra-transport-row">
        <div className="ra-playback">
          <button
            type="button"
            className="toolbar-button primary-play"
            onClick={togglePlayback}
            disabled={primaryDisabled}
            aria-label={primaryLabel}
          >
            {primaryIcon}
            {primaryLabel}
          </button>
          <button
            type="button"
            className="toolbar-button icon ghost"
            onClick={handleRestart}
            disabled={!activeSourceMode}
            title="Restart from the beginning"
            aria-label="Restart"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="toolbar-button icon ghost"
            onClick={() => stop()}
            disabled={!isBusy}
            title="Stop"
            aria-label="Stop"
          >
            <Square size={15} />
          </button>
        </div>

        <div className="ra-current-word" aria-live="polite">
          <span className="ra-current-label">Word</span>
          <span className={`ra-current-chip${currentWord ? '' : ' idle'}`}>
            {currentWord || '—'}
          </span>
        </div>
      </div>

      <div className="ra-segmented" role="group" aria-label="Choose what to read">
        {SOURCE_MODES.map((mode) => {
          const source = sources[mode.id]
          const isSelected = activeSourceMode === mode.id && isBusy
          const hasContent = Boolean(source?.text)
          const meta = hasContent ? `${source.stats.words.toLocaleString()} words` : 'Unavailable'
          return (
            <button
              key={mode.id}
              type="button"
              className="ra-segment"
              aria-selected={isSelected}
              onClick={() => play(mode.id)}
              disabled={!hasContent}
              title={hasContent ? `${mode.label} · ${meta}` : `${mode.label} unavailable`}
            >
              <strong>{mode.label}</strong>
              <small>{meta}</small>
            </button>
          )
        })}
      </div>

      <div className="read-aloud-controls">
        <label className="read-aloud-field">
          <span>Rate</span>
          <div className="ra-rate-row">
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.readAloudRate}
              onChange={handleRateChange}
              aria-label="Speech rate"
            />
            <span className="ra-rate-value">{settings.readAloudRate.toFixed(1)}×</span>
          </div>
        </label>
        <label className="read-aloud-field">
          <span>Voice</span>
          <select
            value={settings.readAloudVoiceURI || ''}
            onChange={handleVoiceChange}
            aria-label="Speech voice"
          >
            {voiceOptions.length === 0 ? <option value="">System default</option> : null}
            {voiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}

export default ReadAloudPanel
