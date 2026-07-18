// 첫 실행 온보딩을 봤는지 여부만 localStorage에 보관한다. myPosts/notifications와 같은 철학 —
// 서버와 무관한 순수 로컬 상태이고, 위치 권한 팝업을 앱 가치 설명 이후로 미루기 위한 게이트다.
const ONBOARDED_KEY = 'discopipi_onboarded'

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    // localStorage 접근이 막힌 환경(시크릿 모드 등)에서는 매번 온보딩을 보여준다.
    return false
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1')
  } catch {
    // 저장 실패해도 이번 세션 진행에는 지장 없다(다음 실행에 다시 보일 뿐).
  }
}
