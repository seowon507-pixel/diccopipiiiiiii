import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MenuPage from './MenuPage.jsx'

describe('MenuPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('동네 생활판의 핵심 기능과 전용 기록 버튼을 유지한다', async () => {
    const onOpenQuickPost = vi.fn()

    render(
      <MenuPage
        posts={[]}
        activeCategories={new Set()}
        onToggleCategory={() => {}}
        onSelectPost={() => {}}
        onOpenCreateModal={() => {}}
        onOpenQuickPost={onOpenQuickPost}
        userLocation={{ lat: 37.56, lng: 126.92 }}
      />,
    )

    expect(screen.getByRole('heading', { name: '동네 생활판' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '동네 둘러보기' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '내 정보와 안전' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '지금 이 동네에 기록 남기기' }))

    expect(onOpenQuickPost).toHaveBeenCalledTimes(1)
  })
})
