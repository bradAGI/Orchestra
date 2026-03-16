const { contextBridge, ipcRenderer, webFrame } = require('electron')

// Normalize zoom to counter system DPI scaling — makes Electron match the browser
ipcRenderer.invoke('orchestra:get-scale-factor').then((scaleFactor) => {
  if (scaleFactor && scaleFactor > 1) {
    webFrame.setZoomFactor(1 / scaleFactor)
  }
}).catch(() => {})

contextBridge.exposeInMainWorld('orchestraDesktop', {
  getBackendConfig: () => ipcRenderer.invoke('orchestra:get-backend-config'),
  setBackendConfig: (nextConfig) => ipcRenderer.invoke('orchestra:set-backend-config', nextConfig),
  getBackendProfiles: () => ipcRenderer.invoke('orchestra:get-backend-profiles'),
  setActiveBackendProfile: (profileId) => ipcRenderer.invoke('orchestra:set-active-backend-profile', profileId),
  saveBackendProfile: (profile) => ipcRenderer.invoke('orchestra:save-backend-profile', profile),
  deleteBackendProfile: (profileId) => ipcRenderer.invoke('orchestra:delete-backend-profile', profileId),
  getAgentTokens: () => ipcRenderer.invoke('orchestra:get-agent-tokens'),
  setAgentToken: (name, value) => ipcRenderer.invoke('orchestra:set-agent-token', { name, value }),
  openExternal: (url) => ipcRenderer.invoke('orchestra:open-external', url),
  openPath: (targetPath) => ipcRenderer.invoke('orchestra:open-path', targetPath),
  selectFolder: () => ipcRenderer.invoke('orchestra:select-folder'),
})
