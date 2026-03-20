import type { ReactNode } from 'react'
import type { JsonRenderSpec } from '../lib/types'

interface JsonRenderBlockProps {
  spec: JsonRenderSpec
  onAction?: (actionName: string, params?: Record<string, unknown>) => void
}

/**
 * Renders a json-render spec by walking the element tree directly.
 * Each element type maps to a styled React component.
 */
export function JsonRenderBlock({ spec, onAction }: JsonRenderBlockProps) {
  if (!spec?.root || !spec?.elements) return null

  function renderElement(key: string): ReactNode {
    const el = spec.elements[key]
    if (!el) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (el.props ?? {}) as Record<string, any>
    const kids = (el.children?.map((k) => renderElement(k)) ?? []) as ReactNode[]

    switch (el.type) {
      case 'Card':
        return (
          <div key={key} className={`rounded-xl border border-border/20 bg-background/30 ${p.padding === 'sm' ? 'p-2' : p.padding === 'lg' ? 'p-5' : 'p-3'}`}>
            {p.title && <p className="text-xs font-bold mb-2">{String(p.title)}</p>}
            {p.description && <p className="text-[10px] text-muted-foreground mb-2">{String(p.description)}</p>}
            <div className="space-y-2">{kids}</div>
          </div>
        )

      case 'Stack':
        return (
          <div key={key} className={`flex ${p.direction === 'horizontal' ? 'flex-row items-center' : 'flex-col'} ${p.gap === 'sm' ? 'gap-1' : p.gap === 'lg' ? 'gap-4' : 'gap-2'}`}>
            {kids}
          </div>
        )

      case 'Divider':
        return (
          <div key={key} className="flex items-center gap-2 my-1.5">
            <div className="flex-1 h-px bg-border/30" />
            {p.label && <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{String(p.label)}</span>}
            <div className="flex-1 h-px bg-border/30" />
          </div>
        )

      case 'Metric':
        return (
          <div key={key} className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{String(p.label ?? '')}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black">{String(p.value ?? '')}</span>
              {p.trend && (
                <span className={`text-[10px] font-bold ${p.trend === 'up' ? 'text-emerald-500' : p.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {p.trendValue ? String(p.trendValue) : ''}
                </span>
              )}
            </div>
          </div>
        )

      case 'Table': {
        const columns = (p.columns ?? []) as { key: string; label: string }[]
        const rows = (p.rows ?? []) as Record<string, unknown>[]
        return (
          <div key={key} className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/30">
                  {columns.map((col) => (
                    <th key={col.key} className="py-1 px-2 font-bold uppercase tracking-wider text-[9px] text-muted-foreground text-left">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-border/10 ${p.striped && i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                    {columns.map((col) => (
                      <td key={col.key} className="py-1 px-2">{String(row[col.key] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      case 'Badge':
        return (
          <span key={key} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            p.variant === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
            p.variant === 'warning' ? 'bg-amber-500/10 text-amber-500' :
            p.variant === 'error' ? 'bg-red-500/10 text-red-500' :
            p.variant === 'info' ? 'bg-blue-500/10 text-blue-500' :
            'bg-muted text-muted-foreground'
          }`}>{String(p.label ?? '')}</span>
        )

      case 'CodeBlock':
        return (
          <div key={key} className="rounded-lg border border-border/20 overflow-hidden">
            {p.title && (
              <div className="bg-muted/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/20">
                {String(p.title)}{p.language ? ` · ${String(p.language)}` : ''}
              </div>
            )}
            <pre className="p-2.5 text-[11px] font-mono overflow-x-auto bg-background/30"><code>{String(p.code ?? '')}</code></pre>
          </div>
        )

      case 'KeyValue': {
        const pairs = (p.pairs ?? []) as { key: string; value: string }[]
        return (
          <div key={key} className="space-y-1">
            {pairs.map((pair, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground font-medium min-w-[72px]">{pair.key}</span>
                <span className="font-mono">{pair.value}</span>
              </div>
            ))}
          </div>
        )
      }

      case 'Button':
        return (
          <button key={key} onClick={() => onAction?.(String(p.action ?? ''), (p.params ?? {}) as Record<string, unknown>)}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              p.variant === 'secondary' ? 'border border-border/30 text-foreground hover:bg-muted/50' :
              p.variant === 'destructive' ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' :
              p.variant === 'ghost' ? 'text-muted-foreground hover:text-foreground hover:bg-muted/30' :
              'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}>{String(p.label ?? '')}</button>
        )

      case 'ButtonGroup':
        return <div key={key} className={`flex ${p.direction === 'vertical' ? 'flex-col' : 'flex-row'} gap-1.5`}>{kids}</div>

      case 'Alert':
        return (
          <div key={key} className={`rounded-lg border px-3 py-2 text-[11px] ${
            p.variant === 'success' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' :
            p.variant === 'warning' ? 'border-amber-500/30 bg-amber-500/5 text-amber-400' :
            p.variant === 'error' ? 'border-red-500/30 bg-red-500/5 text-red-400' :
            'border-blue-500/30 bg-blue-500/5 text-blue-400'
          }`}>
            {p.title && <p className="font-bold mb-0.5">{String(p.title)}</p>}
            <p>{String(p.message ?? '')}</p>
          </div>
        )

      case 'Progress': {
        const val = Number(p.value ?? 0)
        const max = Number(p.max ?? 100)
        return (
          <div key={key} className="space-y-1">
            {p.label && <p className="text-[9px] font-bold text-muted-foreground">{String(p.label)}</p>}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (val / max) * 100)}%` }} />
            </div>
          </div>
        )
      }

      case 'List': {
        const items = (p.items ?? []) as { label: string; description?: string }[]
        return (
          <div key={key} className="space-y-1">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="text-muted-foreground mt-0.5">{p.ordered ? `${i + 1}.` : '•'}</span>
                <div>
                  <span className="font-medium">{item.label}</span>
                  {item.description && <span className="text-muted-foreground ml-1">— {item.description}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      }

      default:
        return <div key={key} className="text-[10px] text-muted-foreground">[Unknown: {el.type}]</div>
    }
  }

  try {
    return <div>{renderElement(spec.root)}</div>
  } catch (err) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
        <p className="text-[10px] font-bold text-amber-500 mb-1">Render error</p>
        <pre className="text-[9px] font-mono text-muted-foreground overflow-auto max-h-[80px]">
          {err instanceof Error ? err.message : 'Unknown error'}
        </pre>
      </div>
    )
  }
}
