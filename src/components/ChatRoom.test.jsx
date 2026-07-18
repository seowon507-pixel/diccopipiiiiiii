import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { watchNearbyChatMessages } from '../supabaseClient'
import ChatRoom, { isChatNearBottom, mergeChatMessages } from './ChatRoom'

vi.mock('../supabaseClient', () => ({
  sendChatMessage: vi.fn(),
  watchNearbyChatMessages: vi.fn(() => () => {}),
}))

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

  it('only sticks to the bottom when the reader is near the latest message', () => {
    expect(isChatNearBottom({ scrollHeight: 1000, scrollTop: 850, clientHeight: 100 })).toBe(true)
    expect(isChatNearBottom({ scrollHeight: 1000, scrollTop: 400, clientHeight: 100 })).toBe(false)
  })

  it('starts polling only while the chat tab is active', async () => {
    const location = { lat: 37.5, lng: 127 }
    const { rerender } = render(
      <ChatRoom active={false} displayLocation={location} trustedLocation={location} locationStatus="ready" />,
    )
    expect(watchNearbyChatMessages).not.toHaveBeenCalled()

    rerender(<ChatRoom active displayLocation={location} trustedLocation={location} locationStatus="ready" />)

    await waitFor(() => expect(watchNearbyChatMessages).toHaveBeenCalledOnce())
  })
})
