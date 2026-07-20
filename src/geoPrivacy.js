// 내 현재 위치를 그대로 노출하지 않도록 하는 위치 보호 설정 + 좌표 흐리기.
// "집에서 글을 쓰면 집 좌표가 반경 1km 이웃 전원에게 노출"되는 문제를 막는다.
// 지도에서 직접 찍거나 장소검색으로 고른 위치(사용자가 의도한 공개 위치)에는 적용하지 않고,
// "내 현재 위치에 그냥 올리는 글/채팅"에만 적용한다(App/ChatRoom에서 호출 지점 구분).
// myPosts/notifications와 같은 철학 — 순수 로컬 설정, 서버와 무관.
const LOCATION_PRIVACY_KEY = 'discopipi_location_privacy'

// 무작위 방향으로 이 범위(m) 안에서 좌표를 이동시킨다. 대략 "동네/블록 단위"로 흐려지되,
// 반경 1km 커뮤니티 판정을 벗어날 만큼 크지는 않게.
const MIN_OFFSET_METERS = 80
const MAX_OFFSET_METERS = 200

// 기본값은 ON(개인정보 우선). 저장된 값이 없으면 보호를 켠 것으로 본다.
export function getLocationPrivacy() {
  try {
    const value = localStorage.getItem(LOCATION_PRIVACY_KEY)
    return value === null ? true : value === '1'
  } catch {
    return true
  }
}

export function setLocationPrivacy(enabled) {
  try {
    localStorage.setItem(LOCATION_PRIVACY_KEY, enabled ? '1' : '0')
  } catch {
    // 저장 실패해도 이번 세션 동작에는 지장 없다.
  }
}

// 좌표를 무작위 방향/거리(80~200m)로 이동시킨다. 위도 1도≈111,320m, 경도는 위도에 따라 보정.
export function fuzzLocation({ lat, lng }) {
  const distance = MIN_OFFSET_METERS + Math.random() * (MAX_OFFSET_METERS - MIN_OFFSET_METERS)
  const bearing = Math.random() * 2 * Math.PI
  const dLat = (distance * Math.cos(bearing)) / 111320
  const dLng = (distance * Math.sin(bearing)) / (111320 * Math.cos((lat * Math.PI) / 180))
  return { lat: lat + dLat, lng: lng + dLng }
}

// 보호 설정이 켜져 있을 때만 흐리고, 꺼져 있으면 원본 좌표를 그대로 돌려준다.
export function maybeFuzzLocation(location) {
  return getLocationPrivacy() ? fuzzLocation(location) : location
}
