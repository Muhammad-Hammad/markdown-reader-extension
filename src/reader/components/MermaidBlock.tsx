import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReaderMode } from '../../shared/types'
import { getErrorMessage } from '../utils'

function MermaidBlock({ code, mode }: { code: string; mode: ReaderMode }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState('')

  // Entities can sneak in via rehype-raw / DOMPurify round-trips. Mermaid's
  // parser reads characters literally, so `&gt;` is *not* equivalent to `>`.
  // Decode once, up-front, and remember the normalised string.
  const normalisedCode = useMemo(() => normaliseMermaidSource(code), [code])

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      if (!containerRef.current || !normalisedCode) {
        return
      }

      try {
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'antiscript',
          theme: mode === 'light' || mode === 'read' ? 'neutral' : 'dark',
        })
        const result = await mermaid.render(id, normalisedCode)
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = result.svg
        setError('')
      } catch (renderError) {
        if (cancelled) return
        setError(getErrorMessage(renderError))
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [normalisedCode, mode])

  if (error) {
    return (
      <div className="mermaid-error">
        Mermaid render error
        <pre>{error}</pre>
        <details>
          <summary>Source</summary>
          <pre>{normalisedCode}</pre>
        </details>
      </div>
    )
  }

  return <div ref={containerRef} className="mermaid-shell" />
}

// Mermaid's parser is whitespace- and character-sensitive. Upstream plugins
// can hand us entity-encoded text (`&gt;` instead of `>`), non-breaking
// spaces, or trailing blank lines that produce confusing parse errors.
function normaliseMermaidSource(raw: string): string {
  if (!raw) return ''

  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null
  let decoded = raw
  if (textarea) {
    textarea.innerHTML = raw
    decoded = textarea.value
  }

  return decoded
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*\n/, '')
    .replace(/\s+$/, '')
}

export default MermaidBlock
