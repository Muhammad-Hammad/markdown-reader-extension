import type { CSSProperties } from 'react'
import { BookOpenText, FolderOpen, Globe, Keyboard } from 'lucide-react'

const popupStyle: CSSProperties = {
  width: 320,
  padding: 16,
  background: '#0f172a',
  color: '#e2e8f0',
  fontFamily: 'Inter, system-ui, sans-serif',
}

const cardStyle: CSSProperties = {
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: 16,
  padding: 14,
  background: 'rgba(15, 23, 42, 0.8)',
}

const buttonStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  marginTop: 10,
  borderRadius: 12,
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: '#1d4ed8',
  color: '#eff6ff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

function PopupApp() {
  const openReader = async () => {
    await chrome.runtime.openOptionsPage()
    window.close()
  }

  return (
    <main style={popupStyle}>
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpenText size={20} />
          <div>
            <strong style={{ display: 'block', fontSize: 15 }}>Markdown Reader</strong>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              Nested files, reader modes, search, export.
            </span>
          </div>
        </div>

        <button type="button" style={buttonStyle} onClick={openReader}>
          Open reader workspace
        </button>

        <div
          style={{
            display: 'grid',
            gap: 10,
            marginTop: 14,
            fontSize: 12,
            color: '#cbd5e1',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FolderOpen size={14} />
            Pick folders or single files from the reader toolbar.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Globe size={14} />
            Paste raw Markdown URLs or `file://` links into the source bar.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Keyboard size={14} />
            Use `Ctrl+Shift+M` to open the reader tab quickly.
          </div>
        </div>
      </section>
    </main>
  )
}

export default PopupApp
