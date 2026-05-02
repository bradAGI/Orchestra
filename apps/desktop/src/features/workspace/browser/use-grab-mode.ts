import { useState, useCallback } from 'react'
import { GRAB_GUEST_SCRIPT } from './grab-guest-script'

export type GrabPayload = {
  page: { url: string; title: string; viewport: { width: number; height: number } }
  target: { tag: string; selector: string; text: string; html: string; attributes: Record<string, string>; rect: { x: number; y: number; width: number; height: number } }
  accessibility: { role: string; ariaLabel: string; accessibleName: string }
  styles: Record<string, string>
}

export type GrabState = 'idle' | 'armed' | 'captured'

export function useGrabMode() {
  const [grabState, setGrabState] = useState<GrabState>('idle')
  const [lastPayload, setLastPayload] = useState<GrabPayload | null>(null)

  const armGrab = useCallback((webview: any) => {
    if (!webview?.executeJavaScript) return
    setGrabState('armed')
    webview.executeJavaScript(GRAB_GUEST_SCRIPT).catch(() => setGrabState('idle'))
  }, [])

  const handleConsoleMessage = useCallback((event: any) => {
    const message = event.message || event.detail?.message || ''
    if (typeof message === 'string' && message.startsWith('__ORCHESTRA_GRAB__')) {
      try {
        const payload = JSON.parse(message.replace('__ORCHESTRA_GRAB__', ''))
        setLastPayload(payload)
        setGrabState('captured')
      } catch {
        setGrabState('idle')
      }
    }
  }, [])

  const resetGrab = useCallback(() => {
    setGrabState('idle')
    setLastPayload(null)
  }, [])

  return { grabState, lastPayload, armGrab, handleConsoleMessage, resetGrab }
}
