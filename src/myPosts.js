// 내가 이 브라우저에서 작성한 게시글/핀의 소유권 비밀 토큰을 localStorage에 보관한다.
// 서버(Supabase)는 이 토큰이 post_owners/pin_owners 테이블의 값과 일치할 때만 삭제를 허용한다.
const POST_STORAGE_KEY = 'woorimadong_my_posts'
const PIN_STORAGE_KEY = 'woorimadong_my_pins'
const ACTOR_STORAGE_KEY = 'woorimadong_actor_token'

let inMemoryActorToken = null

function readMap(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeMap(storageKey, map) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

// 게시글 작성 직후 소유권 토큰을 기록한다.
export function saveOwnership(postId, ownerSecret) {
  const map = readMap(POST_STORAGE_KEY)
  map[postId] = ownerSecret
  return writeMap(POST_STORAGE_KEY, map)
}

// 삭제 성공 후 로컬 기록도 지운다.
export function forgetOwnership(postId) {
  const map = readMap(POST_STORAGE_KEY)
  delete map[postId]
  return writeMap(POST_STORAGE_KEY, map)
}

export function getOwnerSecret(postId) {
  return readMap(POST_STORAGE_KEY)[postId] ?? null
}

export function isMyPost(postId) {
  return getOwnerSecret(postId) != null
}

// 핀 생성 직후 소유권 토큰을 기록한다.
export function savePinOwnership(pinId, ownerSecret) {
  const map = readMap(PIN_STORAGE_KEY)
  map[pinId] = ownerSecret
  return writeMap(PIN_STORAGE_KEY, map)
}

// 핀 삭제/변환(게시글로 전환) 후 로컬 기록도 지운다.
export function forgetPinOwnership(pinId) {
  const map = readMap(PIN_STORAGE_KEY)
  delete map[pinId]
  return writeMap(PIN_STORAGE_KEY, map)
}

export function getPinOwnerSecret(pinId) {
  return readMap(PIN_STORAGE_KEY)[pinId] ?? null
}

export function isMyPin(pinId) {
  return getPinOwnerSecret(pinId) != null
}

// crypto.randomUUID를 못 쓰는 아주 오래된 환경 대비 폴백
function generateSecureToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function generateOwnerSecret() {
  return generateSecureToken()
}

// Stable anonymous identifier used only for server-side abuse limits and deduplicating reactions.
export function getOrCreateActorToken() {
  if (inMemoryActorToken) return inMemoryActorToken

  try {
    const stored = localStorage.getItem(ACTOR_STORAGE_KEY)
    if (stored && stored.length >= 32) {
      inMemoryActorToken = stored
      return stored
    }
  } catch {
    // Fall back to a token that is stable for the current page session.
  }

  const token = generateSecureToken()
  inMemoryActorToken = token

  try {
    localStorage.setItem(ACTOR_STORAGE_KEY, token)
  } catch {
    // Storage may be unavailable in private or locked-down browsing modes.
  }

  return token
}

// Short alias used by mutation call sites.
export const getActorToken = getOrCreateActorToken

export function forgetActorToken() {
  inMemoryActorToken = null
  try {
    localStorage.removeItem(ACTOR_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
