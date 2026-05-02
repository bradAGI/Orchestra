import { tool } from 'ai'
import { z } from 'zod'
import type { BackendConfig } from '@core/api/client'
import {
  fetchProjectGitHistory,
  fetchProjectGitStatus,
  fetchProjectGitDiff,
  fetchProjectGitBranches,
  gitCheckout,
  gitCreateBranch,
  gitDeleteBranch,
  gitCommit,
  gitPush,
  gitPull,
  gitStage,
  gitUnstage,
  gitMerge,
  gitStash,
  gitStashPop,
} from '@core/api/client'

/**
 * Creates consolidated git tools for Orchestra projects.
 * 6 outcome-oriented tools replacing the previous 15 operation-oriented tools.
 */
export function createGitTools(config: BackendConfig) {
  return {
    git_status: tool({
      description:
        'Get the working tree state for a project: modified, staged, and untracked files. ' +
        'Use when the user asks for git status, what changed, or wants to see uncommitted work. ' +
        'Requires project_id — resolve via find_projects if the user gives a project name. ' +
        'Returns an array of file entries with path and status.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
      }),
      execute: async (params) => {
        const resp = await fetchProjectGitStatus(config, params.project_id)
        return { files: resp.files }
      },
    }),

    git_history: tool({
      description:
        'Get commit history and/or diff for a project. ' +
        'Use when the user asks for git log, commit history, recent changes, or diff. ' +
        'Set include_diff=true to also return the working tree diff. ' +
        'Requires project_id — resolve via find_projects if the user gives a project name. ' +
        'Returns commits (hash, message, author, date) and optionally a diff string.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        limit: z.number().optional().default(20).describe('Max commits to return'),
        include_diff: z.boolean().optional().default(false).describe('Also return working tree diff'),
        diff_commit: z.string().optional().describe('Diff against a specific commit hash instead of working tree'),
      }),
      execute: async (params) => {
        const commits = await fetchProjectGitHistory(config, params.project_id)
        const limited = commits.slice(0, params.limit)
        const result: Record<string, unknown> = { commits: limited, total: commits.length }
        if (params.include_diff || params.diff_commit) {
          const diff = await fetchProjectGitDiff(config, params.project_id, { hash: params.diff_commit })
          result.diff = diff || '(no changes)'
        }
        return result
      },
    }),

    git_branches: tool({
      description:
        'Manage git branches: list, checkout, create, delete, or merge. ' +
        'Use when the user asks about branches, wants to switch, create, delete, or merge one. ' +
        'Requires project_id — resolve via find_projects if the user gives a project name. ' +
        'For action "delete" or "merge": CONFIRM BEFORE CALLING — state what will happen and wait for user confirmation.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        action: z.enum(['list', 'checkout', 'create', 'delete', 'merge']).describe('Branch operation to perform'),
        branch: z.string().optional().describe('Branch name (required for checkout, create, delete, merge)'),
      }),
      execute: async (params) => {
        switch (params.action) {
          case 'list': {
            const result = await fetchProjectGitBranches(config, params.project_id)
            return { current: result.current, branches: result.branches }
          }
          case 'checkout': {
            if (!params.branch) return { error: 'branch name is required for checkout' }
            await gitCheckout(config, params.project_id, params.branch)
            return { success: true, action: 'checkout', branch: params.branch }
          }
          case 'create': {
            if (!params.branch) return { error: 'branch name is required for create' }
            await gitCreateBranch(config, params.project_id, params.branch)
            return { success: true, action: 'create', branch: params.branch }
          }
          case 'delete': {
            if (!params.branch) return { error: 'branch name is required for delete' }
            await gitDeleteBranch(config, params.project_id, params.branch)
            return { success: true, action: 'delete', branch: params.branch }
          }
          case 'merge': {
            if (!params.branch) return { error: 'branch name is required for merge' }
            await gitMerge(config, params.project_id, params.branch)
            return { success: true, action: 'merge', branch: params.branch }
          }
        }
      },
    }),

    git_commit_flow: tool({
      description:
        'Stage files and create a commit in one step. ' +
        'Use when the user asks to commit, stage and commit, or save changes. ' +
        'If files is omitted, only creates the commit (assumes files are already staged). ' +
        'If unstage is provided, those files are unstaged first. ' +
        'Requires project_id — resolve via find_projects if the user gives a project name.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        message: z.string().describe('Commit message'),
        files: z.array(z.string()).optional().describe('Files to stage before committing. Omit to commit already-staged files.'),
        unstage: z.array(z.string()).optional().describe('Files to unstage before committing'),
      }),
      execute: async (params) => {
        if (params.unstage && params.unstage.length > 0) {
          await gitUnstage(config, params.project_id, params.unstage)
        }
        if (params.files && params.files.length > 0) {
          await gitStage(config, params.project_id, params.files)
        }
        await gitCommit(config, params.project_id, params.message)
        return {
          success: true,
          message: params.message,
          staged: params.files || [],
          unstaged: params.unstage || [],
        }
      },
    }),

    git_sync: tool({
      description:
        'Push or pull commits to/from a remote repository. ' +
        'Use when the user asks to push, pull, or sync with remote. ' +
        'Requires project_id — resolve via find_projects if the user gives a project name. ' +
        'For direction "push": CONFIRM BEFORE CALLING — state what will be pushed and wait for user confirmation.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        direction: z.enum(['push', 'pull']).describe('Whether to push or pull'),
        remote: z.string().optional().default('origin').describe('Remote name'),
        branch: z.string().optional().default('main').describe('Branch name'),
      }),
      execute: async (params) => {
        if (params.direction === 'push') {
          await gitPush(config, params.project_id, params.remote, params.branch)
        } else {
          await gitPull(config, params.project_id, params.remote, params.branch)
        }
        return { success: true, direction: params.direction, remote: params.remote, branch: params.branch }
      },
    }),

    git_stash: tool({
      description:
        'Stash or restore uncommitted changes. ' +
        'Use when the user asks to stash, stash pop, shelve, or restore stashed work. ' +
        'Requires project_id — resolve via find_projects if the user gives a project name.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        action: z.enum(['save', 'pop']).default('save').describe('Whether to stash (save) or restore (pop) changes'),
      }),
      execute: async (params) => {
        if (params.action === 'pop') {
          await gitStashPop(config, params.project_id)
        } else {
          await gitStash(config, params.project_id)
        }
        return { success: true, action: params.action }
      },
    }),
  }
}
