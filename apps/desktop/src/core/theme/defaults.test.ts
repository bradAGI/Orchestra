import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, normalizeTheme } from './defaults'
import type { Theme } from './types'

describe('normalizeTheme', () => {
  it('backfills new Theme Studio fields for legacy themes', () => {
    const legacy: Theme = {
      id: 'legacy',
      name: 'Legacy',
      builtin: false,
      mode: 'dark',
      roles: BUILTIN_THEMES[0].roles,
    }

    const normalized = normalizeTheme(legacy)

    expect(normalized.charts?.dark).toHaveLength(5)
    expect(normalized.typography?.fontSans).toContain('IBM Plex Sans')
    expect(normalized.density?.spacingScale).toBe(1)
    expect(normalized.radii?.lgRem).toBe(0.75)
    expect(normalized.shadows?.surface).toContain('0 8px 24px')
    expect(normalized.motion?.durationMs.base).toBe(250)
  })

  it('preserves explicit overrides while filling nested defaults', () => {
    const custom = normalizeTheme({
      id: 'custom',
      name: 'Custom',
      builtin: false,
      mode: 'light',
      roles: BUILTIN_THEMES[0].roles,
      typography: {
        fontSans: 'Geist, sans-serif',
        fontMono: 'Fira Code, monospace',
        baseSizePx: 16,
        lineHeight: 1.6,
        headingScale: 1.333,
        letterSpacing: {
          bodyEm: 0.01,
          headingEm: -0.02,
          codeEm: -0.015,
        },
        fontWeight: {
          body: 400,
          medium: 510,
          strong: 620,
          heading: 720,
          code: 530,
        },
      },
      density: {
        preset: 'comfortable',
        spacingScale: 1.15,
        controlHeight: { sm: 34, md: 40, lg: 48 },
        borderWidthPx: 2,
      },
      motion: {
        scale: 0.85,
        reduceMotion: true,
        backdropBlurPx: 10,
        durationMs: { fast: 80, base: 120, slow: 200 },
      },
    })

    expect(custom.typography?.fontSans).toBe('Geist, sans-serif')
    expect(custom.density?.controlHeight.md).toBe(40)
    expect(custom.radii?.mdRem).toBe(0.5)
    expect(custom.motion?.reduceMotion).toBe(true)
    expect(custom.motion?.durationMs.slow).toBe(200)
  })
})
