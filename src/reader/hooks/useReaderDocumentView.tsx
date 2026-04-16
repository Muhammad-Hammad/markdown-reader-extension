import clsx from 'clsx'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import type { Components } from 'react-markdown'
import type { ReaderDocument, ReaderSettings } from '../../shared/types'
import { getModeStyle, getDocumentStats, extractImageSources, extractToc, flattenReactText, getErrorMessage, hashString, parseAlert, rgbToHue } from '../utils'
import CodeBlock from '../components/CodeBlock'
import MermaidBlock from '../components/MermaidBlock'

interface UseReaderDocumentViewOptions {
  activeDocument?: ReaderDocument
  activeParagraphIndex: number
  onLightboxOpen: (index: number) => void
  settings: ReaderSettings
}

export function useReaderDocumentView({
  activeDocument,
  activeParagraphIndex,
  onLightboxOpen,
  settings,
}: UseReaderDocumentViewOptions) {
  const [ambientHueOverride, setAmbientHueOverride] = useState<number | null>(null)
  const fallbackHue = useMemo(
    () => hashString(activeDocument?.title ?? 'markdown-reader') % 360,
    [activeDocument?.title],
  )

  const tocItems = useMemo(() => extractToc(activeDocument?.content ?? ''), [activeDocument?.content])
  const stats = useMemo(() => getDocumentStats(activeDocument?.content ?? ''), [activeDocument?.content])
  const imageSources = useMemo(() => extractImageSources(activeDocument?.content ?? ''), [activeDocument?.content])
  const ambientHue =
    settings.mode === 'ambient' && imageSources[0] ? ambientHueOverride ?? fallbackHue : fallbackHue
  const surfaceStyle = useMemo(() => getModeStyle(settings.mode, ambientHue), [ambientHue, settings.mode])

  const rootStyle = useMemo(
    () =>
      ({
        '--reader-font-size': `${settings.fontSize}px`,
        '--reader-line-height': settings.lineHeight,
        '--reader-content-width': `${settings.contentWidth}px`,
        '--reader-surface': surfaceStyle.surface,
        '--reader-border': surfaceStyle.border,
        '--reader-panel': surfaceStyle.panel,
        '--reader-muted': surfaceStyle.muted,
        '--reader-text': surfaceStyle.text,
        '--reader-heading': surfaceStyle.heading,
        '--reader-accent': surfaceStyle.accent,
        '--reader-accent-soft': surfaceStyle.accentSoft,
        '--reader-shadow': surfaceStyle.shadow,
      }) as CSSProperties,
    [settings.contentWidth, settings.fontSize, settings.lineHeight, surfaceStyle],
  )

  const markdownComponents = useMemo<Components>(
    () => ({
      code(properties) {
        const className = properties.className ?? ''
        const rawCode = String(properties.children ?? '')
        const language = className.replace('language-', '')

        if (language === 'mermaid') {
          return <MermaidBlock code={rawCode} mode={settings.mode} />
        }

        if (!className) {
          return <code className="inline-code">{properties.children}</code>
        }

        return (
          <CodeBlock
            code={rawCode.replace(/\n$/, '')}
            className={className}
            wrap={settings.codeWrap}
          />
        )
      },
      img(properties) {
        const source = String(properties.src ?? '')
        const index = imageSources.findIndex((item) => item === source)

        return (
          <button
            type="button"
            className="image-button"
            onClick={() => onLightboxOpen(index >= 0 ? index : 0)}
          >
            <img {...properties} className="markdown-image" alt={properties.alt ?? ''} />
          </button>
        )
      },
      blockquote(properties) {
        const alert = parseAlert(flattenReactText(properties.children))
        if (!alert) {
          return <blockquote>{properties.children}</blockquote>
        }

        return (
          <aside className={`callout callout-${alert.kind.toLowerCase()}`}>
            <strong>{alert.kind}</strong>
            <div>{alert.body}</div>
          </aside>
        )
      },
      p(properties) {
        return (
          <p
            className={clsx({
              'focus-dimmed':
                settings.focusParagraphs &&
                Number(
                  (properties.node?.properties?.['data-focus-index'] as string | undefined) ?? '-1',
                ) !== activeParagraphIndex,
            })}
          >
            {properties.children}
          </p>
        )
      },
    }),
    [activeParagraphIndex, imageSources, onLightboxOpen, settings.codeWrap, settings.focusParagraphs, settings.mode],
  )

  useEffect(() => {
    if (settings.mode !== 'ambient' || !imageSources[0]) {
      return
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = imageSources[0]
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const context = canvas.getContext('2d')
      if (!context) {
        return
      }

      context.drawImage(image, 0, 0, 16, 16)
      try {
        const data = context.getImageData(0, 0, 16, 16).data
        let red = 0
        let green = 0
        let blue = 0
        const samples = data.length / 4

        for (let index = 0; index < data.length; index += 4) {
          red += data[index]
          green += data[index + 1]
          blue += data[index + 2]
        }

        setAmbientHueOverride(rgbToHue(red / samples, green / samples, blue / samples))
      } catch (error) {
        setAmbientHueOverride(hashString(getErrorMessage(error)) % 360)
      }
    }
    image.onerror = () => setAmbientHueOverride(fallbackHue)
  }, [fallbackHue, imageSources, settings.mode])

  return {
    imageSources,
    markdownComponents,
    rootStyle,
    stats,
    tocItems,
  }
}
