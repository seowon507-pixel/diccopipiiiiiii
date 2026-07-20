import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'

describe('TabBar', () => {
  it('현재 탭을 접근성 상태로 표시한다', () => {
    render(<TabBar activeTab="community" onChange={() => {}} />)

    expect(screen.getByRole('button', { name: '동네생활 탭' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '지도 탭' })).not.toHaveAttribute('aria-current')
  })

  it('아이콘 내부를 눌러도 요청한 탭으로 이동한다', async () => {
    const onChange = vi.fn()
    render(<TabBar activeTab="map" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: '메뉴 탭' }))

    expect(onChange).toHaveBeenCalledWith('menu')
  })
})
