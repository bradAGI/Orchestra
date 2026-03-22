import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Project } from '@/lib/orchestra-types'
import type { BackendConfig, GitCommit, GitStatusEntry, GitHubPR, StashEntry, ConflictStatus } from '@/lib/orchestra-client'
import {
  fetchProjectGitHistory,
  fetchProjectGitStatus,
  fetchProjectGitDiff,
  fetchProjectGitBranches,
  gitStage,
  gitUnstage,
  gitCommit,
  gitPush,
  gitPull,
  gitFetch,
  gitMerge,
  gitDeleteBranch,
  createGitHubRepo,
  gitStashList,
  gitStashApply,
  gitStashDrop,
  gitGetConflicts,
  gitMergeAbort,
  gitConflictResolve,
} from '@/lib/orchestra-client'
import { BranchBar } from './BranchBar'
import { StagingArea } from './StagingArea'
import { CommitBar } from './CommitBar'
import { CommitTimeline } from './CommitTimeline'
import { DiffViewer } from './DiffViewer'
import { GitHubPanel } from './GitHubPanel'
import { PRReviewView } from './PRReviewView'
import { ResizableSplit } from './ResizableSplit'
import { CreateRepoDialog } from './CreateRepoDialog'
import { StashPanel } from './StashPanel'
import { ConflictBanner } from './ConflictBanner'

type SubTab = 'changes' | 'history' | 'github'

const subTabs: { key: SubTab; label: string }[] = [
  { key: 'changes', label: 'Changes' },
  { key: 'history', label: 'History' },
  { key: 'github', label: 'GitHub' },
]

function classifyFiles(files: GitStatusEntry[]): { unstaged: GitStatusEntry[]; staged: GitStatusEntry[] } {
  const staged: GitStatusEntry[] = []
  const unstaged: GitStatusEntry[] = []
  if (!files) return { staged, unstaged }
  for (const entry of files) {
    const s = entry.status
    if (s === '??' || s === '? ') {
      unstaged.push({ ...entry, status: '?' })
      continue
    }
    const indexCode = s.charAt(0)
    const wtCode = s.charAt(1)
    if (indexCode !== ' ' && indexCode !== '?') {
      staged.push({ ...entry, status: indexCode })
    }
    if (wtCode !== ' ' && wtCode !== '?') {
      unstaged.push({ ...entry, status: wtCode })
    }
  }
  return { staged, unstaged }
}

