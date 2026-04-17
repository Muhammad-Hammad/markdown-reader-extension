import Modal from './Modal'

function NoteComposerModal({
  noteDraft,
  onClose,
  onDraftChange,
  onSave,
  selectionQuote,
}: {
  noteDraft: string
  onClose: () => void
  onDraftChange: (value: string) => void
  onSave: () => void
  selectionQuote: string
}) {
  return (
    <Modal title="Add note" onClose={onClose}>
      <div className="note-composer">
        <div className="note-selection-preview">
          <strong>Selected text</strong>
          <p>{selectionQuote}</p>
        </div>

        <label className="note-composer-field">
          Your note
          <textarea
            autoFocus
            value={noteDraft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Capture the idea, concern, or follow-up linked to this selection."
            rows={6}
          />
        </label>
      </div>

      <div className="modal-actions">
        <button type="button" className="toolbar-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="toolbar-button primary" onClick={onSave} disabled={!noteDraft.trim()}>
          Save note
        </button>
      </div>
    </Modal>
  )
}

export default NoteComposerModal
