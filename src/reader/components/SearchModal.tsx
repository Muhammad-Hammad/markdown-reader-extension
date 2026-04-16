import { FileSearch } from 'lucide-react'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'
import Modal from './Modal'

function SearchModal() {
  const {
    actions: { openRecentDocument, setSearchOpen, setSearchQuery },
    refs: { contentSearchInputRef },
    state: { isSearching, searchOpen, searchQuery },
    derived: { fileSearchResults },
  } = useReaderWorkspaceContext()

  if (!searchOpen) {
    return null
  }

  return (
    <Modal title="Full-text folder search" onClose={() => setSearchOpen(false)}>
      <label className="search-input modal-search">
        <FileSearch size={16} />
        <input
          ref={contentSearchInputRef}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setSearchOpen(false)
            }
          }}
          placeholder={isSearching ? 'Indexing folder contents...' : 'Search path and text snippets'}
        />
      </label>
      <ul className="search-results">
        {fileSearchResults.map((hit) => (
          <li key={`${hit.documentId}-${hit.path}`}>
            <button
              type="button"
              className="search-result"
              onClick={() => {
                void openRecentDocument(hit.documentId)
                setSearchOpen(false)
              }}
            >
              <strong>{hit.title}</strong>
              <span>{hit.path}</span>
              <p>{hit.snippet}</p>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export default SearchModal
