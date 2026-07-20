import { useState } from 'react'
import {
  signUpWithPassword,
  signInWithPassword,
  sendLoginLink,
} from '../auth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

function handleTabKeyDown(event, values, currentValue, onSelect) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()

  const currentIndex = Math.max(0, values.indexOf(currentValue))
  let nextIndex = currentIndex
  if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + values.length) % values.length
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % values.length
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = values.length - 1

  const nextValue = values[nextIndex]
  onSelect(nextValue)
  event.currentTarget.parentElement
    ?.querySelector(`[data-tab-value="${nextValue}"]`)
    ?.focus()
}

// 앱 시작 시 온보딩보다 먼저 뜨는 로그인 게이트. session이 없으면: 회원가입(이메일+비밀번호,
// 이메일 인증 필요)과 로그인(비밀번호 또는 이메일 링크, 둘 다 이미 가입된 계정 전용) 중 고르는
// 화면을 보여준다. 로그인 성공 이후의 상태 갱신은 App.jsx가 처리하므로(세션 구독), 여기서는
// 그 결과로 다시 그려지는 것만 기다리면 된다(이메일 링크를 눌러 새 탭이 열리면 그 탭에서 세션이
// 생기고, 원래 탭은 onAuthStateChange로 뒤늦게 알게 된다).
function AuthGate({ statusError = null }) {
  const [tab, setTab] = useState('signup') // 'signup' | 'login'
  const [loginMethod, setLoginMethod] = useState('password') // 'password' | 'link'
  const [linkSent, setLinkSent] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [signedUp, setSignedUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function resetFeedback() {
    setError(null)
  }

  async function handleSignUp(event) {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail) || password.length < MIN_PASSWORD_LENGTH || submitting) return
    if (password !== passwordConfirm) {
      setError('비밀번호가 서로 달라요.')
      return
    }

    setSubmitting(true)
    resetFeedback()
    try {
      await signUpWithPassword(trimmedEmail, password)
      setSignedUp(true)
    } catch (err) {
      console.error('[AuthGate] 회원가입 실패', err)
      setError(err?.message?.includes('already registered')
        ? '이미 가입된 이메일이에요. 로그인 탭을 이용해주세요.'
        : '회원가입에 실패했어요. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordLogin(event) {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail) || !password || submitting) return

    setSubmitting(true)
    resetFeedback()
    try {
      await signInWithPassword(trimmedEmail, password)
    } catch (err) {
      console.error('[AuthGate] 비밀번호 로그인 실패', err)
      setError(err?.message?.includes('Email not confirmed')
        ? '이메일 인증을 먼저 완료해주세요. 가입할 때 받은 메일의 링크를 눌러주세요.'
        : '이메일 또는 비밀번호가 올바르지 않아요.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSendLink(event) {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail) || submitting) return

    setSubmitting(true)
    resetFeedback()
    try {
      await sendLoginLink(trimmedEmail)
      setEmail(trimmedEmail)
      setLinkSent(true)
    } catch (err) {
      console.error('[AuthGate] 로그인 링크 발송 실패', err)
      setError(err?.message?.includes('Signups not allowed')
        ? '아직 가입되지 않은 이메일이에요. 회원가입 탭을 이용해주세요.'
        : '로그인 링크를 보내지 못했어요. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-gate">
      <div className="auth-gate-body">
        <span className="auth-gate-logo" aria-hidden="true">📍</span>
        <h1 className="auth-gate-title">우리동네알림</h1>
        {statusError && <p className="auth-gate-error" role="alert">{statusError}</p>}

        <div className="auth-gate-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            id="auth-tab-signup"
            aria-controls="auth-panel-signup"
            aria-selected={tab === 'signup'}
            tabIndex={tab === 'signup' ? 0 : -1}
            data-tab-value="signup"
            className="auth-gate-tab"
            onClick={() => { setTab('signup'); resetFeedback(); setSignedUp(false) }}
            onKeyDown={(event) => handleTabKeyDown(event, ['signup', 'login'], tab, (value) => {
              setTab(value)
              resetFeedback()
              if (value === 'signup') setSignedUp(false)
            })}
          >
            회원가입
          </button>
          <button
            type="button"
            role="tab"
            id="auth-tab-login"
            aria-controls="auth-panel-login"
            aria-selected={tab === 'login'}
            tabIndex={tab === 'login' ? 0 : -1}
            data-tab-value="login"
            className="auth-gate-tab"
            onClick={() => { setTab('login'); resetFeedback() }}
            onKeyDown={(event) => handleTabKeyDown(event, ['signup', 'login'], tab, (value) => {
              setTab(value)
              resetFeedback()
              if (value === 'signup') setSignedUp(false)
            })}
          >
            로그인
          </button>
        </div>

        {tab === 'signup' && (
          <div id="auth-panel-signup" role="tabpanel" aria-labelledby="auth-tab-signup">
            {signedUp ? (
              <p className="auth-gate-desc">
                <strong>{email}</strong>로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요.
              </p>
            ) : (
              <form className="auth-gate-form" onSubmit={handleSignUp}>
                <label className="sr-only" htmlFor="auth-signup-email">회원가입 이메일</label>
                <input
                  id="auth-signup-email"
                  className="auth-gate-input"
                  type="email"
                  value={email}
                  autoComplete="email"
                  placeholder="이메일 주소"
                  onChange={(event) => setEmail(event.target.value)}
                />
                <label className="sr-only" htmlFor="auth-signup-password">새 비밀번호</label>
                <input
                  id="auth-signup-password"
                  className="auth-gate-input"
                  type="password"
                  value={password}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder="비밀번호 (6자 이상)"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <label className="sr-only" htmlFor="auth-signup-password-confirm">새 비밀번호 확인</label>
                <input
                  id="auth-signup-password-confirm"
                  className="auth-gate-input"
                  type="password"
                  value={passwordConfirm}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder="비밀번호 확인"
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                />
                {error && <p className="auth-gate-error" role="alert">{error}</p>}
                <button
                  type="submit"
                  className="auth-gate-submit"
                  disabled={
                    submitting
                    || !EMAIL_PATTERN.test(email.trim())
                    || password.length < MIN_PASSWORD_LENGTH
                    || !passwordConfirm
                  }
                >
                  {submitting ? '가입 중...' : '회원가입'}
                </button>
              </form>
            )}
          </div>
        )}

        {tab === 'login' && (
          <div id="auth-panel-login" role="tabpanel" aria-labelledby="auth-tab-login">
            <div className="auth-gate-tabs auth-gate-tabs--sub" role="tablist" aria-label="로그인 방법">
              <button
                type="button"
                role="tab"
                id="auth-method-password"
                aria-controls="auth-method-panel-password"
                aria-selected={loginMethod === 'password'}
                tabIndex={loginMethod === 'password' ? 0 : -1}
                data-tab-value="password"
                className="auth-gate-subtab"
                onClick={() => { setLoginMethod('password'); resetFeedback() }}
                onKeyDown={(event) => handleTabKeyDown(event, ['password', 'link'], loginMethod, (value) => {
                  setLoginMethod(value)
                  setLinkSent(false)
                  resetFeedback()
                })}
              >
                비밀번호
              </button>
              <button
                type="button"
                role="tab"
                id="auth-method-link"
                aria-controls="auth-method-panel-link"
                aria-selected={loginMethod === 'link'}
                tabIndex={loginMethod === 'link' ? 0 : -1}
                data-tab-value="link"
                className="auth-gate-subtab"
                onClick={() => { setLoginMethod('link'); setLinkSent(false); resetFeedback() }}
                onKeyDown={(event) => handleTabKeyDown(event, ['password', 'link'], loginMethod, (value) => {
                  setLoginMethod(value)
                  setLinkSent(false)
                  resetFeedback()
                })}
              >
                이메일 링크
              </button>
            </div>

            {loginMethod === 'password' && (
              <form
                id="auth-method-panel-password"
                role="tabpanel"
                aria-labelledby="auth-method-password"
                className="auth-gate-form"
                onSubmit={handlePasswordLogin}
              >
                <label className="sr-only" htmlFor="auth-login-email">로그인 이메일</label>
                <input
                  id="auth-login-email"
                  className="auth-gate-input"
                  type="email"
                  value={email}
                  autoComplete="email"
                  placeholder="이메일 주소"
                  onChange={(event) => setEmail(event.target.value)}
                />
                <label className="sr-only" htmlFor="auth-login-password">비밀번호</label>
                <input
                  id="auth-login-password"
                  className="auth-gate-input"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  onChange={(event) => setPassword(event.target.value)}
                />
                {error && <p className="auth-gate-error" role="alert">{error}</p>}
                <button
                  type="submit"
                  className="auth-gate-submit"
                  disabled={submitting || !EMAIL_PATTERN.test(email.trim()) || !password}
                >
                  {submitting ? '확인 중...' : '로그인'}
                </button>
              </form>
            )}

            {loginMethod === 'link' && linkSent && (
              <div
                id="auth-method-panel-link"
                role="tabpanel"
                aria-labelledby="auth-method-link"
                className="auth-gate-form"
              >
                <p className="auth-gate-code-target">
                  <strong>{email}</strong>로 로그인 링크를 보냈어요. 메일의 링크를 누르면 로그인이 끝나요.
                </p>
                <button
                  type="button"
                  className="auth-gate-link"
                  onClick={() => { setLinkSent(false); resetFeedback() }}
                >
                  다른 이메일 사용하기
                </button>
              </div>
            )}

            {loginMethod === 'link' && !linkSent && (
              <form
                id="auth-method-panel-link"
                role="tabpanel"
                aria-labelledby="auth-method-link"
                className="auth-gate-form"
                onSubmit={handleSendLink}
              >
                <label className="sr-only" htmlFor="auth-link-email">로그인 링크를 받을 이메일</label>
                <input
                  id="auth-link-email"
                  className="auth-gate-input"
                  type="email"
                  value={email}
                  autoComplete="email"
                  placeholder="이메일 주소"
                  onChange={(event) => setEmail(event.target.value)}
                />
                {error && <p className="auth-gate-error" role="alert">{error}</p>}
                <button
                  type="submit"
                  className="auth-gate-submit"
                  disabled={submitting || !EMAIL_PATTERN.test(email.trim())}
                >
                  {submitting ? '전송 중...' : '로그인 링크 받기'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthGate
