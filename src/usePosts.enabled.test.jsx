import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPostsMock, subscribeMock, unsubscribeMock } = vi.hoisted(() => ({
  getPostsMock: vi.fn(),
  subscribeMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}))

vi.mock('./supabaseClient', () => ({
  getPosts: getPostsMock,
  subscribeToPostChanges: subscribeMock,
}))

import { usePosts } from './usePosts'

describe('usePosts enabled boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPostsMock.mockResolvedValue([])
    subscribeMock.mockReturnValue(unsubscribeMock)
  })

  it('로그인 전에는 게시글 조회와 Realtime 구독을 시작하지 않는다', () => {
    const { result } = renderHook(() => usePosts(null, { enabled: false }))

    expect(result.current.postsStatus).toBe('idle')
    expect(getPostsMock).not.toHaveBeenCalled()
    expect(subscribeMock).not.toHaveBeenCalled()
  })

  it('권한 경계가 열릴 때만 조회와 구독을 시작하고 닫히면 데이터를 지운다', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => usePosts(null, { enabled }),
      { initialProps: { enabled: false } },
    )

    rerender({ enabled: true })
    await waitFor(() => expect(result.current.postsStatus).toBe('ready'))
    expect(getPostsMock).toHaveBeenCalledOnce()
    expect(subscribeMock).toHaveBeenCalledOnce()

    rerender({ enabled: false })
    await waitFor(() => expect(result.current.postsStatus).toBe('idle'))
    expect(result.current.posts).toEqual([])
    expect(unsubscribeMock).toHaveBeenCalledOnce()
  })
})
