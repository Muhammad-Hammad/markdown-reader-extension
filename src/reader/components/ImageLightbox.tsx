import { useReaderWorkspaceContext } from '../useReaderWorkspaceContext'

function ImageLightbox({ imageSources }: { imageSources: string[] }) {
  const {
    actions: { setLightboxIndex },
    state: { lightboxIndex },
  } = useReaderWorkspaceContext()

  if (lightboxIndex === null || !imageSources[lightboxIndex]) {
    return null
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true">
      <button type="button" className="lightbox-backdrop" onClick={() => setLightboxIndex(null)} />
      <div className="lightbox-content">
        <img src={imageSources[lightboxIndex]} alt="Expanded markdown asset" />
        <div className="lightbox-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={() =>
              setLightboxIndex((current) =>
                current === null ? 0 : (current - 1 + imageSources.length) % imageSources.length,
              )
            }
          >
            Previous
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() =>
              setLightboxIndex((current) => (current === null ? 0 : (current + 1) % imageSources.length))
            }
          >
            Next
          </button>
          <button type="button" className="toolbar-button" onClick={() => setLightboxIndex(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImageLightbox
