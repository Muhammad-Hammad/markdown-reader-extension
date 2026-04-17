import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Components } from 'react-markdown'
import type { ReaderDocument, ReaderSettings } from '../../shared/types'
import { getModeStyle, getDocumentStats, extractImageSources, flattenReactText, getErrorMessage, hashString, parseAlert, rgbToHue } from '../utils'
import CodeBlock from '../components/CodeBlock'
import MermaidBlock from '../components/MermaidBlock'

interface UseReaderDocumentViewOptions {
  activeDocument?: ReaderDocument
  activeParagraphIndex: number
  articleRef: React.RefObject<HTMLElement | null>
  onLightboxOpen: (index: number) => void
  settings: ReaderSettings
}

export function useReaderDocumentView({
  activeDocument,
  activeParagraphIndex,
  articleRef,
  onLightboxOpen,
  settings,
}: UseReaderDocumentViewOptions) {
  // `markdownComponents` must keep a stable identity across scroll-driven
  // re-renders. react-markdown does `createElement(components.code, …)`, so a
  // new function identity on every parent render is treated as a brand-new
  // component type → React unmounts + remounts every <code>/<MermaidBlock> in
  // the tree, which resets mermaid's container and aborts in-flight renders.
  // We funnel volatile callbacks through a ref and apply scroll-driven DOM
  // side effects (focus dimming) outside React's render path.
  const lightboxOpenRef = useRef(onLightboxOpen)
  useEffect(() => {
    lightboxOpenRef.current = onLightboxOpen
  }, [onLightboxOpen])

  const stableLightboxOpen = useCallback((index: number) => {
    lightboxOpenRef.current(index)
  }, [])
  const [ambientHueOverride, setAmbientHueOverride] = useState<number | null>(null)
  const fallbackHue = useMemo(
    () => hashString(activeDocument?.title ?? 'markdown-reader') % 360,
    [activeDocument?.title],
  )

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
        // Anchor on a word boundary (class-list space or start of string) so we
        // don't match against e.g. `no-language-x`, then capture any non-space
        // token — language ids like `c#`, `c++`, `objective-c` must survive.
        const languageMatch = /(?:^|\s)language-(\S+)/.exec(className)
        const language = languageMatch?.[1] ?? ''

        if (language === 'mermaid') {
          // Prefer the raw hast text node value when available. It's the
          // authoritative source before any rehype plugin or React render
          // can split / re-wrap the characters. `plainText` on rehype-highlight
          // already spares mermaid, this is belt-and-braces.
          const rawCode = extractRawCodeText(properties) ?? flattenReactText(properties.children)
          return <MermaidBlock code={rawCode} mode={settings.mode} />
        }

        if (!language) {
          return <code className="inline-code">{properties.children}</code>
        }

        const rawCode = flattenReactText(properties.children).replace(/\n$/, '')

        return (
          <CodeBlock
            code={rawCode}
            className={className}
            wrap={settings.codeWrap}
          >
            {properties.children}
          </CodeBlock>
        )
      },
      img(properties) {
        const source = String(properties.src ?? '')
        const index = imageSources.findIndex((item) => item === source)

        return (
          <button
            type="button"
            className="image-button"
            onClick={() => stableLightboxOpen(index >= 0 ? index : 0)}
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
      // `p` deliberately does not read activeParagraphIndex — that would force
      // components identity to change on every scroll tick and remount every
      // MermaidBlock. The focus-dimmed class is applied by a DOM effect below.
      p(properties) {
        return <p>{properties.children}</p>
      },
    }),
    [imageSources, stableLightboxOpen, settings.codeWrap, settings.mode],
  )

  // Apply paragraph-focus dimming outside React's render path so scroll
  // updates don't invalidate markdownComponents. Each paragraph already gets a
  // `data-focus-index` in useReaderInteractions.
  useEffect(() => {
    const article = articleRef.current
    if (!article) return

    const paragraphs = article.querySelectorAll<HTMLElement>('p[data-focus-index]')
    if (paragraphs.length === 0) return

    if (!settings.focusParagraphs) {
      paragraphs.forEach((paragraph) => paragraph.classList.remove('focus-dimmed'))
      return
    }

    const activeKey = String(activeParagraphIndex)
    paragraphs.forEach((paragraph) => {
      const shouldDim = paragraph.dataset.focusIndex !== activeKey
      paragraph.classList.toggle('focus-dimmed', shouldDim)
    })
  }, [activeParagraphIndex, articleRef, settings.focusParagraphs, activeDocument?.id, activeDocument?.content])

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
  }
}

interface HastLikeNode {
  type?: string
  value?: string
  children?: HastLikeNode[]
}

// react-markdown passes the original hast node via `node`. Walking it gives us
// the source text exactly as the parser produced it — before React rewraps
// children or any highlighter mutates them.
function extractRawCodeText(properties: { node?: unknown }): string | null {
  const node = properties.node as HastLikeNode | undefined
  if (!node?.children) return null

  let buffer = ''
  const walk = (current: HastLikeNode) => {
    if (current.type === 'text' && typeof current.value === 'string') {
      buffer += current.value
      return
    }
    current.children?.forEach(walk)
  }
  node.children.forEach(walk)

  return buffer.length > 0 ? buffer : null
}
