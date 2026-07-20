import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PlacePreview from './PlacePreview'

describe('PlacePreview', () => {
  it('blocks pin creation until the current location is trusted', () => {
    render(
      <PlacePreview
        position={{ lat: 37.5, lng: 127 }}
        kakao={null}
        onCreatePin={vi.fn()}
        onViewCommunity={vi.fn()}
        onClose={vi.fn()}
        creatingPin={false}
        canCreatePin={false}
      />,
    )

    expect(screen.getByRole('button', { name: '위치 확인 후 핀 만들기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '🏘 커뮤니티 보기' })).toBeEnabled()
    expect(screen.getByText('핀을 만들려면 현재 위치 확인이 필요해요.')).toBeInTheDocument()
  })
})
