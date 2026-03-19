import { tool } from 'ai'
import { z } from 'zod'
import type { BackendConfig } from '@/lib/orchestra-client'
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
} from '@/lib/orchestra-client'

/**
 * Creates git operation tools scoped to Orchestra projects.
 * Covers diffs, branches, commit history, and common git workflows.
 */
export function createGitTools(config: BackendConfig) {
  return {
    get_commit_log: tool({
      description: 'Get the git commit history for a project. Returns recent commits with hash, message, author, and date.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        limit: z.number().optional().default(20).describe('Max number of commits to return'),
      }),
      execute: async (params) => {
        const commits = await fetchProjectGitHistory(config, params.project_id)
        const limited = commits.slice(0, params.limit)
        return { commits: limited, total: commits.length }
      },
    }),

    get_git_status: tool({
      description: 'Get the current git status (modified, untracked, staged files) for a project.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
      }),
      execute: async (params) => {
        const entries = await fetchProjectGitStatus(config, params.project_id)
        return { files: entries }
      },
    }),

    get_project_diff: tool({
      description: 'Get the git diff for a project workspace. Optionally diff against a specific commit hash.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        commit_hash: z.string().optional().describe('Optional commit hash to diff against'),
      }),
      execute: async (params) => {
        const diff = await fetchProjectGitDiff(config, params.project_id, params.commit_hash)
        return { diff: diff || '(no changes)' }
      },
    }),

    list_branches: tool({
      description: 'List all git branches for a project and show the current branch.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
      }),
      execute: async (params) => {
        const result = await fetchProjectGitBranches(config, params.project_id)
        return { current: result.current, branches: result.branches }
      },
    }),

    checkout_branch: tool({
      description: 'Check out a git branch in a project workspace.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        branch: z.string().describe('Branch name to check out'),
      }),
      execute: async (params) => {
        await gitCheckout(config, params.project_id, params.branch)
        return { success: true, branch: params.branch }
      },
    }),

    create_branch: tool({
      description: 'Create a new git branch in a project workspace.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        name: z.string().describe('Name of the new branch'),
      }),
      execute: async (params) => {
        await gitCreateBranch(config, params.project_id, params.name)
        return { success: true, branch: params.name }
      },
    }),

    delete_branch: tool({
      description: 'Delete a git branch from a project workspace. Use with caution.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        branch: z.string().describe('Branch name to delete'),
      }),
      execute: async (params) => {
        await gitDeleteBranch(config, params.project_id, params.branch)
        return { success: true, deleted: params.branch }
      },
    }),

    git_commit: tool({
      description: 'Create a git commit in a project workspace with a given message.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        message: z.string().describe('Commit message'),
      }),
      execute: async (params) => {
        await gitCommit(config, params.project_id, params.message)
        return { success: true }
      },
    }),

    git_push: tool({
      description: 'Push commits to a remote git repository.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        remote: z.string().optional().default('origin').describe('Remote name'),
        branch: z.string().optional().default('main').describe('Branch name'),
      }),
      execute: async (params) => {
        await gitPush(config, params.project_id, params.remote, params.branch)
        return { success: true }
      },
    }),

    git_pull: tool({
      description: 'Pull commits from a remote git repository.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        remote: z.string().optional().default('origin').describe('Remote name'),
        branch: z.string().optional().default('main').describe('Branch name'),
      }),
      execute: async (params) => {
        await gitPull(config, params.project_id, params.remote, params.branch)
        return { success: true }
      },
    }),

    git_stage: tool({
      description: 'Stage files for the next git commit.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        files: z.array(z.string()).describe('Array of file paths to stage'),
      }),
      execute: async (params) => {
        await gitStage(config, params.project_id, params.files)
        return { success: true, staged: params.files }
      },
    }),

    git_unstage: tool({
      description: 'Unstage files from the git index.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        files: z.array(z.string()).describe('Array of file paths to unstage'),
      }),
      execute: async (params) => {
        await gitUnstage(config, params.project_id, params.files)
        return { success: true, unstaged: params.files }
      },
    }),

    git_merge: tool({
      description: 'Merge a branch into the current branch.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
        branch: z.string().describe('Branch name to merge'),
      }),
      execute: async (params) => {
        await gitMerge(config, params.project_id, params.branch)
        return { success: true, merged: params.branch }
      },
    }),

    git_stash: tool({
      description: 'Stash uncommitted changes in a project workspace.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
      }),
      execute: async (params) => {
        await gitStash(config, params.project_id)
        return { success: true }
      },
    }),

    git_stash_pop: tool({
      description: 'Pop the most recent stash entry.',
      inputSchema: z.object({
        project_id: z.string().describe('The project UUID'),
      }),
      execute: async (params) => {
        await gitStashPop(config, params.project_id)
        return { success: true }
      },
    }),
  }
}
