import { useEffect, type ReactNode } from 'react'

function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode
  onClose: () => void
  title: string
}) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

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
