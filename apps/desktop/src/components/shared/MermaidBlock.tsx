import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import DOMPurify from 'dompurify'

let renderQueue = Promise.resolve()

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
})

export function MermaidBlock({ code, theme }: { code: string; theme?: 'light' | 'dark' }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`
    let cancelled = false

    renderQueue = renderQueue.then(async () => {
      if (cancelled) return
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'light' ? 'default' : 'dark',
          securityLevel: 'strict',
        })
        const { svg } = await mermaid.render(id, code)
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Render failed')
      }
    })

    // Collapse the queue so old closures can be GC'd
    renderQueue = renderQueue.then(() => {})

    return () => { cancelled = true }
  }, [code, theme])

  if (error) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
        <p className="font-medium mb-1">Mermaid render error</p>
        <pre className="whitespace-pre-wrap">{code}</pre>
      </div>
    )
  }

  return <div ref={containerRef} className="my-2 flex justify-center [&_svg]:max-w-full" />
}
