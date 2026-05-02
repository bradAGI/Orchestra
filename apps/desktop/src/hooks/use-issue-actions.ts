import { useState } from 'react'
import {
  createIssue,
  deleteIssue,
  fetchIssues,
  fetchProjectGitHubIssues,
  fetchSessionDetail,
  stopIssueSession,
  toDisplayError,
  updateIssue,
  updateProjectGitHubIssue,
  createProjectGitHubIssue,
  type BackendConfig,
  type IssueCreatePayload,
  type IssueUpdatePayload,
} from '@core/api/client'
import type { SessionDetail } from '@core/api/types'
import type { IssueDetailResult } from '@features/issue-detail/types'
import { useAppStore } from '@core/store'

interface UseIssueActionsOpts {
  onRefresh: () => Promise<void>
  executeIssueLookup: (id: string) => Promise<void>
  issueLookupId: string
  setIssueLookupId: (id: string) => void
  setIssueLookupResult: (r: IssueDetailResult | null) => void
  setIssueLookupError: (e: string) => void
  setIssueLookupPending: (p: boolean) => void
  setErrorMessage: (m: string) => void
  setStatusMessage: (m: string) => void
}

interface UseIssueActionsResult {
  handleIssueUpdate: (identifier: string, updates: IssueUpdatePayload) => Promise<void>
  handleStopSession: (identifier: string, provider?: string) => Promise<void>
  handleCreateIssue: (initialState: string) => void
  handleTaskSubmit: (payload: IssueCreatePayload) => Promise<void>
  handleIssueDelete: (identifier: string) => Promise<void>
  handleInspectIssueFromList: (issueIdentifier: string) => Promise<void>
  handleInspectSession: (sessionId: string) => Promise<void>
  sessionLookupResult: SessionDetail | null
  sessionLookupPending: boolean
  sessionLookupError: string
}

/**
 * Encapsulates all issue CRUD, session management, and inspection handlers.
 * Reads store state via useAppStore.getState() to avoid stale closures.
 */
