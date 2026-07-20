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
export function subscribeToAuthState(onChange, onError) {
  if (!supabase) {
    queueMicrotask(() => onChange(null))
    return () => {}
  }

  let active = true
  let receivedAuthEvent = false
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!active) return
    receivedAuthEvent = true
    onChange(session ?? null)
  })

  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) throw error
      // onAuthStateChange가 더 최신 세션을 먼저 전달했다면 오래된 getSession 결과로
      // 되돌리지 않는다.
      if (active && !receivedAuthEvent) onChange(data.session ?? null)
    })
    .catch((error) => {
      if (!active) return
      // 세션 조회 실패가 영구적인 빈 화면으로 이어지지 않게 로그인 화면으로 복구한다.
      onChange(null)
      onError?.(error)
    })

  return () => {
    active = false
    listener.subscription.unsubscribe()
  }
}

// 회원가입은 이메일+비밀번호로만 한다 — 이메일 인증(확인 링크)을 눌러야 최종 가입이 끝난다.
// Supabase 대시보드의 Authentication > Providers > Email > "Confirm email"이 켜져 있어야
// 링크를 누르기 전까지 세션이 생기지 않는다(기본값이 켜짐).
export async function signUpWithPassword(email, password) {
  const { data, error } = await requireAuth().signUp({
    email,
    password,
    options: { emailRedirectTo: globalThis.location?.origin },
  })
  if (error) throw error
  return data
}

// 기존 계정 로그인 방법 1 — 이메일+비밀번호. 이메일 인증 전이면 서버가 에러를 돌려준다.
export async function signInWithPassword(email, password) {
  const { data, error } = await requireAuth().signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

// 기존 계정 로그인 방법 2 — 이메일 로그인 링크(매직링크). shouldCreateUser를 껐다 — 신규
// 가입은 이메일+비밀번호 경로로만 받고, 이 방법은 이미 가입된 계정의 재로그인 전용이다.
// 6자리 코드가 아니라 링크인 이유: Supabase의 Magic Link 이메일 템플릿은 기본 상태로 이미
// 클릭용 링크(ConfirmationURL)를 보내지만, 코드(Token)는 대시보드에서 템플릿을 직접 수정해야만
// 나온다(이 프로젝트는 아직 수정 안 됨). 기본 템플릿 그대로 동작하는 링크 방식을 쓰면 대시보드
// 설정 없이도 바로 동작한다. emailRedirectTo를 현재 origin으로 명시해 로컬/미리보기/배포
// 도메인 어디서 요청했든 그 자리로 정확히 돌아오게 한다(Supabase 대시보드의 Redirect URLs
// 허용 목록에 해당 도메인이 있어야 한다 — 없으면 기본 Site URL로 대체됨).
export async function sendLoginLink(email) {
  const { error } = await requireAuth().signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut() {
  await requireAuth().signOut()
}

export function isValidUsernameFormat(value) {
  return USERNAME_PATTERN.test(value.trim())
}

function isRetryableAuthError(error) {
  const code = String(error?.code ?? '').toUpperCase()
  const message = String(error?.message ?? '').toLowerCase()
  return Number(error?.status) === 401
    || code === 'PGRST301'
    || code === 'PGRST302'
    || message.includes('authentication required')
    || message.includes('invalid claim: missing sub')
    || (message.includes('jwt') && (message.includes('expired') || message.includes('invalid')))
}

function expiredSessionError(cause) {
  const error = new Error('로그인 세션이 만료되었습니다.')
  error.code = 'AUTH_SESSION_EXPIRED'
  error.cause = cause
  return error
}

// 로그인 직후에는 새 access token이 이 탭의 요청에 반영되기 전에 RPC가 인증 오류를
// 반환할 수 있다. 인증 오류에만 세션을 한 번 새로고침하고, 권한·중복·검증·네트워크
// 오류는 원래 오류를 그대로 전달한다. refreshSession은 실패를 throw하지 않고 error 필드로
// 반환하므로 그 값과 실제 session 존재 여부를 반드시 확인한다.
async function withSessionRefreshRetry(fn) {
  try {
    return await fn()
  } catch (error) {
    if (!isRetryableAuthError(error)) throw error

    console.warn('[auth] 인증 세션을 새로고침하고 요청을 한 번만 재시도합니다')
    const { data, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !data?.session?.access_token) {
      throw expiredSessionError(refreshError ?? error)
    }
    return fn()
  }
}

// 로그인한 사용자 본인의 아이디를 조회한다. profiles에는 본인 행만 읽을 수 있는 RLS
// select 정책이 있어(다른 사용자 아이디는 이 경로로 못 봄), 별도 RPC 없이 직접 쿼리한다.
export async function fetchMyUsername(userId) {
  if (!supabase) throw backendConfigurationError

  return withSessionRefreshRetry(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data?.username ?? null
  })
}

// 아이디를 저장한다 — 미리 중복확인을 받지 않고 바로 시도하고, 이미 있으면 그때 에러로
// 알려준다(한 단계 줄임). 동시에 같은 아이디를 노리는 경쟁 상황은 set_username RPC 내부의
// 유니크 인덱스가 최종적으로 막아준다.
export async function saveUsername(username) {
  if (!supabase) throw backendConfigurationError

  const trimmed = username.trim()
  if (!isValidUsernameFormat(trimmed)) throw new RangeError('아이디는 영문/숫자/밑줄 2~20자로 입력해주세요.')

  return withSessionRefreshRetry(async () => {
    const { data, error } = await supabase.rpc('set_username', { p_username: trimmed })
    if (error) throw error
    return data?.username ?? trimmed
  })
}
