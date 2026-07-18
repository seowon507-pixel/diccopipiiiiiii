import { describe, expect, it } from 'vitest'
import { getElapsedRatio } from './categories'

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
