import { describe, expect, it } from 'vitest'
import { getDistanceMeters } from './geo'

describe('getDistanceMeters', () => {
  it('returns zero for identical coordinates', () => {
    expect(getDistanceMeters(37.5665, 126.978, 37.5665, 126.978)).toBe(0)
  })

  it('calculates one degree of latitude within a practical tolerance', () => {
    expect(getDistanceMeters(0, 0, 1, 0)).toBeCloseTo(111_195, -1)
  })
})
