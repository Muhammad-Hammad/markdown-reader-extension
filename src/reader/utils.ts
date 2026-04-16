import type { ReactNode } from 'react'
import type { FileNode, ReaderMode, TocItem } from '../shared/types'

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
  return content
    .split('\n')
    .map((line) => line.match(/^(#{1,4})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      id: slugify(match[2]),
      depth: match[1].length,
      text: match[2].trim(),
    }))
}

export function getBookmarkLabel(tocItems: TocItem[], activeHeadingId: string, fallback: string) {
  return tocItems.find((item) => item.id === activeHeadingId)?.text ?? fallback
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=<>{}|[\]\\:;"',.?/]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function getDocumentStats(content: string) {
  const clean = content.replace(/```[\s\S]*?```/g, '').trim()
  const words = clean ? clean.split(/\s+/).length : 0
  const characters = clean.length
  const readMinutes = Math.max(1, Math.round(words / 220))

  return { words, characters, readMinutes }
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
