import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Project } from '@/lib/orchestra-types'
import type { BackendConfig, GitCommit, GitStatusEntry, GitHubPR } from '@/lib/orchestra-client'
import {
  fetchProjectGitHistory,
  fetchProjectGitStatus,
  fetchProjectGitDiff,
  fetchProjectGitBranches,
} from '@/lib/orchestra-client'

import { BranchBar } from './BranchBar'
import { ChangesList } from './ChangesList'
import { CommitTimeline } from './CommitTimeline'
import { DiffViewer } from './DiffViewer'
import { GitHubPanel } from './GitHubPanel'
import { PRReviewView } from './PRReviewView'

export function GitTab({
  project,
  config,
}: {
  project: Project
  config: BackendConfig | null
}) {
  const [currentBranch, setCurrentBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [status, setStatus] = useState<GitStatusEntry[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  const [diffMode, setDiffMode] = useState<'split' | 'unified'>('unified')
  const [activePR, setActivePR] = useState<GitHubPR | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadAll = useCallback(async () => {
    if (!config) return
    setRefreshing(true)
    try {
      const [branchData, statusData, historyData] = await Promise.all([
        fetchProjectGitBranches(config, project.id),
        fetchProjectGitStatus(config, project.id),
        fetchProjectGitHistory(config, project.id),
      ])
      setCurrentBranch(branchData.current || '')
      setBranches(branchData.branches || [])
      setStatus(statusData)
      setCommits(historyData)
    } catch (err) {
      console.error('git load failed', err)
    } finally {
      setRefreshing(false)
    }
  }, [config, project.id])

  useEffect(() => { loadAll() }, [loadAll])

  // Fetch diff when file or commit is selected
  useEffect(() => {
    if (!config) return
    if (selectedCommit) {
      fetchProjectGitDiff(config, project.id, selectedCommit)
        .then(setDiff)
        .catch(() => setDiff(''))
    } else if (selectedFile) {
      fetchProjectGitDiff(config, project.id)
        .then(setDiff)
        .catch(() => setDiff(''))
    }
  }, [config, project.id, selectedFile, selectedCommit])

  function handleFileSelect(path: string) {
    setSelectedFile(path)
    setSelectedCommit(null)
  }

  function handleCommitSelect(hash: string) {
    setSelectedCommit(hash)
    setSelectedFile(null)
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Waiting for backend connection...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Branch bar */}
      <BranchBar
        projectId={project.id}
        config={config}
        currentBranch={currentBranch}
        branches={branches}
        onBranchChange={loadAll}
      />

      {/* Refresh button */}
      <button
        onClick={loadAll}
        disabled={refreshing}
        className="absolute top-2 right-3 z-10 text-muted-foreground hover:text-foreground"
        title="Refresh"
      >
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
      </button>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel: Changes + Commits */}
        <div className="w-80 shrink-0 border-r border-border/40 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
            <ChangesList
              projectId={project.id}
              config={config}
              status={status}
              onFileSelect={handleFileSelect}
              onRefresh={loadAll}
            />
          </div>
          <div className="border-t border-border/40 flex-1 overflow-hidden min-h-0">
            <div className="px-3 py-1.5 shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Commits ({commits.length})
              </span>
            </div>
            <CommitTimeline
              commits={commits}
              selectedHash={selectedCommit}
              onSelectCommit={handleCommitSelect}
            />
          </div>
        </div>

        {/* Right panel: Diff viewer */}
        <div className="flex-1 overflow-hidden">
          <DiffViewer
            diff={diff}
            fileName={selectedFile ?? undefined}
            mode={diffMode}
            onModeChange={setDiffMode}
          />
        </div>
      </div>

      {/* GitHub panel */}
      {project.github_owner && project.github_repo && (
        <GitHubPanel
          projectId={project.id}
          config={config}
          githubToken={project.github_token ?? ''}
          onOpenPR={setActivePR}
        />
      )}

      {/* PR Review overlay */}
      {activePR && (
        <PRReviewView
          projectId={project.id}
          config={config}
          pr={activePR}
          onClose={() => setActivePR(null)}
        />
      )}
    </div>
  )
}
