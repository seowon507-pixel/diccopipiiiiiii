// 내가 이 브라우저에서 작성한 게시글의 소유권 비밀 토큰을 localStorage에 보관한다.
// 서버(Supabase)는 이 토큰이 post_owners 테이블의 값과 일치할 때만 삭제를 허용한다.
const STORAGE_KEY = 'woorimadong_my_posts'

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage를 쓸 수 없는 환경이면 조용히 무시한다.
  }
}

// 게시글 작성 직후 소유권 토큰을 기록한다.
export function saveOwnership(postId, ownerSecret) {
  const map = readMap()
  map[postId] = ownerSecret
  writeMap(map)
}

// 삭제 성공 후 로컬 기록도 지운다.
export function forgetOwnership(postId) {
  const map = readMap()
  delete map[postId]
  writeMap(map)
}

export function getOwnerSecret(postId) {
  return readMap()[postId] ?? null
}

export function isMyPost(postId) {
  return getOwnerSecret(postId) != null
}

// crypto.randomUUID를 못 쓰는 아주 오래된 환경 대비 폴백
export function generateOwnerSecret() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
