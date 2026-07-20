import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PostCard from './PostCard.jsx'

const { reportPostMock } = vi.hoisted(() => ({ reportPostMock: vi.fn() }))

vi.mock('../supabaseClient', () => ({ reportPost: reportPostMock }))

describe('PostCard', () => {
  beforeEach(() => {
    localStorage.clear()
    reportPostMock.mockReset().mockResolvedValue({ report_count: 1, hidden: false })
  })

  it('카드 열기와 신고를 중첩되지 않은 독립 버튼으로 제공한다', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <PostCard
        post={{
          id: 'post-1',
          category: '일상',
          title: '테스트 글',
          content: '본문',
          post_type: 'local',
          likes_count: 0,
          created_at: '2026-07-19T00:00:00.000Z',
        }}
        onClick={onClick}
        now={new Date('2026-07-19T00:01:00.000Z').getTime()}
      />,
    )

    expect(container.querySelector('button button')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /테스트 글/ }))
    expect(onClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '🚩 신고' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(reportPostMock).toHaveBeenCalledTimes(1)
  })
})
