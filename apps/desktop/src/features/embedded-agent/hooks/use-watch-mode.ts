import { useState, useEffect, useCallback, useRef } from 'react'
import type { BackendConfig } from '@core/api/client'
import { normalizeEventEnvelope } from '@core/api/client'

export type WatchNotification = {
  id: string
  type: 'completion' | 'failure' | 'retry' | 'stall' | 'info'
  title: string
  message: string
  issueIdentifier?: string
  timestamp: Date
  dismissed: boolean
  actions?: { label: string; action: string; params?: Record<string, unknown> }[]
}

const STORAGE_KEY = 'orchestra-watch-mode'
const DEBOUNCE_MS = 3000

function loadPrefs(): { enabled: boolean; trackTypes: string[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* fallback */ }
  return { enabled: false, trackTypes: ['RUN_SUCCEEDED', 'RUN_FAILED', 'RETRY_SCHEDULED'] }
}

function savePrefs(prefs: { enabled: boolean; trackTypes: string[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch { /* ignore */ }
}

/**
 * Hook that monitors orchestrator SSE events and generates proactive
 * notifications in the agent chat panel.
 */
export function useWatchMode(config: BackendConfig | null, isPanelOpen = false) {
  const [enabled, setEnabled] = useState(() => loadPrefs().enabled)
  const [trackTypes, setTrackTypes] = useState(() => loadPrefs().trackTypes)
  const [notifications, setNotifications] = useState<WatchNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const lastEventRef = useRef<number>(0)

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      savePrefs({ enabled: next, trackTypes })
      return next
    })
  }, [trackTypes])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const dismissAll = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, dismissed: true })))
    setUnreadCount(0)
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  const addNotification = useCallback((notif: Omit<WatchNotification, 'id' | 'timestamp' | 'dismissed'>) => {
    const now = Date.now()
    if (now - lastEventRef.current < DEBOUNCE_MS) return
    lastEventRef.current = now

    const newNotif: WatchNotification = {
      ...notif,
      id: `watch-${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
      dismissed: false,
    }
    setNotifications((prev) => [newNotif, ...prev].slice(0, 50))
    setUnreadCount((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!enabled || !config?.baseUrl || !isPanelOpen) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    const sseUrl = new URL('/api/v1/events', config.baseUrl)
    if (config.apiToken?.trim()) {
      sseUrl.searchParams.set('token', config.apiToken.trim())
    }

    const es = new EventSource(sseUrl.toString())
    eventSourceRef.current = es

    const handleEvent = (eventType: string) => (event: MessageEvent) => {
      if (!trackTypes.includes(eventType)) return

      try {
        const envelope = normalizeEventEnvelope(JSON.parse(event.data), eventType)
        const issueId = (envelope.data.issue_identifier as string) || (envelope.data.issue_id as string) || ''

        switch (eventType) {
          case 'RUN_SUCCEEDED':
            addNotification({
              type: 'completion',
              title: `${issueId} completed`,
              message: `Agent finished working on ${issueId}. Want to review the diff?`,
              issueIdentifier: issueId,
              actions: [
                { label: 'Review diff', action: 'review_diff', params: { identifier: issueId } },
                { label: 'View issue', action: 'view_issue', params: { identifier: issueId } },
              ],
            })
            break

          case 'RUN_FAILED':
            addNotification({
              type: 'failure',
              title: `${issueId} failed`,
              message: `Agent session failed on ${issueId}: ${(envelope.data.error as string) || 'unknown error'}`,
              issueIdentifier: issueId,
              actions: [
                { label: 'View logs', action: 'view_logs', params: { identifier: issueId } },
                { label: 'Retry', action: 'retry_issue', params: { identifier: issueId } },
              ],
            })
            break

          case 'RETRY_SCHEDULED':
            addNotification({
              type: 'retry',
              title: `${issueId} retrying`,
              message: `Retry #${(envelope.data.attempt as number) || '?'} scheduled for ${issueId}`,
              issueIdentifier: issueId,
              actions: [
                { label: 'View issue', action: 'view_issue', params: { identifier: issueId } },
                { label: 'Stop', action: 'stop_session', params: { identifier: issueId } },
              ],
            })
            break

          case 'RUN_STARTED':
            addNotification({
              type: 'info',
              title: `${issueId} started`,
              message: `Agent started working on ${issueId}`,
              issueIdentifier: issueId,
            })
            break

          default:
            addNotification({
              type: 'info',
              title: `Event: ${eventType}`,
              message: `${eventType} on ${issueId}`,
              issueIdentifier: issueId,
            })
        }
      } catch {
        // Ignore parse errors
      }
    }

    const eventTypes = ['RUN_SUCCEEDED', 'RUN_FAILED', 'RETRY_SCHEDULED', 'RUN_STARTED', 'RUN_EVENT']
    for (const eventType of eventTypes) {
      es.addEventListener(eventType, handleEvent(eventType) as EventListener)
    }

    es.onerror = () => {
      // Silent reconnect — EventSource handles it automatically
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [enabled, config, isPanelOpen, trackTypes, addNotification])

  return {
    enabled,
    toggle,
    notifications,
    unreadCount,
    dismiss,
    dismissAll,
    clearNotifications,
    trackTypes,
    setTrackTypes: (types: string[]) => {
      setTrackTypes(types)
      savePrefs({ enabled, trackTypes: types })
    },
  }
}
