import { describe, expect, it } from 'vitest'
import { mergeComments } from './PostDetail'

describe('mergeComments', () => {
  it('deduplicates a mutation response and realtime echo', () => {
    const comment = { id: 'c1', content: 'hello', created_at: '2026-07-18T00:00:00.000Z' }
    const result = mergeComments([comment], [{ ...comment, content: 'hello' }])

    expect(result).toEqual([comment])
  })
})
