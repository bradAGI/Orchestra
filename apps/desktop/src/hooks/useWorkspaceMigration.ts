import { useState } from 'react'
import {
  applyWorkspaceMigration,
  fetchWorkspaceMigrationPlan,
  type BackendConfig,
  type WorkspaceMigrationResult,
} from '@/lib/orchestra-client'

type WorkspaceMigrationState = {
  migrationFrom: string
  setMigrationFrom: (from: string) => void
  migrationTo: string
  setMigrationTo: (to: string) => void
  migrationPlan: WorkspaceMigrationResult | null
  setMigrationPlan: (plan: WorkspaceMigrationResult | null) => void
  migrationPending: boolean
  handleMigrationPlan: () => Promise<void>
  handleMigrationApply: () => Promise<void>
}

/**
 * Manages workspace migration state — from/to paths, plan result, and pending flag.
 * Provides handlers for fetching and applying migration plans.
 */
export function useWorkspaceMigration(
  config: BackendConfig | null,
  setStatusMessage: (msg: string) => void,
  setOperatorError: (prefix: string, err: unknown) => void,
): WorkspaceMigrationState {
  const [migrationFrom, setMigrationFrom] = useState('')
  const [migrationTo, setMigrationTo] = useState('')
  const [migrationPlan, setMigrationPlan] = useState<WorkspaceMigrationResult | null>(null)
  const [migrationPending, setMigrationPending] = useState(false)

  const handleMigrationPlan = async () => {
    if (!config) return
    setMigrationPending(true)
    try {
      const plan = await fetchWorkspaceMigrationPlan(config, migrationFrom, migrationTo)
      setMigrationPlan(plan)
      setStatusMessage('Migration plan loaded.')
    } catch (err) {
      setOperatorError('migration plan failed', err)
    } finally {
      setMigrationPending(false)
    }
  }

  const handleMigrationApply = async () => {
    if (!config) return
    setMigrationPending(true)
    try {
      const result = await applyWorkspaceMigration(config, migrationFrom, migrationTo)
      setMigrationPlan(result)
      setStatusMessage('Migration apply request accepted.')
    } catch (err) {
      setOperatorError('migration apply failed', err)
    } finally {
      setMigrationPending(false)
    }
  }

  return {
    migrationFrom, setMigrationFrom,
    migrationTo, setMigrationTo,
    migrationPlan, setMigrationPlan,
    migrationPending,
    handleMigrationPlan,
    handleMigrationApply,
  }
}
