import { supabase, backendConfigurationError } from './supabaseClient'

// 이메일 인증(OTP) 로그인 + 닉네임(Supabase Auth user_metadata) 상태 관리.
// posts/pins의 익명 owner_secret/device_secret 소유권 시스템(myPosts.js, notifications.js)과는
// 완전히 별개다 — 이건 "앱을 쓰려면 로그인부터"라는 진입 게이트일 뿐이고, 글/핀 삭제 권한
// 확인은 여전히 owner_secret 기반 RPC가 담당한다(건드리지 않음).
const NICKNAME_MIN_LENGTH = 1
const NICKNAME_MAX_LENGTH = 20

function requireAuth() {
  if (!supabase) throw backendConfigurationError
  return supabase.auth
}

// 세션 변화(최초 조회 포함)를 구독한다. onChange(session|null)를 호출하고, 구독 해제 함수를 반환한다.
// Supabase 설정이 안 된 환경(dummy-data 개발 모드)에서는 로그인 게이트 자체가 의미 없으니
// 즉시 null을 알리고 아무것도 구독하지 않는다.
export function subscribeToAuthState(onChange) {
  if (!supabase) {
    queueMicrotask(() => onChange(null))
    return () => {}
  }

  supabase.auth.getSession().then(({ data }) => onChange(data.session ?? null))
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session ?? null)
  })
  return () => listener.subscription.unsubscribe()
}

// 이메일로 인증코드를 보낸다. 계정이 없으면 자동으로 만든다 — 회원가입/로그인을 구분하지 않는
// 단일 플로우다. Supabase 대시보드에서 Email 프로바이더가 켜져 있고 메일 템플릿에 {{ .Token }}가
// 포함돼 있어야 한다(기본 템플릿에 이미 있음).
export async function sendLoginCode(email) {
  const { error } = await requireAuth().signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

// 인증코드를 확인해 로그인을 완료한다. 성공하면 onAuthStateChange가 새 세션을 알려준다.
export async function verifyLoginCode(email, code) {
  const { data, error } = await requireAuth().verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
  return data.session
}

export function getNickname(session) {
  return session?.user?.user_metadata?.nickname ?? null
}

export function isValidNickname(value) {
  const trimmed = value.trim()
  return trimmed.length >= NICKNAME_MIN_LENGTH && trimmed.length <= NICKNAME_MAX_LENGTH
}

// 닉네임을 Supabase Auth user_metadata에 저장한다. 성공하면 onAuthStateChange(USER_UPDATED)가
// 갱신된 세션을 알려준다 — 별도 상태를 이 파일에서 들고 있지 않는다.
export async function saveNickname(nickname) {
  const trimmed = nickname.trim()
  if (!isValidNickname(trimmed)) throw new RangeError('닉네임은 1~20자로 입력해주세요.')

  const { error } = await requireAuth().updateUser({ data: { nickname: trimmed } })
  if (error) throw error
}

export async function signOut() {
  await requireAuth().signOut()
}
