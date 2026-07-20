import { getDistanceMeters } from './geo'

const STORAGE_KEY = 'woorimadong_last_post'
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000 // 5분
const DUPLICATE_RADIUS_METERS = 50

// 최근 작성/수정 게시글을 localStorage에서 읽는다. 예전 단일 객체 형식도 호환한다.
function getRecentPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

// 게시글 작성/수정 후 최근 작성 시간/좌표를 최대 20건 저장한다.
export function saveLastPost({ id, lat, lng }) {
  try {
    const now = Date.now()
    const recent = getRecentPosts()
      .filter((post) => now - post.savedAt < DUPLICATE_WINDOW_MS)
      .filter((post) => post.id !== id)
    recent.unshift({ id, lat, lng, savedAt: now })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, 20)))
    return true
  } catch {
    return false
  }
}

// 같은 사용자가 5분 이내, 반경 50m 이내에 쓴 글이 있으면 그 정보를 반환한다 (없으면 null).
export function findNearbyDuplicate(lat, lng) {
  const now = Date.now()
  return getRecentPosts().find((post) => {
    const age = now - post.savedAt
    if (age < 0 || age >= DUPLICATE_WINDOW_MS) return false
    return getDistanceMeters(lat, lng, post.lat, post.lng) <= DUPLICATE_RADIUS_METERS
  }) ?? null
}
