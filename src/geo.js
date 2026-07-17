// 하버사인 공식으로 두 좌표 사이의 거리(m)를 구한다.
export function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const EARTH_RADIUS_M = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_M * c
}

// 사람이 읽기 좋은 거리 문자열 — 피드 카드의 "거리·시간" 스캔 라인이 쓴다.
export function formatDistanceMeters(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}
