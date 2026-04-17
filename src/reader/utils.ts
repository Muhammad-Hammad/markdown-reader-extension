import type { ReactNode } from 'react'
import type { FileNode, NoteRecord, ReaderMode, TocItem } from '../shared/types'

const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
const READING_WORDS_PER_MINUTE = 220

export interface TextStats {
  words: number
  characters: number
  readMinutes: number
}

export interface TextPosition {
  node: Text
  offset: number
}

export interface TextPositionIndex {
  normalizedText: string
  positions: TextPosition[]
}

export function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    return {}
  }

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((output, line) => {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex <= 0) {
        return output
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      if (!key) {
        return output
      }

      output[key] = value
      return output
    }, {})
}

export function parseAlert(value: string) {
  const match = value.trim().match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)$/i)
  if (!match) {
    return null
  }

  return {
    kind: match[1].toUpperCase(),
    body: match[2].trim(),
  }
}

export function flattenReactText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(flattenReactText).join('')
  }

  if (node && typeof node === 'object' && 'props' in node) {
    const value = node as { props?: { children?: ReactNode } }
    return flattenReactText(value.props?.children ?? '')
  }

  return ''
}

export function extractToc(content: string): TocItem[] {
  const resolveHeadingId = createHeadingIdResolver()

  return content
    .split('\n')
    .map((line) => line.match(/^(#{1,4})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      id: resolveHeadingId(match[2]),
      depth: match[1].length,
      text: match[2].trim(),
    }))
}

export function getBookmarkLabel(tocItems: TocItem[], activeHeadingId: string, fallback: string) {
  return tocItems.find((item) => item.id === activeHeadingId)?.text ?? fallback
}

/**
 * Walks backwards from the active heading and collects every ancestor id —
 * i.e. the preceding items with strictly lower depth. Used to paint the
 * accent-coloured nesting guide along the path from the top-level heading
 * down to the heading currently in view.
 */
export function getAncestorHeadingIds(tocItems: TocItem[], activeHeadingId: string): Set<string> {
  const ancestors = new Set<string>()

  if (!activeHeadingId) {
    return ancestors
  }

  const activeIndex = tocItems.findIndex((item) => item.id === activeHeadingId)
  if (activeIndex < 0) {
    return ancestors
  }

  ancestors.add(activeHeadingId)
  let currentDepth = tocItems[activeIndex].depth

  for (let index = activeIndex - 1; index >= 0 && currentDepth > 1; index -= 1) {
    const candidate = tocItems[index]
    if (candidate.depth < currentDepth) {
      ancestors.add(candidate.id)
      currentDepth = candidate.depth
    }
  }

  return ancestors
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=<>{}|[\]\\:;"',.?/]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function createHeadingIdResolver() {
  const seen = new Map<string, number>()

  return (value: string) => {
    const baseId = slugify(value) || 'section'
    const currentCount = seen.get(baseId) ?? 0
    seen.set(baseId, currentCount + 1)

    return currentCount === 0 ? baseId : `${baseId}-${currentCount}`
  }
}

export function getDocumentStats(content: string) {
  return getTextStats(content.replace(FENCED_CODE_BLOCK_PATTERN, ' '))
}

export function getTextStats(content: string): TextStats {
  const clean = normalizePlainText(content)
  if (!clean) {
    return {
      words: 0,
      characters: 0,
      readMinutes: 0,
    }
  }

  const words = clean.split(/\s+/).length
  const characters = clean.length
  const readMinutes = Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE))

  return { words, characters, readMinutes }
}

export function normalizePlainText(content: string) {
  return content.replace(/\s+/g, ' ').trim()
}

