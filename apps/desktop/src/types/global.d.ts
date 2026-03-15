export { }

type BackendConfig = {
  baseUrl: string
  apiToken: string
}

type BackendProfile = {
  id: string
  name: string
  baseUrl: string
  apiToken: string
}

type BackendProfilesPayload = {
  activeProfileId: string
  profiles: BackendProfile[]
}

declare global {
  // Web Speech API
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string
    readonly message: string
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
    abort(): void
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
    orchestraDesktop: {
      getBackendConfig: () => Promise<BackendConfig>
      setBackendConfig: (nextConfig: BackendConfig) => Promise<BackendConfig>
      getBackendProfiles: () => Promise<BackendProfilesPayload>
      setActiveBackendProfile: (profileId: string) => Promise<BackendConfig>
      saveBackendProfile: (profile: Partial<BackendProfile> & Pick<BackendProfile, 'name' | 'baseUrl' | 'apiToken'> & { makeActive?: boolean }) => Promise<BackendProfilesPayload>
      deleteBackendProfile: (profileId: string) => Promise<BackendProfilesPayload>
      getAgentTokens: () => Promise<Record<string, string>>
      setAgentToken: (name: string, value: string | null) => Promise<void>
      openExternal: (url: string) => Promise<void>
      openPath: (targetPath: string) => Promise<void>
      selectFolder: () => Promise<string | null>
    }
  }
}
