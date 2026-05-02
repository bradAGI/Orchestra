import type { RoleSet } from './types'

/**
 * Derive a full RoleSet from a (hue, saturation) seed. Lightness ramps mirror
 * the values in the original `index.css` blocks so output is identical to the
 * default Orchestra theme when called with hue=160, sat=10.
 */
export function deriveRoles(hue: number, saturation: number, mode: 'light' | 'dark'): RoleSet {
  const h = clamp(hue, 0, 360)
  const s = clamp(saturation, 0, 30)
  const HS = `${Math.round(h)} ${s}%`
  const accentHS = `${Math.round((h + 1) % 360)} 72%`

  if (mode === 'dark') {
    return {
      background:       `${HS} 8%`,
      surface:          `${HS} 11%`,
      surfaceRaised:    `${HS} 13%`,
      surfaceSunken:    `${HS} 16%`,
      border:           `${HS} 19%`,
      borderStrong:     `${HS} 26%`,
      text:             `${Math.round(h)} ${Math.min(s * 2, 30)}% 98%`,
      textMuted:        `${Math.round(h)} ${Math.min(s / 2, 8)}% 65%`,
      accent:           `${accentHS} 45%`,
      accentForeground: `${HS} 4%`,
      success:          '161 72% 42%',
      warning:          '38 92% 55%',
      error:            '0 63% 50%',
    }
  }
  return {
    background:       `${Math.round(h + 60) % 360} ${s * 2}% 97%`,
    surface:          `0 0% 100%`,
    surfaceRaised:    `0 0% 100%`,
    surfaceSunken:    `${Math.round(h + 60) % 360} ${s + 4}% 92%`,
    border:           `${Math.round(h + 60) % 360} ${s + 3}% 87%`,
    borderStrong:     `${Math.round(h + 60) % 360} ${s + 5}% 78%`,
    text:             `${Math.round(h + 64) % 360} ${Math.min(s * 5, 50)}% 10%`,
    textMuted:        `${Math.round(h + 60) % 360} ${Math.min(s, 10)}% 40%`,
    accent:           `${Math.round(h + 70) % 360} 44% 56%`,
    accentForeground: `0 0% 100%`,
    success:          '161 72% 38%',
    warning:          '38 92% 50%',
    error:            '0 72% 51%',
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
