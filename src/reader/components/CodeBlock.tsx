import clsx from 'clsx'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

interface CodeBlockProps {
  children: ReactNode
  className: string
  code: string
  wrap: boolean
}

function CodeBlock({ children, className, code, wrap }: CodeBlockProps) {
  const language = extractLanguage(className)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="code-block-shell">
      <div className="code-block-chrome">
        {language ? <span className="code-lang-label">{language}</span> : null}
        <button
          type="button"
          className="copy-code-button"
          onClick={() => void handleCopy()}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={clsx(className, { wrapped: wrap })}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

// Match the same anchored pattern used in useReaderDocumentView so the label
// survives languages with punctuation (c#, c++, objective-c, f#).
function extractLanguage(className: string): string {
  const match = /(?:^|\s)language-(\S+)/.exec(className)
  return match?.[1] ?? ''
}

export default CodeBlock
