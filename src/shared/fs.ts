import type { FileNode, ReaderDocument, SearchHit, SourceTypeFilter } from './types'

const EXCLUDED_FOLDERS = new Set(['.git', 'node_modules', 'dist', '.next'])
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown'])
const TEXT_EXTENSIONS = new Set(['txt'])

const textDecoder = new TextDecoder()

export function supportsDirectoryPicker() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export function supportsOpenFilePicker() {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

function getExtension(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) ?? '' : ''
}

function isSupportedFile(name: string) {
  const extension = getExtension(name)
  return MARKDOWN_EXTENSIONS.has(extension) || TEXT_EXTENSIONS.has(extension)
}

function createId(path: string) {
  return path.replace(/[^\w/-]+/g, '-')
}

export function getFileType(name: string): ReaderDocument['fileType'] {
  const extension = getExtension(name)
  return TEXT_EXTENSIONS.has(extension) ? 'text' : 'markdown'
}

export async function ensurePermission(
  handle: FileSystemHandle,
  mode: FileSystemPermissionMode = 'read',
  prompt = true,
) {
  if (handle.queryPermission && (await handle.queryPermission({ mode })) === 'granted') {
    return true
  }

  if (!prompt) {
    return false
  }

  if (handle.requestPermission) {
    try {
      return (await handle.requestPermission({ mode })) === 'granted'
    } catch {
      return false
    }
  }

  return true
}

export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  basePath = '',
  onProgress?: (nodes: FileNode[]) => void,
): Promise<FileNode[]> {
  const entries: FileNode[] = []

  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === 'directory') {
      if (EXCLUDED_FOLDERS.has(name)) {
        continue
      }

      const directoryPath = `${basePath}/${name}`
      const children = await scanDirectory(entry, directoryPath, onProgress)
      const directoryNode: FileNode = {
        id: createId(directoryPath),
        name,
        path: directoryPath,
        kind: 'directory',
        directoryHandle: entry,
        children,
      }

      entries.push(directoryNode)
      onProgress?.([...entries])
      continue
    }

    if (!isSupportedFile(name)) {
      continue
    }

    const path = `${basePath}/${name}`
    entries.push({
      id: createId(path),
      name,
      path,
      kind: 'file',
      extension: getExtension(name),
      fileHandle: entry,
      children: [],
    })
    onProgress?.([...entries])
  }

  return entries.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })
}

export async function readFileHandle(
  fileHandle: FileSystemFileHandle,
  path: string,
): Promise<ReaderDocument> {
  const file = await fileHandle.getFile()
  const content = await file.text()

  return {
    id: createId(path),
    title: file.name,
    path,
    content,
    sourceType: 'single-file',
    fileHandle,
    updatedAt: file.lastModified,
    fileType: getFileType(file.name),
  }
}

export async function readNodeDocument(node: FileNode): Promise<ReaderDocument> {
  if (node.kind !== 'file' || !node.fileHandle) {
    throw new Error('Only files can be opened.')
  }

  const file = await node.fileHandle.getFile()
  const content = await file.text()

  return {
    id: node.id,
    title: node.name,
    path: node.path,
    content,
    sourceType: 'folder-file',
    fileHandle: node.fileHandle,
    updatedAt: file.lastModified,
    fileType: getFileType(node.name),
  }
}

export async function readFromSourceUrl(rawSource: string): Promise<ReaderDocument> {
  const source = rawSource.trim()

  if (!source) {
    throw new Error('Provide a file or URL source first.')
  }

  if (source.startsWith('file://')) {
    const response = await fetch(source)

    if (!response.ok) {
      throw new Error(`Unable to read local file URL (${response.status}).`)
    }

    const content = await response.text()
    const title = source.split('/').at(-1) ?? 'local-file'

    return {
      id: createId(source),
      title,
      path: source,
      content,
      sourceType: 'file-url',
      sourceUrl: source,
      updatedAt: Date.now(),
      fileType: getFileType(title),
    }
  }

  const response = await fetch(source)

  if (!response.ok) {
    throw new Error(`Unable to fetch URL (${response.status}).`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (
    !source.match(/\.(md|markdown|txt)(\?.*)?$/i) &&
    !contentType.includes('text/plain') &&
    !contentType.includes('text/markdown')
  ) {
    throw new Error('The URL must point to a raw Markdown or text file.')
  }

  const content = await response.text()
  const title = source.split('/').at(-1) ?? source

  return {
    id: createId(source),
    title,
    path: source,
    content,
    sourceType: 'remote-url',
    sourceUrl: source,
    updatedAt: Date.now(),
    fileType: getFileType(title),
  }
}

export function flattenTree(nodes: FileNode[], expanded: Set<string>) {
  const rows: Array<{ node: FileNode; depth: number }> = []

  const walk = (items: FileNode[], depth: number) => {
    for (const item of items) {
      rows.push({ node: item, depth })

      if (item.kind === 'directory' && expanded.has(item.path)) {
        walk(item.children, depth + 1)
      }
    }
  }

  walk(nodes, 0)
  return rows
}

export function filterTree(nodes: FileNode[], query: string, typeFilter: SourceTypeFilter): FileNode[] {
  const normalizedQuery = query.trim().toLowerCase()

  const walk = (items: FileNode[]): FileNode[] => {
    const output: FileNode[] = []

    for (const item of items) {
      if (item.kind === 'directory') {
        const filteredChildren = walk(item.children)

        if (
          filteredChildren.length > 0 ||
          (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery))
        ) {
          output.push({
            ...item,
            children: filteredChildren,
          })
        }

        continue
      }

      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.path.toLowerCase().includes(normalizedQuery)
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'markdown' && getFileType(item.name) === 'markdown') ||
        (typeFilter === 'text' && getFileType(item.name) === 'text')

      if (matchesQuery && matchesType) {
        output.push(item)
      }
    }
    return output
  }

  return walk(nodes)
}

export async function buildSearchIndex(nodes: FileNode[]) {
  const hits: SearchHit[] = []

  const walk = async (items: FileNode[]) => {
    for (const item of items) {
      if (item.kind === 'directory') {
        await walk(item.children)
        continue
      }

      if (!item.fileHandle) {
        continue
      }

      const file = await item.fileHandle.getFile()
      const content = await file.text()
      const compact = content.replace(/\s+/g, ' ').trim()

      hits.push({
        documentId: item.id,
        path: item.path,
        title: item.name,
        snippet: compact.slice(0, 240),
        score: 0,
      })
    }
  }

  await walk(nodes)
  return hits
}

export async function readDroppedFile(file: File): Promise<ReaderDocument> {
  const content = await file.text()
  const path = file.name

  return {
    id: createId(path),
    title: file.name,
    path,
    content,
    sourceType: 'single-file',
    updatedAt: file.lastModified,
    fileType: getFileType(file.name),
  }
}

export function readAsText(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => textDecoder.decode(buffer))
}
