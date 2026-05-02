import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@core/store'
import { BUILTIN_THEMES, DEFAULT_THEME_ID, normalizeTheme } from '@core/theme/defaults'
import type { Theme } from '@core/theme/types'

const initialState = useAppStore.getState()

function resetThemeState() {
  localStorage.removeItem('orchestra.themes.active')
  localStorage.removeItem('orchestra.themes.custom')
  localStorage.removeItem('orchestra.themes.mode')
  useAppStore.setState(
    {
      ...initialState,
      customThemes: [],
      activeThemeId: DEFAULT_THEME_ID,
      modeOverride: 'dark',
    },
    true,
  )
}

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return normalizeTheme({
    ...BUILTIN_THEMES[0],
    id: 'custom-theme',
    name: 'Custom Theme',
    builtin: false,
    ...overrides,
  })
}

beforeEach(() => {
  resetThemeState()
})

describe('theme slice persistence', () => {
  it('saves and activates custom themes', () => {
    const saved = useAppStore.getState().saveCustomTheme(makeTheme(), { activate: true })
    const state = useAppStore.getState()

    expect(saved.builtin).toBe(false)
    expect(state.customThemes).toHaveLength(1)
    expect(state.activeThemeId).toBe(saved.id)
    expect(localStorage.getItem('orchestra.themes.custom')).toContain(saved.id)
  })

  it('duplicates a theme into the custom library', () => {
    useAppStore.getState().saveCustomTheme(makeTheme({ id: 'original-theme' }))
    const duplicate = useAppStore.getState().duplicateTheme('original-theme', { activate: true })
    const state = useAppStore.getState()

    expect(duplicate).not.toBeNull()
    expect(duplicate?.id).not.toBe('original-theme')
    expect(duplicate?.name).toContain('Copy')
    expect(state.customThemes).toHaveLength(2)
    expect(state.activeThemeId).toBe(duplicate?.id)
  })

  it('deletes the active custom theme and falls back safely', () => {
    const saved = useAppStore.getState().saveCustomTheme(makeTheme({ id: 'to-delete' }), { activate: true })
    useAppStore.getState().deleteCustomTheme(saved.id)
    const state = useAppStore.getState()

    expect(state.customThemes).toEqual([])
    expect(state.activeThemeId).toBe(DEFAULT_THEME_ID)
  })
})
