import { KEYBOARD_SHORTCUTS } from '../constants'
import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'
import Modal from './Modal'

function KeyboardShortcutsModal() {
  const {
    actions: { setHelpOpen },
    state: { helpOpen },
  } = useReaderWorkspaceContext()

  if (!helpOpen) {
    return null
  }

  return (
    <Modal title="Keyboard shortcuts" onClose={() => setHelpOpen(false)}>
      <ul className="shortcut-list">
        {KEYBOARD_SHORTCUTS.map(([keys, action]) => (
          <li key={keys}>
            <kbd>{keys}</kbd>
            <span>{action}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export default KeyboardShortcutsModal
