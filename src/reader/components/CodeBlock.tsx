import clsx from 'clsx'

function CodeBlock({
  className,
  code,
  wrap,
}: {
  className: string
  code: string
  wrap: boolean
}) {
  return (
    <div className="code-block-shell">
      <button
        type="button"
        className="copy-code-button"
        onClick={() => void navigator.clipboard.writeText(code)}
      >
        Copy
      </button>
      <pre className={clsx(className, { wrapped: wrap })}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default CodeBlock
