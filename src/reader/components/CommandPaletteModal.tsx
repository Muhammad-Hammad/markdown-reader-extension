import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'
import Modal from './Modal'

function CommandPaletteModal() {
  const {
    actions: {
      cycleMode,
      openFolder,
      openSingleFile,
      setCommandPaletteOpen,
      setSearchOpen,
    },
    state: { commandPaletteOpen },
  } = useReaderWorkspaceContext()

  if (!commandPaletteOpen) {
    return null
  }

  return (
    <Modal title="Command palette" onClose={() => setCommandPaletteOpen(false)}>
      <div className="command-palette">
        <PaletteAction
          title="Open folder"
          description="Select a directory and scan its nested Markdown files."
          onClick={() => {
            void openFolder()
            setCommandPaletteOpen(false)
          }}
        />
        <PaletteAction
          title="Open single file"
          description="Pick one `.md`, `.markdown`, or `.txt` document."
          onClick={() => {
            void openSingleFile()
            setCommandPaletteOpen(false)
          }}
        />
        <PaletteAction
          title="Search indexed files"
          description="Search titles, paths, and text snippets across the current folder."
          onClick={() => {
            setSearchOpen(true)
            setCommandPaletteOpen(false)
          }}
        />
        <PaletteAction
          title="Cycle reader mode"
          description="Switch between light, dark, read, low-light, ambient, and focus modes."
          onClick={() => {
            cycleMode()
            setCommandPaletteOpen(false)
          }}
        />
      </div>
    </Modal>
  )
}

function PaletteAction({
  description,
  onClick,
  title,
}: {
  description: string
  onClick: () => void
  title: string
}) {
  return (
    <button type="button" className="search-result" onClick={onClick}>
      <strong>{title}</strong>
      <p>{description}</p>
    </button>
  )
}

export default CommandPaletteModal
