import clsx from 'clsx'
import { BookOpenText, Crosshair, Moon, MoonStar, Sparkles, Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReaderMode } from '../../shared/types'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

const THEME_OPTIONS: Array<{
  value: ReaderMode
  label: string
  icon: typeof Sun
  description: string
}> = [
  { value: 'light', label: 'Light', icon: Sun, description: 'Bright and crisp for daytime reading.' },
  { value: 'dark', label: 'Dark', icon: MoonStar, description: 'Balanced dark mode for long sessions.' },
  { value: 'read', label: 'Read', icon: BookOpenText, description: 'Paper-like contrast for article reading.' },
  { value: 'low-light', label: 'Low-light', icon: Moon, description: 'Warmer contrast for late-night use.' },
  { value: 'ambient', label: 'Ambient', icon: Sparkles, description: 'Mood-driven accent surfaces.' },
  { value: 'focus', label: 'Focus', icon: Crosshair, description: 'Reduced distractions with active focus.' },
]

function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const {
    actions: { updateSettings },
    state: { settings },
  } = useReaderWorkspaceContext()

  const currentTheme = useMemo(
    () => THEME_OPTIONS.find((option) => option.value === settings.mode) ?? THEME_OPTIONS[0],
    [settings.mode],
  )
  const CurrentThemeIcon = currentTheme.icon

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="theme-switcher" ref={containerRef}>
      <button
        type="button"
        className={clsx('toolbar-button', 'theme-trigger', { primary: isOpen })}
        onClick={() => setIsOpen((current) => !current)}
        title={`Theme: ${currentTheme.label}`}
      >
        <CurrentThemeIcon size={16} />
        <span>{currentTheme.label}</span>
      </button>

      {isOpen ? (
        <div className="theme-menu" role="menu" aria-label="Reader themes">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon

            return (
              <button
                key={option.value}
                type="button"
                className={clsx('theme-menu-item', { active: settings.mode === option.value })}
                onClick={() => {
                  updateSettings({
                    focusParagraphs: option.value === 'focus',
                    mode: option.value,
                  })
                  setIsOpen(false)
                }}
                role="menuitemradio"
                aria-checked={settings.mode === option.value}
              >
                <span className="theme-icon-shell">
                  <Icon size={16} />
                </span>
                <span className="theme-copy">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default ThemeSwitcher