export function buildTextPositionIndex(article: HTMLElement): TextPositionIndex {
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT)
  const positions: TextPosition[] = []
  let normalizedText = ''
  let previousWasWhitespace = true

  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!(node instanceof Text)) {
      continue
    }

    const parentElement = node.parentElement
    if (!parentElement || parentElement.closest('pre, code, script, style, .frontmatter-card')) {
      continue
    }

    const value = node.textContent ?? ''
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index]
      if (/\s/.test(character)) {
        if (!previousWasWhitespace && normalizedText.length > 0) {
          normalizedText += ' '
          positions.push({ node, offset: index })
          previousWasWhitespace = true
        }
        continue
      }

      normalizedText += character
      positions.push({ node, offset: index })
      previousWasWhitespace = false
    }
  }

  if (normalizedText.endsWith(' ')) {
    normalizedText = normalizedText.slice(0, -1)
    positions.pop()
  }

  return {
    normalizedText,
    positions,
  }
}

export function createTextRange(positions: TextPosition[], start: number, end: number) {
  if (start < 0 || end <= start || end > positions.length) {
    return null
  }

  const startPosition = positions[start]
  const endPosition = positions[end - 1]
  if (!startPosition || !endPosition) {
    return null
  }

  const range = document.createRange()
  range.setStart(startPosition.node, startPosition.offset)
  range.setEnd(endPosition.node, endPosition.offset + 1)
  return range
}

export function captureSelectionLocation(article: HTMLElement, selection: Selection | null) {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }

  const range = selection.getRangeAt(0)
  const rangeParent = range.commonAncestorContainer instanceof Element
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement

  if (!rangeParent || !article.contains(rangeParent)) {
    return null
  }

  const textIndex = buildTextPositionIndex(article)
  const offsets = getTextRangeOffsets(textIndex, range)

  return {
    headingId: findClosestHeadingId(article, range.startContainer),
    selectionStart: offsets?.start,
    selectionEnd: offsets?.end,
  }
}

export function resolveNoteTextRange(article: HTMLElement, note: NoteRecord) {
  const textIndex = buildTextPositionIndex(article)

  if (typeof note.selectionStart === 'number' && typeof note.selectionEnd === 'number') {
    return {
      textIndex,
      range: createTextRange(textIndex.positions, note.selectionStart, note.selectionEnd),
    }
  }

  const quote = normalizePlainText(note.quote)
  if (!quote) {
    return {
      textIndex,
      range: null,
    }
  }

  const start = textIndex.normalizedText.indexOf(quote)
  if (start === -1) {
    return {
      textIndex,
      range: null,
    }
  }

  return {
    textIndex,
    range: createTextRange(textIndex.positions, start, start + quote.length),
  }
}

function getTextRangeOffsets(textIndex: TextPositionIndex, range: Range) {
  let start = -1
  let end = -1

  for (let index = 0; index < textIndex.positions.length; index += 1) {
    const position = textIndex.positions[index]

    try {
      if (!range.isPointInRange(position.node, position.offset)) {
        continue
      }
    } catch {
      continue
    }

    if (start === -1) {
      start = index
    }

    end = index + 1
  }

  if (start === -1 || end === -1) {
    return null
  }

  return { start, end }
}

function findClosestHeadingId(article: HTMLElement, target: Node) {
  const targetElement = target instanceof Element ? target : target.parentElement
  if (!targetElement || !article.contains(targetElement)) {
    return undefined
  }

  const headings = Array.from(article.querySelectorAll<HTMLElement>('h1, h2, h3, h4')).filter((heading) => heading.id)
  let activeHeadingId: string | undefined

  for (const heading of headings) {
    if (heading === targetElement) {
      return heading.id
    }

    if (heading.compareDocumentPosition(targetElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
      activeHeadingId = heading.id
      continue
    }

    break
  }

  return activeHeadingId
}

export function collectDirectoryPaths(nodes: FileNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.kind === 'directory') {
      paths.push(node.path)
      paths.push(...collectDirectoryPaths(node.children))
    }
  }
  return paths
}

export function findNodeById(nodes: FileNode[], id: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }

    const child = findNodeById(node.children, id)
    if (child) {
      return child
    }
  }

  return undefined
}

