import { ArrowRight, FolderOpen, Globe, Highlighter, Keyboard, NotebookPen, Volume2 } from 'lucide-react'
import {
  BRAND_MARK_PATH,
  BRAND_NAME,
  BRAND_POPUP_HEADLINE,
  BRAND_POPUP_SUPPORT_NOTE,
  BRAND_TAGLINE,
} from '../shared/brand'
import { openExtensionOptionsPage } from '../shared/runtime'

function PopupApp() {
  const openReader = async () => {
    await openExtensionOptionsPage()
    window.close()
  }

  return (
    <main className="popup-shell">
      <section className="popup-card">
        <div className="popup-brand">
          <img src={BRAND_MARK_PATH} alt="" width="46" height="46" className="popup-brand-mark" />
          <div className="popup-brand-copy">
            <span className="popup-brand-kicker">Local-first reader</span>
            <strong>{BRAND_NAME}</strong>
            <p>{BRAND_TAGLINE}</p>
          </div>
        </div>

        <div className="popup-hero">
          <h1>{BRAND_POPUP_HEADLINE}</h1>
          <p>
            Themes, read aloud, notes, highlights, and file-based reading in one calm workspace for Markdown.
          </p>
        </div>

        <div className="popup-pills" aria-label="Key features">
          <span>Reader modes</span>
          <span>Read aloud</span>
          <span>Highlights</span>
          <span>Notes</span>
        </div>

        <button type="button" className="popup-primary-button" onClick={openReader}>
          Open {BRAND_NAME}
          <ArrowRight size={16} />
        </button>

        <div className="popup-feature-list">
          <div className="popup-feature-item">
            <FolderOpen size={15} />
            Native folder and file workflows on Chromium browsers.
          </div>
          <div className="popup-feature-item">
            <Globe size={15} />
            Open raw Markdown URLs and `file://` sources from the reader bar.
          </div>
          <div className="popup-feature-item">
            <Volume2 size={15} />
            Listen by document, section, paragraph, or selection.
          </div>
          <div className="popup-feature-item">
            <Highlighter size={15} />
            Keep saved highlights and notes tied to the current document.
          </div>
          <div className="popup-feature-item">
            <NotebookPen size={15} />
            Built for quiet long-form reading, not just quick previews.
          </div>
          <div className="popup-feature-item">
            <Keyboard size={15} />
            Use `Ctrl+Shift+Y` to jump straight into the workspace.
          </div>
        </div>

        <p className="popup-support-note">{BRAND_POPUP_SUPPORT_NOTE}</p>
      </section>
    </main>
  )
}

export default PopupApp
