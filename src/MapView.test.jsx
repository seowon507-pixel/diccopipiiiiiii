import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { deleteExpiredPins, getPins, subscribeToPinChanges } from './supabaseClient'
import MapView from './MapView'

vi.mock('./supabaseClient', () => ({
  backendConfigurationError: null,
  createPin: vi.fn(),
  deleteExpiredPins: vi.fn().mockResolvedValue([]),
  deletePin: vi.fn(),
  getPins: vi.fn().mockResolvedValue([]),
  subscribeToPinChanges: vi.fn(() => () => {}),
}))

describe('MapView location lifecycle', () => {
  it('keeps the map DOM mounted while location is being checked', () => {
    const { container } = render(
      <MapView
        userLocation={{ lat: 37.5665, lng: 126.978 }}
        locationLoading
        nearbyPosts={[]}
        activePosts={[]}
        activeCategories={new Set()}
        onToggleCategory={vi.fn()}
        onSelectPost={vi.fn()}
        onOpenCreateModal={vi.fn()}
      />,
    )

    expect(screen.getByText('위치 확인 중...')).toBeInTheDocument()
    expect(container.querySelector('.map-view-shell')).toBeInTheDocument()
    expect(container.querySelector('.map-container, .map-placeholder')).toBeInTheDocument()
  })

  it('pauses pin cleanup, loading, and realtime subscriptions while hidden', async () => {
    const unsubscribe = vi.fn()
    subscribeToPinChanges.mockReturnValueOnce(unsubscribe)
    const props = {
      userLocation: { lat: 37.5665, lng: 126.978 },
      nearbyPosts: [],
      activePosts: [],
      activeCategories: new Set(),
      onToggleCategory: vi.fn(),
      onSelectPost: vi.fn(),
      onOpenCreateModal: vi.fn(),
    }
    const { rerender } = render(<MapView {...props} active={false} />)

    expect(deleteExpiredPins).not.toHaveBeenCalled()
    expect(getPins).not.toHaveBeenCalled()
    expect(subscribeToPinChanges).not.toHaveBeenCalled()

    rerender(<MapView {...props} active />)
    await waitFor(() => expect(getPins).toHaveBeenCalledOnce())
    expect(deleteExpiredPins).toHaveBeenCalledOnce()
    expect(subscribeToPinChanges).toHaveBeenCalledOnce()

    rerender(<MapView {...props} active={false} />)
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
