import { supabase, backendConfigurationError } from './supabaseClient'

// 로그인(이메일+비밀번호 회원가입/이메일 인증, 인증코드 로그인) 관리. posts/pins의 익명
// owner_secret/device_secret 소유권 시스템(myPosts.js, notifications.js)과는 완전히
// 별개다 — 이건 "앱을 쓰려면 로그인부터"라는 진입 게이트일 뿐이고, 글/핀 삭제 권한
// 확인은 여전히 owner_secret 기반 RPC가 담당한다(건드리지 않음).

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
