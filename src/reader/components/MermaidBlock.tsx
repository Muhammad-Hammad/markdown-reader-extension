import { useEffect, useRef, useState } from 'react'
import type { ReaderMode } from '../../shared/types'
import { getErrorMessage } from '../utils'

function MermaidBlock({ code, mode }: { code: string; mode: ReaderMode }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current) {
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
        const result = await mermaid.render(id, code)
        containerRef.current.innerHTML = result.svg
        setError('')
      } catch (renderError) {
        setError(getErrorMessage(renderError))
      }
    }

    void render()
  }, [code, mode])

  if (error) {
    return (
      <div className="mermaid-error">
        Mermaid render error
        <pre>{error}</pre>
      </div>
    )
  }

  return <div ref={containerRef} className="mermaid-shell" />
}

export default MermaidBlock
