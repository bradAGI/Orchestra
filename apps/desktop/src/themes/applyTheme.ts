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

/**
 * Write the active theme's CSS vars onto :root and toggle the .dark class so
 * the existing dark-mode-only Tailwind utilities (e.g. `dark:invert`) still
 * fire. Existing Tailwind reads `hsl(var(--background))` etc., so utilities
 * pick up our overrides automatically.
 */
export function applyTheme(theme: Theme, override?: ThemeMode): void {
  try {
    const mode = resolveMode(override ?? theme.mode)
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')

    const vars = rolesToVars(theme.roles[mode])
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v)
    }
    if (theme.charts) {
      const chart = theme.charts[mode]
      chart.forEach((stop, i) => {
        root.style.setProperty(`--chart-${i + 1}`, stop)
      })
    }
    root.dataset.theme = theme.id
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
    ]
    for (const v of remove) root.style.removeProperty(v)
    delete root.dataset.theme
  } catch {
    // DOM not available
  }
}
