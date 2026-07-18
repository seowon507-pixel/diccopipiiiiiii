import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findNearbyDuplicate, saveLastPost } from './abuseCheck'

describe('duplicate post guard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps multiple recent locations so A-B-A cannot bypass the guard', () => {
    saveLastPost({ id: 'a', lat: 37.5665, lng: 126.978 })
    saveLastPost({ id: 'b', lat: 37.5765, lng: 126.978 })
    expect(findNearbyDuplicate(37.5665, 126.978)?.id).toBe('a')
  })

  it('stops matching at exactly five minutes', () => {
    saveLastPost({ id: 'a', lat: 37.5665, lng: 126.978 })
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(findNearbyDuplicate(37.5665, 126.978)).toBeNull()
  })
})
