import { describe, expect, it } from 'vitest'
import { mergeChatMessages } from './ChatRoom'

describe('mergeChatMessages', () => {
  it('deduplicates polling snapshots and keeps chronological order', () => {
    const result = mergeChatMessages(
      [{ id: 'b', content: 'old', created_at: '2026-07-18T00:02:00.000Z' }],
      [
        { id: 'a', content: 'first', created_at: '2026-07-18T00:01:00.000Z' },
        { id: 'b', content: 'updated', created_at: '2026-07-18T00:02:00.000Z' },
      ],
    )

    expect(result.map((message) => message.id)).toEqual(['a', 'b'])
    expect(result[1].content).toBe('updated')
  })

  it('keeps only the newest 200 messages during a long session', () => {
    const messages = Array.from({ length: 205 }, (_, index) => ({
      id: String(index).padStart(3, '0'),
      created_at: new Date(Date.UTC(2026, 6, 18, 0, index)).toISOString(),
    }))

    const result = mergeChatMessages([], messages)

    expect(result).toHaveLength(200)
    expect(result[0].id).toBe('005')
  })
})
