import { describe, expect, it } from 'vitest'
import { applyPostEvents, filterMapVisiblePosts, upsertPostInList } from './usePosts'

const basePost = {
  id: 'a',
  category: '일상',
  created_at: '2026-07-18T00:00:00.000Z',
}

describe('post reconciliation helpers', () => {
  it('replays realtime changes received while the snapshot was loading', () => {
    const result = applyPostEvents(
      [basePost],
      [
        { type: 'upsert', post: { ...basePost, title: 'updated' } },
        { type: 'upsert', post: { ...basePost, id: 'b', created_at: '2026-07-18T00:01:00.000Z' } },
        { type: 'delete', post: { id: 'a' } },
      ],
    )

    expect(result.map((post) => post.id)).toEqual(['b'])
  })

  it('deduplicates a local mutation response and its realtime echo', () => {
    const once = upsertPostInList([], basePost)
    const twice = upsertPostInList(once, { ...basePost, title: 'server echo' })

    expect(twice).toHaveLength(1)
    expect(twice[0].title).toBe('server echo')
  })
})

describe('filterMapVisiblePosts', () => {
  const now = Date.parse('2026-07-18T00:00:00.000Z')

  it('rejects invalid and more-than-five-minute future timestamps', () => {
    const posts = [
      { ...basePost, id: 'valid' },
      { ...basePost, id: 'invalid', created_at: 'invalid' },
      { ...basePost, id: 'future', created_at: '2026-07-18T00:05:01.000Z' },
    ]

    expect(filterMapVisiblePosts(posts, now).map((post) => post.id)).toEqual(['valid'])
  })
})