export function GitTab({
  project,
  config,
}: {
  project: Project
  config: BackendConfig | null
}) {
  const [currentBranch, setCurrentBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [files, setFiles] = useState<GitStatusEntry[]>([])
  const [aheadBehind, setAheadBehind] = useState({ ahead: 0, behind: 0 })
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFileStaged, setSelectedFileStaged] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('changes')
  const [activePR, setActivePR] = useState<GitHubPR | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateRepo, setShowCreateRepo] = useState(false)
  const [stashes, setStashes] = useState<StashEntry[]>([])
  const [conflicts, setConflicts] = useState<ConflictStatus>({ in_merge: false, files: [] })

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
      setRemoteBranches(branchData.remotes || [])
      setFiles(statusData?.files || [])
      setAheadBehind(statusData?.branch || { ahead: 0, behind: 0 })
      setCommits(historyData || [])
      const [stashData, conflictData] = await Promise.all([
        gitStashList(config, project.id),
        gitGetConflicts(config, project.id),
      ])
      setStashes(stashData)
      setConflicts(conflictData)
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
      fetchProjectGitDiff(config, project.id, { hash: selectedCommit })
        .then((d) => setDiff(d))
        .catch(() => setDiff(null))
    } else if (selectedFile) {
      fetchProjectGitDiff(config, project.id, { file: selectedFile, staged: selectedFileStaged })
        .then((d) => setDiff(d))
        .catch(() => setDiff(null))
    } else {
      setDiff(null)
    }
  }, [config, project.id, selectedFile, selectedFileStaged, selectedCommit])

  const { staged, unstaged } = classifyFiles(files)

  function handleFileSelect(path: string, isStaged: boolean) {
    setSelectedFile(path)
    setSelectedFileStaged(isStaged)
    setSelectedCommit(null)
  }

  function handleCommitSelect(hash: string) {
    setSelectedCommit(hash)
    setSelectedFile(null)
  }

  async function handleStage(path: string) {
    if (!config) return
    try {
      await gitStage(config, project.id, [path])
      await loadAll()
    } catch (err) {
      console.error('stage failed', err)
    }
  }

  async function handleUnstage(path: string) {
    if (!config) return
    try {
      await gitUnstage(config, project.id, [path])
      await loadAll()
    } catch (err) {
      console.error('unstage failed', err)
    }
  }

  async function handleStageAll() {
    if (!config) return
    try {
      await gitStage(config, project.id, unstaged.map((f) => f.path))
      await loadAll()
    } catch (err) {
      console.error('stage all failed', err)
    }
  }

  async function handleUnstageAll() {
    if (!config) return
    try {
      await gitUnstage(config, project.id, staged.map((f) => f.path))
      await loadAll()
    } catch (err) {
      console.error('unstage all failed', err)
    }
  }

  async function handleCommit(message: string) {
    if (!config) return
    try {
      await gitCommit(config, project.id, message)
      await loadAll()
    } catch (err) {
      console.error('commit failed', err)
    }
  }

  async function handlePush() {
    if (!config) return
    try {
      await gitPush(config, project.id)
      await loadAll()
    } catch (err) {
      console.error('push failed', err)
    }
  }

  async function handlePull() {
    if (!config) return
    try {
      await gitPull(config, project.id)
      await loadAll()
    } catch (err) {
      console.error('pull failed', err)
    }
  }

  const handleFetch = useCallback(async () => {
    if (!config) return
    try {
      await gitFetch(config, project.id)
      loadAll()
    } catch (err) {
      console.error('fetch failed', err)
    }
  }, [config, project.id, loadAll])

  const handleMerge = useCallback(async (branch: string) => {
    if (!config) return
    try {
      await gitMerge(config, project.id, branch)
      loadAll()
    } catch (err) {
      console.error('merge failed', err)
    }
  }, [config, project.id, loadAll])

  const handleDeleteBranch = useCallback(async (branch: string) => {
    if (!config) return
    try {
      await gitDeleteBranch(config, project.id, branch)
      loadAll()
    } catch (err) {
      console.error('delete branch failed', err)
    }
  }, [config, project.id, loadAll])

  const handleCreateRepo = useCallback(async (opts: { name: string; description: string; private: boolean }) => {
    if (!config) return
    await createGitHubRepo(config, project.id, opts)
    setShowCreateRepo(false)
    loadAll()
  }, [config, project.id, loadAll])

  const handleStashApply = useCallback(async (ref: string) => {
    if (!config) return
    try { await gitStashApply(config, project.id, ref); loadAll() }
    catch (err) { console.error('stash apply failed', err) }
  }, [config, project.id, loadAll])

  const handleStashDrop = useCallback(async (ref: string) => {
    if (!config) return
    try { await gitStashDrop(config, project.id, ref); loadAll() }
    catch (err) { console.error('stash drop failed', err) }
  }, [config, project.id, loadAll])

  const handleConflictResolve = useCallback(async (file: string) => {
    if (!config) return
    try { await gitConflictResolve(config, project.id, file); loadAll() }
    catch (err) { console.error('resolve failed', err) }
  }, [config, project.id, loadAll])

  const handleMergeAbort = useCallback(async () => {
    if (!config) return
    try { await gitMergeAbort(config, project.id); loadAll() }
    catch (err) { console.error('merge abort failed', err) }
  }, [config, project.id, loadAll])

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Waiting for backend connection...
      </div>
    )
  }

  const hasGitHub = !!(project.github_owner && project.github_repo)

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Branch bar */}
      <div className="flex items-center border-b border-border/40 shrink-0 bg-card/30">
        <div className="flex-1 min-w-0 overflow-visible">
          <BranchBar
            projectId={project.id}
            config={config}
            currentBranch={currentBranch}
            branches={branches}
            remoteBranches={remoteBranches}
            aheadBehind={aheadBehind}
            onBranchChange={loadAll}
            onPush={handlePush}
            onPull={handlePull}
            onFetch={handleFetch}
            onMerge={handleMerge}
            onDeleteBranch={handleDeleteBranch}
            stashes={stashes}
            onStashApply={handleStashApply}
            onStashDrop={handleStashDrop}
          />
        </div>
        <button
          onClick={loadAll}
          disabled={refreshing}
          className="shrink-0 px-3 py-2.5 text-muted-foreground/40 hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-refresh-spin' : ''} />
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40 shrink-0 bg-card/20">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              activeSubTab === tab.key
                ? 'bg-primary/15 text-primary border border-primary/20'
                : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Changes tab */}
      {activeSubTab === 'changes' && (
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        <ConflictBanner conflicts={conflicts} onResolve={handleConflictResolve} onAbort={handleMergeAbort} />
        <ResizableSplit
          left={
            <div className="flex flex-col h-full">
              <StagingArea
                unstaged={unstaged}
                staged={staged}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onStage={handleStage}
                onUnstage={handleUnstage}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
              />
              <CommitBar
                stagedCount={staged.length}
                aheadCount={aheadBehind.ahead}
                onCommit={handleCommit}
                onPush={handlePush}
              />
            </div>
          }
          right={
            <DiffViewer
              filePath={selectedFile}
              diff={diff}
              mode={diffMode}
              onModeChange={setDiffMode}
            />
          }
        />
        </div>
      )}

      {/* History tab */}
      {activeSubTab === 'history' && (
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-80 shrink-0 border-r border-border/40 overflow-hidden">
            <CommitTimeline
              commits={commits}
              selectedHash={selectedCommit}
              onSelectCommit={handleCommitSelect}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <DiffViewer
              filePath={selectedCommit ? `commit ${selectedCommit.slice(0, 7)}` : null}
              diff={diff}
              mode={diffMode}
              onModeChange={setDiffMode}
            />
          </div>
        </div>
      )}

      {/* GitHub tab */}
      {activeSubTab === 'github' && (
        hasGitHub ? (
          <div className="flex-1 overflow-auto">
            <GitHubPanel
              projectId={project.id}
              config={config}
              githubToken={project.github_token ?? ''}
              onOpenPR={setActivePR}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-muted-foreground text-sm">No GitHub repository connected</p>
              {project.github_token ? (
                <button
                  onClick={() => setShowCreateRepo(true)}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                >
                  Create GitHub Repository
                </button>
              ) : (
                <p className="text-[10px] text-muted-foreground/50">Connect GitHub first to create a repository</p>
              )}
            </div>
          </div>
        )
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

      {showCreateRepo && (
        <CreateRepoDialog
          projectName={project.name}
          onCancel={() => setShowCreateRepo(false)}
          onCreate={handleCreateRepo}
        />
      )}
    </div>
  )
}
