import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCATION_STATUS, useUserLocation } from './useUserLocation'

describe('useUserLocation', () => {
  let onSuccess
  let onError
  const clearWatch = vi.fn()

  beforeEach(() => {
    clearWatch.mockClear()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((success, error) => {
          onSuccess = success
          onError = error
          return 17
        }),
        clearWatch,
      },
    })
  })

  it('never treats the display fallback as a trusted write location', () => {
    const { result } = renderHook(() => useUserLocation())

    expect(result.current.displayLocation).toEqual({ lat: 37.5665, lng: 126.978 })
    expect(result.current.trustedLocation).toBeNull()
    expect(result.current.isLocationTrusted).toBe(false)

    act(() => onError({ code: 1 }))

    expect(result.current.locationStatus).toBe(LOCATION_STATUS.DENIED)
    expect(result.current.userLocation).toEqual({ lat: 37.5665, lng: 126.978 })
    expect(result.current.trustedLocation).toBeNull()
  })

  it('promotes only a device fix and clears it after a later location failure', () => {
    const { result } = renderHook(() => useUserLocation())

    act(() => onSuccess({
      coords: { latitude: 37.55, longitude: 126.92, accuracy: 12 },
      timestamp: 1234,
    }))

    expect(result.current.locationStatus).toBe(LOCATION_STATUS.READY)
    expect(result.current.trustedLocation).toMatchObject({ lat: 37.55, lng: 126.92, accuracy: 12 })
    expect(result.current.isLocationTrusted).toBe(true)

    act(() => onError({ code: 3 }))
    expect(result.current.locationStatus).toBe(LOCATION_STATUS.TIMEOUT)
    expect(result.current.trustedLocation).toBeNull()
    expect(result.current.isLocationTrusted).toBe(false)
  })
})
