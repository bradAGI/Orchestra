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
  interface Window {
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
      getScaleFactor: () => number
      fs: {
        readDir: (dirPath: string) => Promise<Array<{ name: string; isDirectory: boolean }>>
        readFile: (filePath: string) => Promise<{ content: string; isBinary: boolean; tooLarge?: boolean }>
        writeFile: (filePath: string, content: string) => Promise<void>
        stat: (filePath: string) => Promise<{ isDirectory: boolean; size: number; mtime: number }>
        deletePath: (filePath: string) => Promise<void>
        gitStatus: (worktreePath: string) => Promise<Record<string, string>>
        search: (worktreePath: string, query: string, options?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean; includeGlob?: string; excludeGlob?: string }) => Promise<Array<{ file: string; relativePath: string; matches: Array<{ line: number; text: string }> }>>
      }
    }
  }
}
