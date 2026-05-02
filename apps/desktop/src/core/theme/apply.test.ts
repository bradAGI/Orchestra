import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, clearAppliedTheme } from './apply'
import { BUILTIN_THEMES } from './defaults'
import type { Theme } from './types'

describe('applyTheme', () => {
  beforeEach(() => {
    clearAppliedTheme()
    document.documentElement.className = ''
  })

  it('applies backward-compatible Theme Studio vars for built-in themes', () => {
    applyTheme(BUILTIN_THEMES[0], 'dark')
    const root = document.documentElement

    expect(root.style.getPropertyValue('--app-font-sans')).toContain('IBM Plex Sans')
    expect(root.style.getPropertyValue('--app-radius-lg')).toBe('0.75rem')
    expect(root.style.getPropertyValue('--app-motion-duration-base')).toBe('250ms')
    expect(root.dataset.theme).toBe(BUILTIN_THEMES[0].id)
    expect(root.dataset.themeDensity).toBe('cozy')
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('hydrates legacy custom themes before applying runtime vars', () => {
    const legacy: Theme = {
      id: 'legacy',
      name: 'Legacy',
      builtin: false,
      mode: 'light',
      roles: BUILTIN_THEMES[0].roles,
    }

    applyTheme(legacy)
    const root = document.documentElement

    expect(root.style.getPropertyValue('--app-control-height-md')).toBe('36px')
    expect(root.style.getPropertyValue('--app-shadow-surface')).toContain('0 8px 24px')
    expect(root.style.getPropertyValue('--chart-3')).not.toBe('')
  })

  it('clears theme studio vars and metadata', () => {
    applyTheme(BUILTIN_THEMES[0], 'dark')
    clearAppliedTheme()
    const root = document.documentElement

    expect(root.style.getPropertyValue('--app-font-sans')).toBe('')
    expect(root.style.getPropertyValue('--app-shadow-surface')).toBe('')
    expect(root.dataset.theme).toBeUndefined()
    expect(root.dataset.themeMotion).toBeUndefined()
  })
})
