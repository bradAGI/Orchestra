import React from 'react'
import { Download, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChartCardProps {
  title: string
  subtitle?: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onExport?: () => void
  className?: string
  children: React.ReactNode
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  loading,
  error,
  onRetry,
  onExport,
  className = '',
  children,
}) => {
  return (
    <div
      className={`group relative bg-gradient-to-b from-card via-card to-muted/20 backdrop-blur-xl border border-border/60 rounded-2xl p-6 shadow-lg transition-all hover:border-primary/10 overflow-hidden ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            {title}
          </div>
          {subtitle && (
            <div className="text-[9px] text-muted-foreground/40 mt-0.5">{subtitle}</div>
          )}
        </div>
        {onExport && !loading && !error && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onExport}
          >
            <Download size={12} className="text-muted-foreground" />
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-muted/40 rounded w-3/4" />
          <div className="h-32 bg-muted/30 rounded-xl" />
          <div className="h-4 bg-muted/40 rounded w-1/2" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <p className="text-xs text-red-500 font-bold">{error}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-[10px] gap-1">
              <RefreshCcw size={10} />
              Retry
            </Button>
          )}
        </div>
      ) : (
        <div className="relative z-10">{children}</div>
      )}
    </div>
  )
}
