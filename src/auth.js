import { supabase, backendConfigurationError } from './supabaseClient'

// 로그인(이메일+비밀번호 회원가입/이메일 인증, 인증코드 로그인)과 고유 아이디(profiles.username)
// 관리. posts/pins의 익명 owner_secret/device_secret 소유권 시스템(myPosts.js, notifications.js)과는
// 완전히 별개다 — 이건 "앱을 쓰려면 로그인부터"라는 진입 게이트일 뿐이고, 글/핀 삭제 권한
// 확인은 여전히 owner_secret 기반 RPC가 담당한다(건드리지 않음).
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{2,20}$/

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

// 회원가입은 이메일+비밀번호로만 한다 — 이메일 인증(확인 링크)을 눌러야 최종 가입이 끝난다.
// Supabase 대시보드의 Authentication > Providers > Email > "Confirm email"이 켜져 있어야
// 링크를 누르기 전까지 세션이 생기지 않는다(기본값이 켜짐).
export async function signUpWithPassword(email, password) {
  const { data, error } = await requireAuth().signUp({ email, password })
  if (error) throw error
  return data
}

// 기존 계정 로그인 방법 1 — 이메일+비밀번호. 이메일 인증 전이면 서버가 에러를 돌려준다.
export async function signInWithPassword(email, password) {
  const { data, error } = await requireAuth().signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

// 기존 계정 로그인 방법 2 — 인증코드. shouldCreateUser를 껐다 — 신규 가입은 이메일+비밀번호
// 경로로만 받고, 인증코드 로그인은 이미 가입된 계정의 재로그인 전용이다(가입 확인 이메일 템플릿과
// 인증코드 이메일 템플릿이 뒤섞이지 않게 하기 위함).
export async function sendLoginCode(email) {
  const { error } = await requireAuth().signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) throw error
}

// 인증코드를 확인해 로그인을 완료한다. 성공하면 onAuthStateChange가 새 세션을 알려준다.
export async function verifyLoginCode(email, code) {
  const { data, error } = await requireAuth().verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
  return data.session
}

export async function signOut() {
  await requireAuth().signOut()
}

export function isValidUsernameFormat(value) {
  return USERNAME_PATTERN.test(value.trim())
}

// 로그인한 사용자 본인의 아이디를 조회한다. profiles에는 본인 행만 읽을 수 있는 RLS
// select 정책이 있어(다른 사용자 아이디는 이 경로로 못 봄), 별도 RPC 없이 직접 쿼리한다.
export async function fetchMyUsername(userId) {
  if (!supabase) throw backendConfigurationError

  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.username ?? null
}

// 아이디 중복확인. is_username_available RPC가 형식 검증까지 서버에서 한 번 더 하므로
// 클라이언트 정규식과 서버 판정이 항상 같은 결론을 낸다(중복 검증 로직을 두 곳에 따로 두지 않음).
export async function checkUsernameAvailable(username) {
  if (!supabase) throw backendConfigurationError

  const { data, error } = await supabase.rpc('is_username_available', { p_username: username.trim() })
  if (error) throw error
  return Boolean(data)
}

// 중복확인을 통과한 아이디를 실제로 저장한다. 동시에 같은 아이디를 노리는 경쟁 상황은
// set_username RPC 내부의 유니크 인덱스가 최종적으로 막아준다(그 경우 에러가 던져진다).
export async function saveUsername(username) {
  if (!supabase) throw backendConfigurationError

  const trimmed = username.trim()
  if (!isValidUsernameFormat(trimmed)) throw new RangeError('아이디는 영문/숫자/밑줄 2~20자로 입력해주세요.')

  const { data, error } = await supabase.rpc('set_username', { p_username: trimmed })
  if (error) throw error
  return data?.username ?? trimmed
}
