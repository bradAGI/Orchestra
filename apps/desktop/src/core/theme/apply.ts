import { normalizeTheme } from './defaults'
import type { RoleSet, Theme, ThemeMode } from './types'

/**
 * Resolve which concrete mode (light/dark) a theme renders in. `auto` follows
 * the OS via prefers-color-scheme.
 */
export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'dark'
    }
  }
  return mode
}

/**
 * Map our 12 semantic roles → the 25+ raw CSS vars components actually read.
 * Components stay on `bg-background` / `text-foreground` etc. — they never
 * reach for raw role names.
 */
function rolesToVars(r: RoleSet): Record<string, string> {
  return {
    '--background': r.background,
    '--foreground': r.text,

    '--card': r.surface,
    '--card-foreground': r.text,
    '--secondary': r.surface,
    '--secondary-foreground': r.text,
    '--accent': r.surface,
    '--accent-foreground': r.text,

    '--popover': r.surfaceRaised,
    '--popover-foreground': r.text,

    '--muted': r.surfaceSunken,
    '--muted-foreground': r.textMuted,

    '--border': r.border,
    '--border-strong': r.borderStrong,
    '--input': r.border,

    '--primary': r.accent,
    '--primary-foreground': r.accentForeground,
    '--ring': r.accent,

    '--success': r.success,
    '--warning': r.warning,
    '--destructive': r.error,
    '--destructive-foreground': '0 0% 98%',
  }
}

function themeToVars(theme: Theme): Record<string, string> {
  const normalized = normalizeTheme(theme)
  return {
    '--app-font-sans': normalized.typography.fontSans,
    '--app-font-mono': normalized.typography.fontMono,
    '--app-text-base': `${normalized.typography.baseSizePx}px`,
    '--app-line-height': String(normalized.typography.lineHeight),
    '--app-heading-scale': String(normalized.typography.headingScale),
    '--app-letter-spacing-body': `${normalized.typography.letterSpacing.bodyEm}em`,
    '--app-letter-spacing-heading': `${normalized.typography.letterSpacing.headingEm}em`,
    '--app-letter-spacing-code': `${normalized.typography.letterSpacing.codeEm}em`,
    '--app-font-weight-body': String(normalized.typography.fontWeight.body),
    '--app-font-weight-medium': String(normalized.typography.fontWeight.medium),
    '--app-font-weight-strong': String(normalized.typography.fontWeight.strong),
    '--app-font-weight-heading': String(normalized.typography.fontWeight.heading),
    '--app-font-weight-code': String(normalized.typography.fontWeight.code),
    '--app-spacing-scale': String(normalized.density.spacingScale),
    '--app-control-height-sm': `${normalized.density.controlHeight.sm}px`,
    '--app-control-height-md': `${normalized.density.controlHeight.md}px`,
    '--app-control-height-lg': `${normalized.density.controlHeight.lg}px`,
    '--app-border-width': `${normalized.density.borderWidthPx}px`,
    '--app-radius-sm': `${normalized.radii.smRem}rem`,
    '--app-radius-md': `${normalized.radii.mdRem}rem`,
    '--app-radius-lg': `${normalized.radii.lgRem}rem`,
    '--app-radius-xl': `${normalized.radii.xlRem}rem`,
    '--app-shadow-surface': normalized.shadows.surface,
    '--app-shadow-overlay': normalized.shadows.overlay,
    '--app-motion-scale': String(normalized.motion.scale),
    '--app-motion-duration-fast': `${normalized.motion.durationMs.fast}ms`,
    '--app-motion-duration-base': `${normalized.motion.durationMs.base}ms`,
    '--app-motion-duration-slow': `${normalized.motion.durationMs.slow}ms`,
    '--app-backdrop-blur': `${normalized.motion.backdropBlurPx}px`,
  }
}

/**
 * Write the active theme's CSS vars onto :root and toggle the .dark class so
 * the existing dark-mode-only Tailwind utilities (e.g. `dark:invert`) still
 * fire. Existing Tailwind reads `hsl(var(--background))` etc., so utilities
 * pick up our overrides automatically.
 */
export function applyTheme(theme: Theme, override?: ThemeMode): void {
  try {
    const normalized = normalizeTheme(theme)
    const mode = resolveMode(override ?? normalized.mode)
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')

    const vars = {
      ...rolesToVars(normalized.roles[mode]),
      ...themeToVars(normalized),
    }
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v)
    }
    if (normalized.charts) {
      const chart = normalized.charts[mode]
      chart.forEach((stop, i) => {
        root.style.setProperty(`--chart-${i + 1}`, stop)
      })
    }
    root.dataset.theme = normalized.id
    root.dataset.themeDensity = normalized.density.preset
    root.dataset.themeRadius = normalized.radii.scale
    root.dataset.themeShadow = normalized.shadows.strength
    root.dataset.themeMotion = normalized.motion.reduceMotion ? 'reduce' : 'normal'
  } catch {
    // DOM not available (tests, SSR)
  }
}

/**
 * Clear runtime overrides — restore the defaults from index.css. Useful when
 * resetting to "default theme" after editing.
 */
export function clearAppliedTheme(): void {
  try {
    const root = document.documentElement
    const remove = [
      '--background', '--foreground', '--card', '--card-foreground', '--secondary',
      '--secondary-foreground', '--accent', '--accent-foreground', '--popover',
      '--popover-foreground', '--muted', '--muted-foreground', '--border',
      '--border-strong', '--input', '--primary', '--primary-foreground', '--ring',
      '--success', '--warning', '--destructive', '--destructive-foreground',
      '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
      '--app-font-sans', '--app-font-mono', '--app-text-base', '--app-line-height',
      '--app-heading-scale', '--app-letter-spacing-body', '--app-letter-spacing-heading',
      '--app-letter-spacing-code', '--app-font-weight-body', '--app-font-weight-medium',
      '--app-font-weight-strong', '--app-font-weight-heading', '--app-font-weight-code',
      '--app-spacing-scale', '--app-control-height-sm', '--app-control-height-md',
      '--app-control-height-lg', '--app-border-width', '--app-radius-sm', '--app-radius-md',
      '--app-radius-lg', '--app-radius-xl', '--app-shadow-surface', '--app-shadow-overlay',
      '--app-motion-scale', '--app-motion-duration-fast', '--app-motion-duration-base',
      '--app-motion-duration-slow', '--app-backdrop-blur',
    ]
    for (const v of remove) root.style.removeProperty(v)
    delete root.dataset.theme
    delete root.dataset.themeDensity
    delete root.dataset.themeRadius
    delete root.dataset.themeShadow
    delete root.dataset.themeMotion
  } catch {
    // DOM not available
  }
}
