import { useState, useEffect, useCallback } from 'react'
import { X, Check, AlertTriangle, ChevronDown } from 'lucide-react'
import type { BackendConfig, GitHubPR } from '@/lib/orchestra-client'
import { fetchProjectGitHubPullDiff, fetchPRReviews, submitPRReview, mergePR } from '@/lib/orchestra-client'
import { DiffViewer } from './DiffViewer'

type ReviewTab = 'files' | 'reviews'
type MergeMethod = 'merge' | 'squash' | 'rebase'

type Review = {
  id?: number
  user?: { login: string }
  body: string
  state: string
  submitted_at?: string
}

function reviewStateBadge(state: string): string {
  switch (state.toLowerCase()) {
    case 'approved': return 'bg-green-500/20 text-green-400'
    case 'changes_requested': return 'bg-amber-500/20 text-amber-400'
    case 'commented': return 'bg-blue-500/20 text-blue-400'
    default: return 'bg-muted/20 text-muted-foreground'
  }
}

function prStatusBadge(pr: GitHubPR): { style: string; label: string } {
  if (pr.merged_at) return { style: 'bg-purple-500/20 text-purple-400', label: 'merged' }
  if (pr.state === 'closed') return { style: 'bg-red-500/20 text-red-400', label: 'closed' }
  return { style: 'bg-green-500/20 text-green-400', label: 'open' }
}

export function PRReviewView({
  projectId,
  config,
  pr,
  onClose,
}: {
  projectId: string
  config: BackendConfig
  pr: GitHubPR
  onClose: () => void
}) {
  const [tab, setTab] = useState<ReviewTab>('files')
  const [diffText, setDiffText] = useState('')
  const [diffMode, setDiffMode] = useState<'split' | 'unified'>('unified')
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewBody, setReviewBody] = useState('')
  const [mergeOpen, setMergeOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [diff, revs] = await Promise.all([
        fetchProjectGitHubPullDiff(config, projectId, pr.number),
        fetchPRReviews(config, projectId, pr.number) as Promise<Review[]>,
      ])
      setDiffText(diff)
      setReviews(revs)
    } catch (err) {
      console.error('PR review data load failed', err)
    }
  }, [config, projectId, pr.number])

  useEffect(() => { loadData() }, [loadData])

  async function handleReview(event: string) {
    if (loading) return
    setLoading(true)
    try {
      await submitPRReview(config, projectId, pr.number, reviewBody, event)
      setReviewBody('')
      await loadData()
    } catch (err) {
      console.error('submit review failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleMerge(method: MergeMethod) {
    setMergeOpen(false)
    setLoading(true)
    try {
      await mergePR(config, projectId, pr.number, method)
      await loadData()
    } catch (err) {
      console.error('merge failed', err)
    } finally {
      setLoading(false)
    }
  }

  const status = prStatusBadge(pr)

  return (
    <div className="absolute inset-0 bg-card z-30 flex flex-col overflow-hidden rounded-xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{pr.title}</span>
            <span className="text-[10px] text-muted-foreground/60 font-mono">#{pr.number}</span>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${status.style}`}>{status.label}</span>
          </div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5">
            {pr.base.ref} &larr; {pr.head.ref}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-2 border-b border-border/40 shrink-0">
        <button
          onClick={() => setTab('files')}
          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded ${
            tab === 'files' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Files Changed
        </button>
        <button
          onClick={() => setTab('reviews')}
          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded ${
            tab === 'reviews' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Reviews ({reviews.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'files' ? (
          <DiffViewer diff={diffText} mode={diffMode} onModeChange={setDiffMode} />
        ) : (
          <div className="overflow-y-auto h-full p-4 space-y-3">
            {reviews.map((review, i) => (
              <div key={review.id ?? i} className="bg-muted/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium text-foreground">{review.user?.login ?? 'unknown'}</span>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${reviewStateBadge(review.state)}`}>
                    {review.state.replace('_', ' ')}
                  </span>
                </div>
                {review.body && (
                  <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{review.body}</p>
                )}
              </div>
            ))}
            {reviews.length === 0 && (
              <div className="text-[10px] text-muted-foreground/50 text-center py-4">No reviews yet</div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border/40 shrink-0">
        <textarea
          value={reviewBody}
          onChange={(e) => setReviewBody(e.target.value)}
          placeholder="Review comment..."
          rows={1}
          className="flex-1 bg-muted/10 border border-border/40 rounded-lg px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 resize-none outline-none focus:border-primary/60"
        />
        <button
          onClick={() => handleReview('APPROVE')}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40"
        >
          <Check size={10} /> Approve
        </button>
        <button
          onClick={() => handleReview('REQUEST_CHANGES')}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40"
        >
          <AlertTriangle size={10} /> Changes
        </button>
        <div className="relative">
          <button
            onClick={() => setMergeOpen((v) => !v)}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
          >
            Merge <ChevronDown size={10} />
          </button>
          {mergeOpen && (
            <div className="absolute bottom-full right-0 mb-1 bg-card border border-border/40 rounded-xl shadow-lg z-20 py-1 min-w-[120px]">
              <button onClick={() => handleMerge('merge')} className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/20">Merge</button>
              <button onClick={() => handleMerge('squash')} className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/20">Squash</button>
              <button onClick={() => handleMerge('rebase')} className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/20">Rebase</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
