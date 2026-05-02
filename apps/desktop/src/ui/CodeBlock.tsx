import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CodeBlock({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const language = className?.replace('hljs language-', '')?.replace('language-', '') ?? ''
  const code = typeof children === 'string' ? children : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="group relative">
      {language && (
        <span className="absolute top-2 left-3 text-[10px] uppercase text-muted-foreground/60 font-mono">
          {language}
        </span>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy code"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <code className={className} {...props}>
        {children}
      </code>
    </div>
  )
}
