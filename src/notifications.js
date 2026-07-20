// 로그인 없이 이 브라우저를 식별하는 익명 device_secret + 알림 설정(관심 지역/키워드/조용한 시간)을
// localStorage에 보관한다. myPosts.js의 owner_secret 패턴과 같은 철학 — 서버는 device_secret의
// SHA-256 hash로만 "이 기기"를 식별하고, 원문 값은 로컬에만 있다.
// 이 device_secret은 원래 push_subscriptions 식별 전용이었지만, 24번 단계(익명 소유권 복구)부터는
// post_owners/pin_owners에도 hash+암호화 escrow 형태로 연결된다 — "이 브라우저의 유일한 익명 정체성"이라는
// 의미가 커져서, 복구 코드(RecoveryCode.jsx)도 이 값을 그대로 재사용한다(별도 코드 체계 안 만듦).
import { upsertPushSubscription, deletePushSubscription } from './supabaseClient'

const DEVICE_SECRET_KEY = 'discopipi_notification_device_secret'
const PREFS_KEY = 'discopipi_notification_prefs'
let inMemoryDeviceSecret = null

// "기본 1~2개 관심지역 저장" — 슬롯 개수를 여기서 한 곳으로 관리한다.
export const MAX_INTEREST_AREAS = 2
export const DEFAULT_INTEREST_RADIUS_METERS = 500

const DEFAULT_PREFS = {
  enabled: false,
  interestAreas: [], // [{ id, label, lat, lng, radiusM }]
  keywords: [], // string[]
  quietEnabled: false,
  quietStart: 23,
  quietEnd: 7,
}

export function getOrCreateDeviceSecret() {
  if (inMemoryDeviceSecret) return inMemoryDeviceSecret

  try {
    const stored = localStorage.getItem(DEVICE_SECRET_KEY)
    if (stored && stored.length >= 32) {
      inMemoryDeviceSecret = stored
      return stored
    }
  } catch {
    // Private/locked-down browsers may reject even localStorage reads.
  }

  const secret = crypto.randomUUID()
  inMemoryDeviceSecret = secret
  try {
    localStorage.setItem(DEVICE_SECRET_KEY, secret)
  } catch {
    // Keep a stable identity for this tab even when persistence is unavailable.
  }
  return secret
}

// 익명 소유권 복구(RecoveryCode.jsx)에서 다른 기기의 복구 코드를 입력했을 때, 이 기기가
// 그 정체성을 이어받게 한다 — 이후 이 기기에서 쓰는 글/핀도 같은 device_secret으로 계속
// 묶이도록. 알림 구독 자체를 옮기는 건 아니다(요청받은 범위 밖 — 필요해지면 그때 추가).
export function adoptDeviceSecret(secret) {
  inMemoryDeviceSecret = secret
  try {
    localStorage.setItem(DEVICE_SECRET_KEY, secret)
  } catch {
    // localStorage를 못 쓰면 무시 — 이번 세션에서만 기존 값을 계속 쓰게 된다.
  }
}

export function getNotificationPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function savePrefsLocally(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

async function subscribeAndSync(prefs) {
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) throw new Error('푸시 알림 서버 설정이 아직 완료되지 않았어요.')
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  const subJson = subscription.toJSON()
  await upsertPushSubscription({
    deviceSecret: getOrCreateDeviceSecret(),
    endpoint: subJson.endpoint,
    p256dh: subJson.keys.p256dh,
    auth: subJson.keys.auth,
    interestAreas: prefs.interestAreas.map((area) => ({ lat: area.lat, lng: area.lng, radius_m: area.radiusM })),
    keywords: prefs.keywords,
    quietStart: prefs.quietEnabled ? prefs.quietStart : null,
    quietEnd: prefs.quietEnabled ? prefs.quietEnd : null,
  })
}

// 알림 켜기 — 권한 요청 -> 서비스워커 등록 -> 푸시 구독 생성 -> 서버에 현재 설정과 함께 저장.
export async function enableNotifications(prefs) {
  if (!isPushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않아요.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('알림 권한이 거부됐어요.')

  await subscribeAndSync(prefs)

  const nextPrefs = { ...prefs, enabled: true }
  savePrefsLocally(nextPrefs)
  return nextPrefs
}

// 알림 끄기 — 서버 구독 삭제 + 브라우저 푸시 구독 해지.
export async function disableNotifications(prefs) {
  try {
    await deletePushSubscription(getOrCreateDeviceSecret())
  } catch (err) {
    console.error('[notifications] 서버 구독 삭제 실패', err)
  }

  if (isPushSupported()) {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    const subscription = await registration?.pushManager.getSubscription()
    await subscription?.unsubscribe()
  }

  const nextPrefs = { ...prefs, enabled: false }
  savePrefsLocally(nextPrefs)
  return nextPrefs
}

// 이미 켜져 있는 상태에서 관심지역/키워드/조용한시간만 바꿨을 때 서버 쪽 설정을 다시 동기화한다.
export async function syncNotificationPrefs(prefs) {
  if (!prefs.enabled) {
    savePrefsLocally(prefs)
    return prefs
  }

  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) {
    // 브라우저 쪽에서 구독이 없어졌으면(권한 회수 등) 꺼진 상태로 되돌린다.
    const fallback = { ...prefs, enabled: false }
    savePrefsLocally(fallback)
    return fallback
  }

  await subscribeAndSync(prefs)
  savePrefsLocally(prefs)
  return prefs
}
