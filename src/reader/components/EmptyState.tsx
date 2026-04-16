import { LayoutTemplate } from 'lucide-react'

function EmptyState() {
  return (
    <section className="empty-state">
      <LayoutTemplate size={48} />
      <h2>Reader workspace is ready</h2>
      <p>
        Match MarkView basics first: nested file browsing, Smart TOC, export, auto-refresh, and
        readable themes. Then keep adding your own modes and productivity layers.
      </p>
      <ul>
        <li>Open a nested local folder with `Open folder`.</li>
        <li>Drop a `.md` or `.txt` file anywhere on the page.</li>
        <li>Paste a raw Markdown URL or `file://` source into the toolbar.</li>
      </ul>
    </section>
  )
}

export default EmptyState
