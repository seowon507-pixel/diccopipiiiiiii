import { useCallback, useEffect, useMemo, useState } from 'react'

const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 }
const DEV_LOCATION_OVERRIDE = { lat: 37.5575, lng: 126.9251 }

export const LOCATION_STATUS = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
  ERROR: 'error',
})

function statusForGeolocationError(error) {
  if (error?.code === 1) return LOCATION_STATUS.DENIED
  if (error?.code === 2) return LOCATION_STATUS.UNAVAILABLE
  if (error?.code === 3) return LOCATION_STATUS.TIMEOUT
  return LOCATION_STATUS.ERROR
}

function messageForStatus(status) {
  if (status === LOCATION_STATUS.DENIED) return '위치 권한이 거부되었습니다.'
  if (status === LOCATION_STATUS.UNAVAILABLE) return '현재 위치 신호를 확인할 수 없습니다.'
  if (status === LOCATION_STATUS.TIMEOUT) return '현재 위치 확인 시간이 초과되었습니다.'
  if (status === LOCATION_STATUS.ERROR) return '현재 위치를 확인하지 못했습니다.'
  return null
}

// 지도 탐색용 fallback과 위치 기반 쓰기에 사용할 신뢰 좌표를 분리한다.
export function useUserLocation() {
  const [trustedLocation, setTrustedLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState(LOCATION_STATUS.LOADING)
  const [locationError, setLocationError] = useState(null)
  const [requestGeneration, setRequestGeneration] = useState(0)

  const retryLocation = useCallback(() => {
    setTrustedLocation(null)
    setLocationError(null)
    setLocationStatus(LOCATION_STATUS.LOADING)
    setRequestGeneration((generation) => generation + 1)
  }, [])

  useEffect(() => {
    const useDevelopmentLocation = import.meta.env.DEV
      && import.meta.env.VITE_DEV_LOCATION_OVERRIDE === 'true'

    if (useDevelopmentLocation) {
      setTrustedLocation(DEV_LOCATION_OVERRIDE)
      setLocationStatus(LOCATION_STATUS.READY)
      setLocationError(null)
      return
    }

    if (!navigator.geolocation) {
      setTrustedLocation(null)
      setLocationStatus(LOCATION_STATUS.UNAVAILABLE)
      setLocationError('이 기기에서는 위치 기능을 사용할 수 없습니다.')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setTrustedLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updatedAt: position.timestamp || Date.now(),
        })
        setLocationStatus(LOCATION_STATUS.READY)
        setLocationError(null)
      },
      (error) => {
        const nextStatus = statusForGeolocationError(error)
        setTrustedLocation(null)
        setLocationStatus(nextStatus)
        setLocationError(messageForStatus(nextStatus))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [requestGeneration])

  const displayLocation = useMemo(
    () => trustedLocation
      ? { lat: trustedLocation.lat, lng: trustedLocation.lng }
      : SEOUL_CITY_HALL,
    [trustedLocation],
  )

  const isLocationTrusted = locationStatus === LOCATION_STATUS.READY && Boolean(trustedLocation)

  return {
    displayLocation,
    trustedLocation,
    locationStatus,
    locationError,
    isLocationTrusted,
    retryLocation,
    // 기존 보기 컴포넌트가 fallback 좌표를 계속 사용할 수 있도록 제공하는 호환 필드.
    userLocation: displayLocation,
    locationLoading: locationStatus === LOCATION_STATUS.LOADING,
    locationDenied: locationStatus === LOCATION_STATUS.DENIED,
  }
}
