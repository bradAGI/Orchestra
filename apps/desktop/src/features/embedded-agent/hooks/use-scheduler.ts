import { useState, useCallback, useRef, useEffect } from 'react'

export type ScheduledItem = {
  id: string
  type: 'reminder' | 'action'
  message?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  delayMinutes: number
  createdAt: Date
  firesAt: Date
  fired: boolean
  cancelled: boolean
}

/**
 * Hook that manages scheduled reminders and deferred tool executions.
 * Timers persist across panel minimize but not app restart (v1).
 */
export function useScheduler(
  onReminder: (message: string) => void,
  onAction: (toolName: string, args: Record<string, unknown>) => void,
) {
  const [items, setItems] = useState<ScheduledItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  const scheduleReminder = useCallback((message: string, delayMinutes: number) => {
    const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const now = new Date()
    const firesAt = new Date(now.getTime() + delayMinutes * 60_000)

    const item: ScheduledItem = {
      id,
      type: 'reminder',
      message,
      delayMinutes,
      createdAt: now,
      firesAt,
      fired: false,
      cancelled: false,
    }

    setItems((prev) => [...prev, item])

    const timer = setTimeout(() => {
      onReminder(message)
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, fired: true } : i)))
      timersRef.current.delete(id)
    }, delayMinutes * 60_000)

    timersRef.current.set(id, timer)
    return id
  }, [onReminder])

  const scheduleAction = useCallback((toolName: string, args: Record<string, unknown>, delayMinutes: number) => {
    const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const now = new Date()
    const firesAt = new Date(now.getTime() + delayMinutes * 60_000)

    const item: ScheduledItem = {
      id,
      type: 'action',
      toolName,
      toolArgs: args,
      delayMinutes,
      createdAt: now,
      firesAt,
      fired: false,
      cancelled: false,
    }

    setItems((prev) => [...prev, item])

    const timer = setTimeout(() => {
      onAction(toolName, args)
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, fired: true } : i)))
      timersRef.current.delete(id)
    }, delayMinutes * 60_000)

    timersRef.current.set(id, timer)
    return id
  }, [onAction])

  const cancel = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, cancelled: true } : i)))
  }, [])

  const activeItems = items.filter((i) => !i.fired && !i.cancelled)
  const completedItems = items.filter((i) => i.fired || i.cancelled)

  return {
    items,
    activeItems,
    completedItems,
    scheduleReminder,
    scheduleAction,
    cancel,
  }
}
