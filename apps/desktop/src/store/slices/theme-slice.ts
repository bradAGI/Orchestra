import type { StateCreator } from 'zustand'
import { applyTheme, resolveMode } from '@/themes/applyTheme'
import { BUILTIN_THEMES, DEFAULT_THEME_ID, findBuiltin } from '@/themes/defaults'
import type { Theme, ThemeMode } from '@/themes/types'
import type { AppState } from '../types'

const ACTIVE_KEY = 'orchestra.themes.active'
const CUSTOM_KEY = 'orchestra.themes.custom'
const MODE_KEY = 'orchestra.themes.mode'

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function getInitialActiveId(): string {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (raw) return raw
  } catch { /* ignore */ }
  return DEFAULT_THEME_ID
}

function getInitialMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(MODE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw
    // Migrate from the legacy `orchestra-theme` key if present.
    const legacy = localStorage.getItem('orchestra-theme')
    if (legacy === 'light' || legacy === 'dark') return legacy
  } catch { /* ignore */ }
  return 'dark'
}

function getInitialCustom(): Theme[] {
  return readJSON<Theme[]>(CUSTOM_KEY) ?? []
}

export type ThemeSlice = {
  /** Theme list — built-ins followed by user themes. */
  builtinThemes: Theme[]
  customThemes: Theme[]
  /** Currently applied theme id (built-in id or custom uuid). */
  activeThemeId: string
  /** Mode override — when set, takes precedence over the theme's own mode. */
  modeOverride: ThemeMode

  setActiveTheme: (id: string) => void
  setMode: (mode: ThemeMode) => void
  /** Get the currently active theme object. */
  getActiveTheme: () => Theme
  /** Re-apply the current theme (e.g. after a custom-theme edit). */
  reapply: () => void
}

export const createThemeSlice: StateCreator<AppState, [], [], ThemeSlice> = (set, get) => ({
  builtinThemes: BUILTIN_THEMES,
  customThemes: getInitialCustom(),
  activeThemeId: getInitialActiveId(),
  modeOverride: getInitialMode(),

  setActiveTheme: (id) => {
    const next = findThemeIn(id, get().customThemes) ?? findBuiltin(id) ?? findBuiltin(DEFAULT_THEME_ID)!
    writeJSON(ACTIVE_KEY, id)
    try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* ignore */ }
    applyTheme(next, get().modeOverride)
    set({ activeThemeId: id })
  },

  setMode: (mode) => {
    try { localStorage.setItem(MODE_KEY, mode) } catch { /* ignore */ }
    // Keep the legacy key in sync so anything still reading it gets the right
    // value when `auto` resolves.
    try {
      if (mode !== 'auto') localStorage.setItem('orchestra-theme', mode)
      else {
        const resolved = resolveMode('auto')
        localStorage.setItem('orchestra-theme', resolved)
      }
    } catch { /* ignore */ }
    set({ modeOverride: mode })
    const active = get().getActiveTheme()
    applyTheme(active, mode)
  },

  getActiveTheme: () => {
    const { activeThemeId, customThemes } = get()
    return findThemeIn(activeThemeId, customThemes) ?? findBuiltin(activeThemeId) ?? findBuiltin(DEFAULT_THEME_ID)!
  },

  reapply: () => {
    const active = get().getActiveTheme()
    applyTheme(active, get().modeOverride)
  },
})

function findThemeIn(id: string, list: Theme[]): Theme | undefined {
  return list.find((t) => t.id === id)
}
