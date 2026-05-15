import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

type Props = {
  label: string
  /** Plain text version copied to clipboard (without highlight markup) */
  copyText: string
  /** Highlighted JSX rendered inside the <pre>. Can include <span className="c|k|v"/>. */
  children: ReactNode
}

export function Snippet({ label, copyText, children }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked in insecure contexts */
    }
  }

  return (
    <div className="snippet-block">
      <p className="snippet-label">{label}</p>
      <div className="snippet">
        <button
          className={`snippet-copy ${copied ? 'copied' : ''}`}
          onClick={() => void copy()}
          title="Copy to clipboard"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {children}
      </div>
    </div>
  )
}
