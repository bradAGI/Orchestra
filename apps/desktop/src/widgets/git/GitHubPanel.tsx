import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, CircleDot, GitPullRequest, Plus, X } from 'lucide-react'
import type { BackendConfig, GitHubIssue, GitHubPR } from '@/lib/orchestra-client'
import {
  fetchProjectGitHubIssues,
  fetchProjectGitHubPulls,
  createProjectGitHubIssue,
  updateProjectGitHubIssue,
  createProjectGitHubPull,
  fetchProjectGitBranches,
  fetchDefaultBranch,
} from '@/lib/orchestra-client'

type SubTab = 'issues' | 'prs'
type IssueFilter = 'open' | 'closed' | 'all'

function friendlyErrorMessage(err: unknown): { summary: string; detail: string } {
  const raw = err instanceof Error ? err.message : String(err)
  if (/unauthorized|401/i.test(raw)) {
    return { summary: 'GitHub authentication failed. Reconnect in project settings.', detail: raw }
  }
  if (/rate.limit|429/i.test(raw)) {
    return { summary: 'GitHub rate limit exceeded. Please wait and try again.', detail: raw }
  }
  return { summary: 'Failed to load GitHub data.', detail: raw }
}

export function GitHubPanel({
  projectId,
  config,
  onOpenPR,
}: {
  projectId: string
  config: BackendConfig
  githubToken: string
  onOpenPR: (pr: GitHubPR) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<SubTab>('issues')
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('open')
  const [issues, setIssues] = useState<GitHubIssue[]>([])
  const [prs, setPRs] = useState<GitHubPR[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null)
  const [showCreateIssue, setShowCreateIssue] = useState(false)
  const [showCreatePR, setShowCreatePR] = useState(false)
  const [newIssueTitle, setNewIssueTitle] = useState('')
  const [newIssueBody, setNewIssueBody] = useState('')
  const [newPRTitle, setNewPRTitle] = useState('')
  const [newPRBody, setNewPRBody] = useState('')
  const [newPRHead, setNewPRHead] = useState('')
  const [newPRBase, setNewPRBase] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<{ summary: string; detail: string } | null>(null)

  // Pagination state
  const [issuePage, setIssuePage] = useState(1)
  const [issueHasMore, setIssueHasMore] = useState(false)
  const [prPage, setPrPage] = useState(1)
  const [prHasMore, setPrHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Default branch for PR base
  const [defaultBranch, setDefaultBranch] = useState('main')

  const loadData = useCallback(async () => {
    setLoadError(null)
    try {
      const [issueData, prData, branchData] = await Promise.all([
        fetchProjectGitHubIssues(config, projectId, issueFilter === 'all' ? 'all' : issueFilter),
        fetchProjectGitHubPulls(config, projectId),
        fetchProjectGitBranches(config, projectId),
      ])
      setIssues(issueData?.issues || [])
      setIssueHasMore(issueData?.has_more || false)
      setIssuePage(1)
      setPRs(prData?.pulls || [])
      setPrHasMore(prData?.has_more || false)
      setPrPage(1)
      setBranches(branchData?.branches || [])
    } catch (err) {
      console.error('github load failed', err)
      setLoadError(friendlyErrorMessage(err))
    }
  }, [config, projectId, issueFilter])

  // Fetch default branch on mount
  useEffect(() => {
    fetchDefaultBranch(config, projectId)
      .then((branch) => {
        setDefaultBranch(branch)
        setNewPRBase(branch)
      })
      .catch(() => {
        // Keep the fallback default
      })
  }, [config, projectId])

  useEffect(() => { loadData() }, [loadData])

  // Set default base branch when PR form opens
  useEffect(() => {
    if (showCreatePR && !newPRBase) {
      setNewPRBase(defaultBranch)
    }
  }, [showCreatePR, defaultBranch, newPRBase])

  const loadMoreIssues = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const nextPage = issuePage + 1
      const data = await fetchProjectGitHubIssues(config, projectId, issueFilter === 'all' ? 'all' : issueFilter, nextPage)
      setIssues((prev) => [...prev, ...(data?.issues || [])])
      setIssueHasMore(data?.has_more || false)
      setIssuePage(nextPage)
    } catch (err) {
      console.error('load more issues failed', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const loadMorePRs = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const nextPage = prPage + 1
      const data = await fetchProjectGitHubPulls(config, projectId, nextPage)
      setPRs((prev) => [...prev, ...(data?.pulls || [])])
      setPrHasMore(data?.has_more || false)
      setPrPage(nextPage)
    } catch (err) {
      console.error('load more PRs failed', err)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleCreateIssue() {
    if (!newIssueTitle.trim() || loading) return
    setLoading(true)
    try {
      await createProjectGitHubIssue(config, projectId, { title: newIssueTitle, body: newIssueBody })
      setNewIssueTitle('')
      setNewIssueBody('')
      setShowCreateIssue(false)
      await loadData()
    } catch (err) {
      console.error('create issue failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleIssueState(issue: GitHubIssue) {
    setLoading(true)
    try {
      await updateProjectGitHubIssue(config, projectId, issue.number, {
        state: issue.state === 'open' ? 'closed' : 'open',
      })
      await loadData()
    } catch (err) {
      console.error('toggle issue failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePR() {
    if (!newPRTitle.trim() || !newPRHead || !newPRBase || loading) return
    setLoading(true)
    try {
      await createProjectGitHubPull(config, projectId, {
        title: newPRTitle,
        body: newPRBody,
        head: newPRHead,
        base: newPRBase,
      })
      setNewPRTitle('')
      setNewPRBody('')
      setNewPRHead('')
      setNewPRBase('')
      setShowCreatePR(false)
      await loadData()
    } catch (err) {
      console.error('create PR failed', err)
    } finally {
      setLoading(false)
    }
  }

  function prStatusStyle(pr: GitHubPR): string {
    if (pr.merged_at) return 'bg-purple-500/20 text-purple-400'
    if (pr.state === 'closed') return 'bg-red-500/20 text-red-400'
    return 'bg-green-500/20 text-green-400'
  }

  function prStatusLabel(pr: GitHubPR): string {
    if (pr.merged_at) return 'merged'
    return pr.state
  }

  return (
    <div className="border-t border-border/40">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/10"
      >
        {collapsed ? <ChevronRight size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">GitHub</span>
        <span className="text-[9px] text-muted-foreground/50 ml-1">
          {issues.length} issues / {prs.length} PRs
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3">
          {/* Error state */}
          {loadError && (
            <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-[11px] text-red-400 font-medium">{loadError.summary}</p>
              <details className="mt-1">
                <summary className="text-[9px] text-red-400/60 cursor-pointer">Details</summary>
                <pre className="text-[9px] text-red-400/50 mt-1 whitespace-pre-wrap break-all">{loadError.detail}</pre>
              </details>
            </div>
          )}

          {/* Sub-tabs */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setTab('issues')}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded ${
                tab === 'issues' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CircleDot size={10} /> Issues
            </button>
            <button
              onClick={() => setTab('prs')}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded ${
                tab === 'prs' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GitPullRequest size={10} /> PRs
            </button>
          </div>

          {/* Issues tab */}
          {tab === 'issues' && (
            <div>
              <div className="flex items-center gap-1 mb-2">
                {(['open', 'closed', 'all'] as IssueFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setIssueFilter(f)}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded ${
                      issueFilter === f ? 'bg-primary/10 text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <button
                  onClick={() => setShowCreateIssue((v) => !v)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  {showCreateIssue ? <X size={12} /> : <Plus size={12} />}
                </button>
              </div>

              {showCreateIssue && (
                <div className="mb-2 p-2 bg-muted/10 rounded-xl space-y-1.5">
                  <input
                    value={newIssueTitle}
                    onChange={(e) => setNewIssueTitle(e.target.value)}
                    placeholder="Issue title"
                    className="w-full bg-transparent border border-border/40 rounded-lg px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary/60"
                  />
                  <textarea
                    value={newIssueBody}
                    onChange={(e) => setNewIssueBody(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full bg-transparent border border-border/40 rounded-lg px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary/60 resize-none"
                  />
                  <button
                    onClick={handleCreateIssue}
                    disabled={!newIssueTitle.trim() || loading}
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
                  >
                    Create Issue
                  </button>
                </div>
              )}

              <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                {issues.map((issue) => (
                  <div key={issue.number}>
                    <div
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/10 cursor-pointer"
                      onClick={() => setExpandedIssue(expandedIssue === issue.number ? null : issue.number)}
                    >
                      <CircleDot size={10} className={issue.state === 'open' ? 'text-green-400' : 'text-red-400'} />
                      <span className="text-[11px] text-foreground truncate flex-1">
                        #{issue.number} {issue.title}
                      </span>
                      <a
                        href={issue.html_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground/40 hover:text-muted-foreground"
                      >
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    {expandedIssue === issue.number && (
                      <div className="ml-6 px-2 py-1 text-[10px] text-muted-foreground">
                        <p className="mb-1 whitespace-pre-wrap">{issue.body || 'No description'}</p>
                        <button
                          onClick={() => handleToggleIssueState(issue)}
                          disabled={loading}
                          className="text-[9px] font-bold uppercase tracking-widest text-primary hover:text-primary/80"
                        >
                          {issue.state === 'open' ? 'Close' : 'Reopen'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {issues.length === 0 && !loadError && (
                  <div className="text-[10px] text-muted-foreground/50 text-center py-2">No issues</div>
                )}
              </div>
              {issueHasMore && (
                <button
                  onClick={() => void loadMoreIssues()}
                  disabled={loadingMore}
                  className="w-full mt-1 py-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 disabled:opacity-40"
                >
                  {loadingMore ? 'Loading...' : 'Load more...'}
                </button>
              )}
            </div>
          )}

          {/* PRs tab */}
          {tab === 'prs' && (
            <div>
              <div className="flex items-center mb-2">
                <button
                  onClick={() => setShowCreatePR((v) => !v)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  {showCreatePR ? <X size={12} /> : <Plus size={12} />}
                </button>
              </div>

              {showCreatePR && (
                <div className="mb-2 p-2 bg-muted/10 rounded-xl space-y-1.5">
                  <input
                    value={newPRTitle}
                    onChange={(e) => setNewPRTitle(e.target.value)}
                    placeholder="PR title"
                    className="w-full bg-transparent border border-border/40 rounded-lg px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary/60"
                  />
                  <textarea
                    value={newPRBody}
                    onChange={(e) => setNewPRBody(e.target.value)}
                    placeholder="Description"
                    rows={2}
                    className="w-full bg-transparent border border-border/40 rounded-lg px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary/60 resize-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newPRHead}
                      onChange={(e) => setNewPRHead(e.target.value)}
                      className="flex-1 bg-card border border-border/40 rounded-lg px-2 py-1 text-[11px] text-foreground outline-none"
                    >
                      <option value="">Head branch</option>
                      {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select
                      value={newPRBase}
                      onChange={(e) => setNewPRBase(e.target.value)}
                      className="flex-1 bg-card border border-border/40 rounded-lg px-2 py-1 text-[11px] text-foreground outline-none"
                    >
                      <option value="">Base branch</option>
                      {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={handleCreatePR}
                    disabled={!newPRTitle.trim() || !newPRHead || !newPRBase || loading}
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
                  >
                    Create PR
                  </button>
                </div>
              )}

              <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                {prs.map((pr) => (
                  <button
                    key={pr.number}
                    onClick={() => onOpenPR(pr)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/10 text-left"
                  >
                    <GitPullRequest size={10} className="text-muted-foreground shrink-0" />
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${prStatusStyle(pr)}`}>
                      {prStatusLabel(pr)}
                    </span>
                    <span className="text-[11px] text-foreground truncate flex-1">
                      #{pr.number} {pr.title}
                    </span>
                    <span className="text-[9px] text-muted-foreground/40 font-mono">
                      {pr.base.ref} &larr; {pr.head.ref}
                    </span>
                  </button>
                ))}
                {prs.length === 0 && !loadError && (
                  <div className="text-[10px] text-muted-foreground/50 text-center py-2">No pull requests</div>
                )}
              </div>
              {prHasMore && (
                <button
                  onClick={() => void loadMorePRs()}
                  disabled={loadingMore}
                  className="w-full mt-1 py-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 disabled:opacity-40"
                >
                  {loadingMore ? 'Loading...' : 'Load more...'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
