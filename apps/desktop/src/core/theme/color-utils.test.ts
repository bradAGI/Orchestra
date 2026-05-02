import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  formatHslTriplet,
  hexToHslTriplet,
  hslTripletToHex,
  parseHslTriplet,
  wcagBadge,
} from './color-utils'

describe('color-utils', () => {
  it('parses and formats HSL triplets', () => {
    expect(parseHslTriplet('161 72% 45%')).toEqual({
      hue: 161,
      saturation: 72,
      lightness: 45,
    })
    expect(formatHslTriplet({ hue: 161.2, saturation: 72.4, lightness: 44.8 })).toBe('161 72% 45%')
  })

  it('converts between HSL triplets and hex', () => {
    expect(hslTripletToHex('0 0% 100%')).toBe('#ffffff')
    expect(hexToHslTriplet('#ffffff')).toBe('0 0% 100%')
    expect(hexToHslTriplet('#0f172a')).not.toBeNull()
  })

  it('calculates contrast ratio and WCAG badges', () => {
    const ratio = contrastRatio('0 0% 100%', '0 0% 0%')
    expect(ratio).toBeGreaterThan(20)
    expect(wcagBadge(ratio)).toBe('AAA')
    expect(wcagBadge(4.8)).toBe('AA')
    expect(wcagBadge(3.2)).toBe('Fail')
  })
})
