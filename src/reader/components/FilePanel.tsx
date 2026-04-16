import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import { BookText, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { readNodeDocument } from '../../shared/fs'
import type { FileNode } from '../../shared/types'
import { SOURCE_FILTERS } from '../constants'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

function FilePanel() {
  const {
    actions: { openRecentDocument, setDocument, setFileFilter, setTypeFilter, toggleDirectory },
    derived: { flattenedRows },
    refs: { fileSearchInputRef, treeScrollRef },
    state: { activeDocument, expandedPaths, fileFilter, folderHandle, isScanning, library, settings, typeFilter },
  } = useReaderWorkspaceContext()

  const virtualizer = useVirtualizer({
    count: flattenedRows.length,
    getScrollElement: () => treeScrollRef.current,
    estimateSize: () => 32,
    overscan: 12,
  })

  if (!settings.showFileTree) {
    return null
  }

  return (
    <aside className="panel file-panel">
      <div className="panel-header">
        <div>
          <strong>Library</strong>
          <span>{folderHandle?.name ?? 'Local and remote sources'}</span>
        </div>
        <span className="badge">{isScanning ? 'Scanning...' : `${flattenedRows.length} rows`}</span>
      </div>

      <div className="panel-stack">
        <div className="search-stack">
          <label className="search-input">
            <Search size={14} />
            <input
              ref={fileSearchInputRef}
              value={fileFilter}
              onChange={(event) => setFileFilter(event.target.value)}
              placeholder="Filter files and folders"
            />
          </label>

          <div className="chip-row">
            {SOURCE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={clsx('chip', { active: typeFilter === filter.value })}
                onClick={() => setTypeFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <RecentDocumentsCard />

        <div ref={treeScrollRef} className="tree-scroll">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = flattenedRows[virtualRow.index]
              if (!row) {
                return null
              }

              const isExpanded = expandedPaths.has(row.node.path)
              const isActive = activeDocument?.id === row.node.id

              return (
                <div
                  key={row.node.id}
                  className={clsx('tree-row', { active: isActive })}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: `${12 + row.depth * 16}px`,
                  }}
                >
                  <TreeRow
                    isActive={isActive}
                    node={row.node}
                    onOpen={async (node) => {
                      const document = await readNodeDocument(node)
                      setDocument(document)
                    }}
                    isExpanded={isExpanded}
                    onToggle={toggleDirectory}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )

  function RecentDocumentsCard() {
    return (
      <section className="dashboard-card">
        <div className="dashboard-header">
          <BookText size={16} />
          Continue reading
        </div>
        <ul className="compact-list">
          {library.recentDocuments.slice(0, 4).map((item) => {
            const documentProgress = library.progressRecords.find((record) => record.documentId === item.id)

            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="list-link"
                  onClick={() => void openRecentDocument(item.id, item.sourceUrl)}
                >
                  <span>{item.title}</span>
                  <small>{Math.round((documentProgress?.progress ?? 0) * 100)}%</small>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }
}

function TreeRow({
  isActive,
  isExpanded,
  node,
  onOpen,
  onToggle,
}: {
  isActive: boolean
  isExpanded: boolean
  node: FileNode
  onOpen: (node: FileNode) => Promise<void>
  onToggle: (path: string) => void
}) {
  if (node.kind === 'directory') {
    return (
      <button
        type="button"
        className={clsx('tree-button', { active: isActive })}
        onClick={() => onToggle(node.path)}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{node.name}</span>
      </button>
    )
  }

  return (
    <button type="button" className="tree-button file" onClick={() => void onOpen(node)}>
      <span>{node.name}</span>
    </button>
  )
}

export default FilePanel
