import { useEffect, useState } from 'react'
import { toDisplayError, type BackendConfig } from '@/lib/orchestra-client'

type BackendProfile = {
  id: string
  name: string
  baseUrl: string
  apiToken: string
}

type BackendConfigState = {
  config: BackendConfig | null
  setConfig: (config: BackendConfig | null) => void
  loadingConfig: boolean
  savingConfig: boolean
  setSavingConfig: (saving: boolean) => void
  backendProfiles: BackendProfile[]
  setBackendProfiles: (profiles: BackendProfile[]) => void
  activeProfileId: string
  setActiveProfileId: (id: string) => void
  profilesPending: boolean
  setProfilesPending: (pending: boolean) => void
  errorMessage: string
  setErrorMessage: (message: string) => void
}

/**
 * Loads the backend configuration and profiles from the Electron desktop bridge.
 * Handles initial config fetch, profile enumeration, and default profile creation.
 */
export function useBackendConfig(): BackendConfigState {
  const [config, setConfig] = useState<BackendConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [profilesPending, setProfilesPending] = useState(false)
  const [backendProfiles, setBackendProfiles] = useState<BackendProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Load config from desktop bridge on mount
  useEffect(() => {
    let mounted = true
    const desktopBridge = window.orchestraDesktop
    if (!desktopBridge || typeof desktopBridge.getBackendConfig !== 'function') {
      setErrorMessage('desktop bridge unavailable: preload API not found')
      setLoadingConfig(false)
      return () => { mounted = false }
    }

    desktopBridge
      .getBackendConfig()
      .then((value) => {
        if (mounted) setConfig(value)
      })
      .then(async () => {
        if (!mounted || typeof desktopBridge.getBackendProfiles !== 'function') return
        const payload = await desktopBridge.getBackendProfiles()
        if (!mounted) return
        setBackendProfiles(payload.profiles)
        setActiveProfileId(payload.activeProfileId)
      })
      .catch((err: unknown) => {
        if (mounted) setErrorMessage(`config load failed: ${toDisplayError(err)}`)
      })
      .finally(() => {
        if (mounted) setLoadingConfig(false)
      })

    return () => { mounted = false }
  }, [])

  // Create default profile if none exist
  useEffect(() => {
    if (!config || backendProfiles.length > 0) return

    setBackendProfiles([
      { id: 'active', name: 'Active', baseUrl: config.baseUrl, apiToken: config.apiToken },
    ])
    setActiveProfileId('active')
  }, [config, backendProfiles.length])

  return {
    config, setConfig,
    loadingConfig,
    savingConfig, setSavingConfig,
    backendProfiles, setBackendProfiles,
    activeProfileId, setActiveProfileId,
    profilesPending, setProfilesPending,
    errorMessage, setErrorMessage,
  }
}
