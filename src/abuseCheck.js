import { getDistanceMeters } from './geo'

const STORAGE_KEY = 'woorimadong_last_post'
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000 // 5분
const DUPLICATE_RADIUS_METERS = 50

// 마지막으로 작성/수정한 게시글 정보를 localStorage에서 읽는다.
function getLastPost() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// 게시글 작성/수정 후 마지막 작성 시간/좌표를 localStorage에 저장한다.
export function saveLastPost({ id, lat, lng }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, lat, lng, savedAt: Date.now() }))
  } catch {
    // localStorage를 쓸 수 없는 환경(프라이빗 모드 등)이면 조용히 무시한다.
  }
}

// 같은 사용자가 5분 이내, 반경 50m 이내에 쓴 글이 있으면 그 정보를 반환한다 (없으면 null).
export function findNearbyDuplicate(lat, lng) {
  const last = getLastPost()
  if (!last) return null

  const withinTime = Date.now() - last.savedAt < DUPLICATE_WINDOW_MS
  if (!withinTime) return null

  const distance = getDistanceMeters(lat, lng, last.lat, last.lng)
  if (distance > DUPLICATE_RADIUS_METERS) return null

  return last
}
