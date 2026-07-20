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

// 로그인 직후에는 새로 발급된 access token이 아직 이 탭의 요청에 완전히 반영되기 전에
// 요청이 나가 401을 한 번 맞는 경우가 실제로 있었다(다른 탭과의 refresh token 경쟁 등).
// 그 순간의 401 하나 때문에 "아이디 중복확인이 안 된다"처럼 보이는 걸 막기 위해, 아이디
// 관련 호출 3개는 실패 시 세션을 한 번 강제로 새로고침한 뒤 딱 한 번만 재시도한다.
async function withSessionRefreshRetry(fn) {
  try {
    return await fn()
  } catch (err) {
    console.warn('[auth] 요청 실패, 세션을 새로고침하고 한 번만 재시도합니다', err)
    await supabase.auth.refreshSession()
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

// 아이디 중복확인. is_username_available RPC가 형식 검증까지 서버에서 한 번 더 하므로
// 클라이언트 정규식과 서버 판정이 항상 같은 결론을 낸다(중복 검증 로직을 두 곳에 따로 두지 않음).
export async function checkUsernameAvailable(username) {
  if (!supabase) throw backendConfigurationError

  return withSessionRefreshRetry(async () => {
    const { data, error } = await supabase.rpc('is_username_available', { p_username: username.trim() })
    if (error) throw error
    return Boolean(data)
  })
}

// 중복확인을 통과한 아이디를 실제로 저장한다. 동시에 같은 아이디를 노리는 경쟁 상황은
// set_username RPC 내부의 유니크 인덱스가 최종적으로 막아준다(그 경우 에러가 던져진다).
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
