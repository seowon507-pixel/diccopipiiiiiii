import { useEffect, useState } from 'react'

// 위치 권한이 없거나 실패하면 서울시청 좌표로 대체한다.
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 }
// 개발 모드 전용: 시드 데이터가 위치한 동네 중심. 실제 기기 위치와 무관하게 마커를 볼 수 있도록 강제한다.
const DEV_LOCATION_OVERRIDE = { lat: 37.5575, lng: 126.9251 }

// 지도/커뮤니티/채팅 탭이 모두 같은 위치를 공유하도록 App 레벨에서 한 번만 구독한다.
export function useUserLocation() {
  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationDenied, setLocationDenied] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) {
      setUserLocation(DEV_LOCATION_OVERRIDE)
      setLocationLoading(false)
      return
    }

    if (!navigator.geolocation) {
      setUserLocation(SEOUL_CITY_HALL)
      setLocationDenied(true)
      setLocationLoading(false)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationLoading(false)
      },
      () => {
        setUserLocation(SEOUL_CITY_HALL)
        setLocationDenied(true)
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return { userLocation, locationLoading, locationDenied }
}
