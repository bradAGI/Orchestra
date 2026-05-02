import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import DOMPurify from 'dompurify'

let renderQueue: Promise<void> = Promise.resolve()
let initializedTheme: 'light' | 'dark' | null = null

function ensureInitialized(theme: 'light' | 'dark') {
  if (initializedTheme === theme) return
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'light' ? 'default' : 'dark',
    securityLevel: 'strict',
  })
  initializedTheme = theme
}

// Stable per-instance id so re-renders mutate the same SVG node instead of
// regenerating one with a fresh random id (which causes the visible flash).
let nextMermaidId = 0

export function MermaidBlock({ code, theme }: { code: string; theme?: 'light' | 'dark' }) {
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const idRef = useRef<string>(`mermaid-${++nextMermaidId}`)
  const lastRenderedRef = useRef<{ code: string; theme?: string } | null>(null)
  // hasSvg tracks whether the container currently has a rendered diagram in
  // it. While false, we render the source as a `<pre>` so the user sees text
  // instead of a blank box (e.g. mid-typing or first paint).
  const [hasSvg, setHasSvg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const last = lastRenderedRef.current
    if (last && last.code === code && last.theme === theme) return

    let cancelled = false
    const trimmed = code.trim()
    if (!trimmed) {
      if (svgContainerRef.current) svgContainerRef.current.innerHTML = ''
      setHasSvg(false)
      lastRenderedRef.current = { code, theme }
      return
    }

    renderQueue = renderQueue.then(async () => {
      if (cancelled) return
      try {
        ensureInitialized(theme === 'light' ? 'light' : 'dark')
        const isValid = await tryParse(trimmed)
        if (cancelled) return
        if (!isValid) {
          // Mid-typing: keep the existing SVG (if any) instead of flashing.
          setError(null)
          return
        }
        const { svg } = await mermaid.render(idRef.current, trimmed)
        if (cancelled || !svgContainerRef.current) return
        // Mermaid puts node labels inside <foreignObject> as HTML, so we need
        // both SVG and HTML profiles. Without the html profile, label text is
        // stripped and you see empty boxes. Keep <style>/<foreignObject> tags
        // because Mermaid's themes embed CSS in a <style> child of the SVG.
        svgContainerRef.current.innerHTML = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true, html: true },
          ADD_TAGS: ['foreignObject', 'style'],
          ADD_ATTR: ['xmlns', 'xmlns:xlink', 'transform', 'preserveAspectRatio'],
        })
        lastRenderedRef.current = { code, theme }
        setHasSvg(true)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Render failed')
      }
    })

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

  // Always mount the same DOM nodes — the SVG container is hidden when we
  // haven't rendered yet, and a fallback `<pre>` shows the source so the
  // user sees content instead of a blank gap. Keeping both nodes mounted
  // (rather than swapping React subtrees) avoids any layout flicker.
  return (
    <div className="my-2">
      <div
        ref={svgContainerRef}
        className={`flex justify-center [&_svg]:max-w-full ${hasSvg ? '' : 'hidden'}`}
      />
      {!hasSvg && (
        <pre className="rounded border border-border/60 bg-muted/40 p-3 text-xs whitespace-pre-wrap font-mono">
          {code}
        </pre>
      )}
    </div>
  )
}

async function tryParse(code: string): Promise<boolean> {
  try {
    await mermaid.parse(code)
    return true
  } catch {
    return false
  }
}