export function useIssueActions(
  config: BackendConfig | null,
  opts: UseIssueActionsOpts,
): UseIssueActionsResult {
  const [sessionLookupResult, setSessionLookupResult] = useState<SessionDetail | null>(null)
  const [sessionLookupPending, setSessionLookupPending] = useState(false)
  const [sessionLookupError, setSessionLookupError] = useState('')

  const handleIssueUpdate = async (identifier: string, updates: IssueUpdatePayload) => {
    if (!config) return
    try {
      // If this is a GitHub backlog issue, promote to local task linked to the SAME GitHub issue
      if (identifier.startsWith('GH-')) {
        const ghIssue = useAppStore.getState().allBoardIssues.find(i =>
          i.identifier === identifier || i.issue_identifier === identifier
        )
        if (ghIssue) {
          const updatesRec = updates as Record<string, unknown>
          const newIssue = await createIssue(config, {
            title: updatesRec.title as string || ghIssue.title || '',
            description: updatesRec.description as string || ghIssue.description || '',
            state: updatesRec.state as string || 'Backlog',
            assignee_id: updatesRec.assignee_id as string || '',
            project_id: ghIssue.project_id || '',
            provider: updatesRec.provider as string || '',
          })
          const ghUrl = ghIssue.url || ''
          if (newIssue?.identifier && ghUrl) {
            await updateIssue(config, newIssue.identifier, { url: ghUrl } as IssueUpdatePayload)
          }
          opts.setStatusMessage(`${identifier} linked to ${newIssue?.identifier || 'local task'}`)
          const updatedIssues = await fetchIssues(config)
          useAppStore.getState().setBoardIssues(updatedIssues)
          await opts.onRefresh()
          if (newIssue?.identifier) {
            opts.setIssueLookupId(newIssue.identifier)
            await opts.executeIssueLookup(newIssue.identifier)
          }
          return
        }
      }

      await updateIssue(config, identifier, updates)

      // If title/description changed and project is GitHub-connected, sync to GitHub
      const updatesRec = updates as Record<string, unknown>
      if (updatesRec.title || updatesRec.description) {
        const issue = useAppStore.getState().allBoardIssues.find(i =>
          i.identifier === identifier || i.issue_identifier === identifier
        )
        if (issue?.project_id && issue.url?.includes('github.com')) {
          const project = useAppStore.getState().projects.find(p => p.id === issue.project_id)
          if (project?.github_token) {
            const ghMatch = issue.url.match(/\/issues\/(\d+)$/)
            if (ghMatch) {
              const ghNumber = parseInt(ghMatch[1], 10)
              try {
                await updateProjectGitHubIssue(config, project.id, ghNumber, {
                  ...(updatesRec.title ? { title: updatesRec.title as string } : {}),
                  ...(updatesRec.description ? { body: updatesRec.description as string } : {}),
                })
              } catch {
                // GitHub sync failed silently — local update still succeeded
              }
            }
          }
        }
      }

      // If state changed, sync open/closed to GitHub
      if (updatesRec.state) {
        const issue = useAppStore.getState().allBoardIssues.find(i =>
          i.identifier === identifier || i.issue_identifier === identifier
        )
        if (issue?.project_id && issue.url?.includes('github.com')) {
          const proj = useAppStore.getState().projects.find(p => p.id === issue.project_id)
          if (proj?.github_token) {
            const ghMatch = issue.url.match(/\/issues\/(\d+)$/)
            if (ghMatch) {
              const ghNumber = parseInt(ghMatch[1], 10)
              const ghState = updatesRec.state === 'Done' ? 'closed' : 'open'
              const previousState = issue.state
              if (updatesRec.state === 'Done' || previousState === 'Done') {
                try {
                  await updateProjectGitHubIssue(config, proj.id, ghNumber, { state: ghState })
                } catch {
                  // GitHub sync failed silently — local update still succeeded
                }
              }
            }
          }
        }
      }

      const updatedIssues = await fetchIssues(config)
      useAppStore.getState().setBoardIssues(updatedIssues)
      await opts.onRefresh()
      await opts.executeIssueLookup(identifier)
    } catch (err) {
      opts.setErrorMessage(`update issue failed: ${toDisplayError(err)}`)
    }
  }

  const handleStopSession = async (identifier: string, provider?: string) => {
    if (!config) return
    try {
      await stopIssueSession(config, identifier, provider)
      await updateIssue(config, identifier, { state: 'Todo' })
      opts.setStatusMessage(`Session for ${identifier} stopped. Task moved to Todo.`)
      const updatedIssues = await fetchIssues(config)
      useAppStore.getState().setBoardIssues(updatedIssues)
      await opts.onRefresh()
      await opts.executeIssueLookup(identifier)
    } catch (err) {
      opts.setErrorMessage(`stop session failed: ${toDisplayError(err)}`)
    }
  }

  const handleCreateIssue = (initialState: string) => {
    useAppStore.getState().openCreateTaskDialog({ state: initialState })
  }

  const handleTaskSubmit = async (payload: IssueCreatePayload) => {
    if (!config) return
    try {
      const localIssue = await createIssue(config, payload)

      // If project is GitHub-connected, also create a GitHub issue and link it
      const project = useAppStore.getState().projects.find(p => p.id === payload.project_id)
      if (project?.github_token && project.github_owner && project.github_repo) {
        try {
          const ghIssue = await createProjectGitHubIssue(config, project.id, {
            title: payload.title,
            body: payload.description || '',
          })
          const issueId = localIssue?.identifier || localIssue?.issue_identifier || ''
          if (issueId && ghIssue.html_url) {
            await updateIssue(config, issueId, { url: ghIssue.html_url } as IssueUpdatePayload)
          }
        } catch {
          // GitHub create failed — local task still exists
        }
      }

      opts.setStatusMessage(`Task "${payload.title}" created.`)

      const updatedIssues = await fetchIssues(config)
      useAppStore.getState().setBoardIssues(updatedIssues)

      if (project?.github_token) {
        try {
          await fetchProjectGitHubIssues(config, project.id, 'open')
        } catch {
          // non-critical
        }
      }

      void opts.onRefresh()
    } catch (err) {
      opts.setErrorMessage(`create task failed: ${toDisplayError(err)}`)
    }
  }

  const handleIssueDelete = async (identifier: string) => {
    if (!config) return

    try {
      // Close the linked GitHub issue before deleting locally
      const issueToClose = useAppStore.getState().allBoardIssues.find(i =>
        i.identifier === identifier || i.issue_identifier === identifier
      )
      if (issueToClose?.project_id && issueToClose.url?.includes('github.com')) {
        const proj = useAppStore.getState().projects.find(p => p.id === issueToClose.project_id)
        if (proj?.github_token) {
          const ghMatch = issueToClose.url.match(/\/issues\/(\d+)$/)
          if (ghMatch) {
            const ghNumber = parseInt(ghMatch[1], 10)
            try {
              await updateProjectGitHubIssue(config, proj.id, ghNumber, { state: 'closed' })
            } catch {
              // GitHub close failed silently — proceed with local delete
            }
          }
        }
      }

      // GH- prefixed issues are virtual (from GitHub sync) — not in local tracker
      if (identifier.startsWith('GH-')) {
        useAppStore.getState().setBoardIssues(
          useAppStore.getState().boardIssues.filter((issue) => {
            const candidate = typeof issue.identifier === 'string' ? issue.identifier : issue.issue_identifier
            return candidate !== identifier
          })
        )
        opts.setStatusMessage(`GitHub issue ${identifier} dismissed from board.`)
      } else {
        await deleteIssue(config, identifier)
        opts.setStatusMessage(`Task ${identifier} deleted.`)
      }

      useAppStore.getState().setBoardIssues(
        useAppStore.getState().boardIssues.filter((issue) => {
          const candidate = typeof issue.identifier === 'string' ? issue.identifier : issue.issue_identifier
          return candidate !== identifier
        })
      )

      // Optimistically remove from snapshot
      const currentSnapshot = useAppStore.getState().snapshot
      if (currentSnapshot) {
        useAppStore.getState().setSnapshot({
          ...currentSnapshot,
          running: currentSnapshot.running.filter(r => r.issue_identifier !== identifier),
          retrying: currentSnapshot.retrying.filter(r => r.issue_identifier !== identifier)
        })
      }

      useAppStore.getState().setOpenTerminals(
        useAppStore.getState().openTerminals.filter((terminal) => terminal.id !== `issue-${identifier}`)
      )

      const updatedIssues = await fetchIssues(config)
      useAppStore.getState().setBoardIssues(updatedIssues)

      void opts.onRefresh()
      if (opts.issueLookupId === identifier) {
        opts.setIssueLookupResult(null)
        opts.setIssueLookupId('')
      }
    } catch (err) {
      opts.setErrorMessage(`delete issue failed: ${toDisplayError(err)}`)
      throw err
    }
  }

  const handleInspectIssueFromList = async (issueIdentifier: string) => {
    opts.setIssueLookupId(issueIdentifier)
    opts.setIssueLookupError('')
    opts.setIssueLookupPending(false)
    useAppStore.getState().setInspectDialogOpen(true)

    // For GitHub backlog issues, populate directly from cached data instead of API
    if (issueIdentifier.startsWith('GH-')) {
      const ghIssue = useAppStore.getState().allBoardIssues.find(i =>
        i.identifier === issueIdentifier ||
        i.issue_identifier === issueIdentifier ||
        i.id === issueIdentifier
      )
      if (ghIssue) {
        const projects = useAppStore.getState().projects
        opts.setIssueLookupResult({
          ...ghIssue,
          project_name: projects.find(p => p.id === ghIssue.project_id)?.name || '',
        } as IssueDetailResult)
        return
      }
    }

    await opts.executeIssueLookup(issueIdentifier)
  }

  const handleInspectSession = async (sessionId: string) => {
    if (!config) return
    useAppStore.getState().setSessionInspectDialogOpen(true)
    setSessionLookupPending(true)
    setSessionLookupError('')
    try {
      const result = await fetchSessionDetail(config, sessionId)
      setSessionLookupResult(result)
    } catch (err) {
      setSessionLookupError(toDisplayError(err))
    } finally {
      setSessionLookupPending(false)
    }
  }

  return {
    handleIssueUpdate,
    handleStopSession,
    handleCreateIssue,
    handleTaskSubmit,
    handleIssueDelete,
    handleInspectIssueFromList,
    handleInspectSession,
    sessionLookupResult,
    sessionLookupPending,
    sessionLookupError,
  }
}
