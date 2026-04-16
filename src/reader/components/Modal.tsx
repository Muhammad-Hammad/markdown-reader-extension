import type { ReactNode } from 'react'

function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="modal-backdrop" onClick={onClose} />
      <div className="modal-card">
        <div className="modal-header">
          <strong>{title}</strong>
          <button type="button" className="toolbar-button icon" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default Modal
