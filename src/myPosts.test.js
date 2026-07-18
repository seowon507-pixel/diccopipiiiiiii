import { describe, expect, it, vi } from 'vitest'
import {
  forgetActorToken,
  forgetOwnership,
  getActorToken,
  getOwnerSecret,
  isMyPost,
  saveOwnership,
} from './myPosts'

describe('post ownership storage', () => {
  it('stores and removes an owner secret', () => {
    expect(saveOwnership('post-1', 'secret-1')).toBe(true)
    expect(getOwnerSecret('post-1')).toBe('secret-1')
    expect(forgetOwnership('post-1')).toBe(true)
    expect(isMyPost('post-1')).toBe(false)
  })

  it('keeps ownership in memory when persistent storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'QuotaExceededError')
    })
    expect(saveOwnership('post-memory', 'secret-memory')).toBe(true)
    expect(getOwnerSecret('post-memory')).toBe('secret-memory')
    spy.mockRestore()
  })

  it('reuses a sufficiently long anonymous actor token', () => {
    forgetActorToken()
    const first = getActorToken()
    const second = getActorToken()

    expect(first).toHaveLength(36)
    expect(second).toBe(first)
  })
})
