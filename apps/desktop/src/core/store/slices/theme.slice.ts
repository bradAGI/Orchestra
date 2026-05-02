import type { StateCreator } from 'zustand'
import { applyTheme, resolveMode } from '@core/theme/apply'
import { BUILTIN_THEMES, DEFAULT_THEME_ID, findBuiltin, normalizeTheme } from '@core/theme/defaults'
import type { Theme, ThemeMode } from '@core/theme/types'
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
  const raw = readJSON<Theme[]>(CUSTOM_KEY) ?? []
  return raw.map(normalizeTheme)
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
  saveCustomTheme: (theme: Theme, opts?: { activate?: boolean }) => Theme
  duplicateTheme: (themeId: string, opts?: { activate?: boolean }) => Theme | null
  deleteCustomTheme: (themeId: string) => void
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
    const next = normalizeTheme(
      findThemeIn(id, get().customThemes) ?? findBuiltin(id) ?? findBuiltin(DEFAULT_THEME_ID)!,
    )
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

  saveCustomTheme: (theme, opts) => {
    const normalized = normalizeTheme({
      ...theme,
      builtin: false,
      updatedAt: new Date().toISOString(),
      createdAt: theme.createdAt ?? new Date().toISOString(),
    })
    const nextList = upsertTheme(get().customThemes, normalized)
    writeJSON(CUSTOM_KEY, nextList)
    set({ customThemes: nextList })
    if (opts?.activate) {
      get().setActiveTheme(normalized.id)
    } else if (get().activeThemeId === normalized.id) {
      applyTheme(normalized, get().modeOverride)
    }
    return normalized
  },

  duplicateTheme: (themeId, opts) => {
    const base = normalizeTheme(
      findThemeIn(themeId, get().customThemes) ?? findBuiltin(themeId) ?? findBuiltin(DEFAULT_THEME_ID)!,
    )
    const copy = normalizeTheme({
      ...base,
      id: createThemeId(),
      name: `${base.name} Copy`,
      builtin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const nextList = [...get().customThemes, copy]
    writeJSON(CUSTOM_KEY, nextList)
    set({ customThemes: nextList })
    if (opts?.activate) get().setActiveTheme(copy.id)
    return copy
  },

  deleteCustomTheme: (themeId) => {
    const nextList = get().customThemes.filter((theme) => theme.id !== themeId)
    writeJSON(CUSTOM_KEY, nextList)
    set({ customThemes: nextList })
    if (get().activeThemeId === themeId) {
      get().setActiveTheme(DEFAULT_THEME_ID)
    }
  },

  getActiveTheme: () => {
    const { activeThemeId, customThemes } = get()
    return normalizeTheme(
      findThemeIn(activeThemeId, customThemes) ?? findBuiltin(activeThemeId) ?? findBuiltin(DEFAULT_THEME_ID)!,
    )
  },

  reapply: () => {
    const active = get().getActiveTheme()
    applyTheme(active, get().modeOverride)
  },
})

function findThemeIn(id: string, list: Theme[]): Theme | undefined {
  return list.find((t) => t.id === id)
}

function upsertTheme(list: Theme[], theme: Theme): Theme[] {
  const index = list.findIndex((item) => item.id === theme.id)
  if (index === -1) return [...list, theme]
  const next = [...list]
  next[index] = theme
  return next
}

function createThemeId(): string {
  try {
    return `theme-${crypto.randomUUID()}`
  } catch {
    return `theme-${Date.now().toString(36)}`
  }
}