export function joinPathSegments(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

export function extractImageSources(content: string) {
  return Array.from(content.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)).map((match) => match[1])
}

export function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

export function rgbToHue(red: number, green: number, blue: number) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  if (delta === 0) {
    return 0
  }

  let hue = 0
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }

  return Math.round(hue * 60)
}

export function getModeStyle(mode: ReaderMode, ambientHue: number) {
  if (mode === 'light') {
    return {
      surface: '#f8fafc',
      panel: '#ffffff',
      text: '#0f172a',
      heading: '#020617',
      muted: '#475569',
      border: 'rgba(148, 163, 184, 0.28)',
      accent: '#2563eb',
      accentSoft: 'rgba(37, 99, 235, 0.12)',
      shadow: '0 18px 38px rgba(15, 23, 42, 0.08)',
    }
  }

  if (mode === 'read') {
    return {
      surface: '#f8f5eb',
      panel: '#fffdf7',
      text: '#2f2418',
      heading: '#17110c',
      muted: '#6b5f53',
      border: 'rgba(161, 98, 7, 0.14)',
      accent: '#a16207',
      accentSoft: 'rgba(161, 98, 7, 0.12)',
      shadow: '0 18px 38px rgba(68, 64, 60, 0.08)',
    }
  }

  if (mode === 'low-light') {
    return {
      surface: '#16110d',
      panel: '#221711',
      text: '#f4e9d8',
      heading: '#fff7ed',
      muted: '#d6bda0',
      border: 'rgba(251, 146, 60, 0.18)',
      accent: '#fb923c',
      accentSoft: 'rgba(251, 146, 60, 0.12)',
      shadow: '0 18px 38px rgba(15, 23, 42, 0.36)',
    }
  }

  if (mode === 'ambient') {
    return {
      surface: `hsl(${ambientHue} 36% 10%)`,
      panel: `hsl(${ambientHue} 30% 14%)`,
      text: '#e2e8f0',
      heading: '#f8fafc',
      muted: '#cbd5e1',
      border: `hsla(${ambientHue} 52% 62% / 0.22)`,
      accent: `hsl(${ambientHue} 75% 64%)`,
      accentSoft: `hsla(${ambientHue} 75% 64% / 0.16)`,
      shadow: `0 18px 48px hsla(${ambientHue} 70% 10% / 0.5)`,
    }
  }

  if (mode === 'focus') {
    return {
      surface: '#09090b',
      panel: '#111827',
      text: '#e5e7eb',
      heading: '#f9fafb',
      muted: '#9ca3af',
      border: 'rgba(96, 165, 250, 0.18)',
      accent: '#60a5fa',
      accentSoft: 'rgba(96, 165, 250, 0.12)',
      shadow: '0 18px 48px rgba(2, 6, 23, 0.52)',
    }
  }

  return {
    surface: '#020617',
    panel: '#0f172a',
    text: '#e2e8f0',
    heading: '#f8fafc',
    muted: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.16)',
    accent: '#38bdf8',
    accentSoft: 'rgba(56, 189, 248, 0.12)',
    shadow: '0 18px 44px rgba(2, 6, 23, 0.44)',
  }
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function buildExportHtml(title: string, articleMarkup: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      main { max-width: 920px; margin: 0 auto; padding: 48px 24px 96px; }
      img { max-width: 100%; border-radius: 12px; }
      pre { overflow: auto; padding: 16px; border-radius: 12px; background: #0b1220; }
      code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      blockquote { margin: 0; padding: 16px 18px; border-left: 4px solid #60a5fa; background: rgba(96, 165, 250, 0.08); border-radius: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 24px 0; }
      th, td { border: 1px solid rgba(148, 163, 184, 0.24); padding: 10px 12px; }
      a { color: #93c5fd; }
      .mermaid-shell { padding: 16px; background: #fff; border-radius: 16px; }
    </style>
  </head>
  <body>
    <main>${articleMarkup}</main>
  </body>
</html>`
}
