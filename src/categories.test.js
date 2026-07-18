import { describe, expect, it } from 'vitest'
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_LABEL_COLORS,
  CATEGORY_ON_COLOR_TEXT,
  getElapsedRatio,
} from './categories'

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255)
  const [red, green, blue] = channels.map((value) => (
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

describe('getElapsedRatio', () => {
  const now = Date.parse('2026-07-18T00:00:00Z')

  it('expires a realtime post exactly at its category boundary', () => {
    expect(getElapsedRatio({ category: '웨이팅', created_at: '2026-07-17T23:30:00Z' }, now)).toBe(1)
  })

  it('never expires a free category', () => {
    expect(getElapsedRatio({ category: '일상', created_at: '2000-01-01T00:00:00Z' }, now)).toBe(0)
  })

  it('rejects invalid and far-future timestamps', () => {
    expect(getElapsedRatio({ category: '웨이팅', created_at: 'invalid' }, now)).toBe(Number.POSITIVE_INFINITY)
    expect(getElapsedRatio({ category: '웨이팅', created_at: '2027-01-01T00:00:00Z' }, now)).toBe(Number.POSITIVE_INFINITY)
    expect(getElapsedRatio({ category: '일상', created_at: 'invalid' }, now)).toBe(Number.POSITIVE_INFINITY)
    expect(getElapsedRatio({ category: '일상', created_at: '2027-01-01T00:00:00Z' }, now)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('category color accessibility', () => {
  it('keeps filled category chips at WCAG AA text contrast', () => {
    CATEGORIES.forEach((category) => {
      expect(contrastRatio(CATEGORY_COLORS[category], CATEGORY_ON_COLOR_TEXT[category])).toBeGreaterThanOrEqual(4.5)
    })
  })

  it('keeps category labels readable on white cards', () => {
    CATEGORIES.forEach((category) => {
      expect(contrastRatio(CATEGORY_LABEL_COLORS[category], '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    })
  })
})
