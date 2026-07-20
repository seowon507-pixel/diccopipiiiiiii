import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CommunityPage from './CommunityPage'

describe('CommunityPage', () => {
  it('offers a recovery action when every category is disabled', () => {
    const onEnableAllCategories = vi.fn()
    render(
      <CommunityPage
        posts={[]}
        userLocation={{ lat: 37.5, lng: 127 }}
        locationStatus="ready"
        activeCategories={new Set()}
        onEnableAllCategories={onEnableAllCategories}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '모든 카테고리 켜기' }))

    expect(onEnableAllCategories).toHaveBeenCalledOnce()
  })
})
