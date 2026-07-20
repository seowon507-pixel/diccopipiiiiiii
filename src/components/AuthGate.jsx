import { useState } from 'react'
import {
  signUpWithPassword,
  signInWithPassword,
  sendLoginCode,
  verifyLoginCode,
  checkUsernameAvailable,
  saveUsername,
  isValidUsernameFormat,
} from '../auth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

// 앱 시작 시 온보딩보다 먼저 뜨는 로그인 게이트.
// - session이 없으면: 회원가입(이메일+비밀번호, 이메일 인증 필요)과 로그인(비밀번호 또는
//   인증코드, 둘 다 이미 가입된 계정 전용) 중 고르는 화면을 보여준다.
// - session은 있지만 아이디(profiles.username)가 없으면: 아이디 설정+중복확인 화면을 보여준다.
// 로그인/아이디 저장 성공 이후의 상태 갱신은 App.jsx가 처리하므로(세션 구독, 프로필 재조회),
// 여기서는 그 결과로 다시 그려지는 것만 기다리면 된다.
function AuthGate({ session, onUsernameSaved }) {
  const [tab, setTab] = useState('signup') // 'signup' | 'login'
  const [loginMethod, setLoginMethod] = useState('password') // 'password' | 'code'
  const [codePhase, setCodePhase] = useState('request') // 'request' | 'verify'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [code, setCode] = useState('')
  const [username, setUsernameValue] = useState('')
  const [usernameCheck, setUsernameCheck] = useState(null) // null | 'checking' | 'available' | 'taken'
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

  async function handleSendCode(event) {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail) || submitting) return

    setSubmitting(true)
    resetFeedback()
    try {
      await sendLoginCode(trimmedEmail)
      setEmail(trimmedEmail)
      setCodePhase('verify')
    } catch (err) {
      console.error('[AuthGate] 인증코드 발송 실패', err)
      setError(err?.message?.includes('Signups not allowed')
        ? '아직 가입되지 않은 이메일이에요. 회원가입 탭을 이용해주세요.'
        : '인증코드를 보내지 못했어요. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    resetFeedback()
    try {
      await verifyLoginCode(email, trimmed)
    } catch (err) {
      console.error('[AuthGate] 인증코드 확인 실패', err)
      setError('인증코드가 올바르지 않아요. 다시 확인해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCheckUsername() {
    const trimmed = username.trim()
    if (!isValidUsernameFormat(trimmed) || usernameCheck === 'checking') return

    setUsernameCheck('checking')
    resetFeedback()
    try {
      const available = await checkUsernameAvailable(trimmed)
      setUsernameCheck(available ? 'available' : 'taken')
    } catch (err) {
      console.error('[AuthGate] 아이디 중복확인 실패', err)
      setUsernameCheck(null)
      setError('중복확인에 실패했어요. 다시 시도해주세요.')
    }
  }

  async function handleSaveUsername(event) {
    event.preventDefault()
    if (usernameCheck !== 'available' || submitting) return

    setSubmitting(true)
    resetFeedback()
    try {
      const saved = await saveUsername(username)
      onUsernameSaved?.(saved)
    } catch (err) {
      console.error('[AuthGate] 아이디 저장 실패', err)
      setError('방금 다른 사람이 먼저 가져갔을 수 있어요. 다시 중복확인해주세요.')
      setUsernameCheck(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (session) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-body">
          <span className="auth-gate-logo" aria-hidden="true">👋</span>
          <h1 className="auth-gate-title">아이디를 정해주세요</h1>
          <p className="auth-gate-desc">동네 이웃들에게 보여질 이름이에요. 영문/숫자/밑줄 2~20자.</p>

          <form className="auth-gate-form" onSubmit={handleSaveUsername}>
            <div className="auth-gate-username-row">
              <input
                className="auth-gate-input"
                value={username}
                maxLength={20}
                autoComplete="off"
                placeholder="아이디"
                onChange={(event) => {
                  setUsernameValue(event.target.value)
                  setUsernameCheck(null)
                }}
              />
              <button
                type="button"
                className="auth-gate-check-button"
                disabled={!isValidUsernameFormat(username) || usernameCheck === 'checking'}
                onClick={handleCheckUsername}
              >
                {usernameCheck === 'checking' ? '확인 중...' : '중복확인'}
              </button>
            </div>
            {usernameCheck === 'available' && <p className="auth-gate-success">사용할 수 있는 아이디예요.</p>}
            {usernameCheck === 'taken' && <p className="auth-gate-error" role="alert">이미 사용 중인 아이디예요.</p>}
            {error && <p className="auth-gate-error" role="alert">{error}</p>}
            <button type="submit" className="auth-gate-submit" disabled={usernameCheck !== 'available' || submitting}>
              {submitting ? '저장 중...' : '시작하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-gate">
      <div className="auth-gate-body">
        <span className="auth-gate-logo" aria-hidden="true">📍</span>
        <h1 className="auth-gate-title">우리동네알림</h1>

        <div className="auth-gate-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signup'}
            className="auth-gate-tab"
            onClick={() => { setTab('signup'); resetFeedback(); setSignedUp(false) }}
          >
            회원가입
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className="auth-gate-tab"
            onClick={() => { setTab('login'); resetFeedback() }}
          >
            로그인
          </button>
        </div>

        {tab === 'signup' && signedUp && (
          <p className="auth-gate-desc">
            <strong>{email}</strong>로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요.
          </p>
        )}

        {tab === 'signup' && !signedUp && (
          <form className="auth-gate-form" onSubmit={handleSignUp}>
            <input
              className="auth-gate-input"
              type="email"
              value={email}
              autoComplete="email"
              placeholder="이메일 주소"
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="auth-gate-input"
              type="password"
              value={password}
              autoComplete="new-password"
              placeholder="비밀번호 (6자 이상)"
              onChange={(event) => setPassword(event.target.value)}
            />
            <input
              className="auth-gate-input"
              type="password"
              value={passwordConfirm}
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

        {tab === 'login' && (
          <>
            <div className="auth-gate-tabs auth-gate-tabs--sub" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={loginMethod === 'password'}
                className="auth-gate-subtab"
                onClick={() => { setLoginMethod('password'); resetFeedback() }}
              >
                비밀번호
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={loginMethod === 'code'}
                className="auth-gate-subtab"
                onClick={() => { setLoginMethod('code'); setCodePhase('request'); resetFeedback() }}
              >
                인증코드
              </button>
            </div>

            {loginMethod === 'password' && (
              <form className="auth-gate-form" onSubmit={handlePasswordLogin}>
                <input
                  className="auth-gate-input"
                  type="email"
                  value={email}
                  autoComplete="email"
                  placeholder="이메일 주소"
                  onChange={(event) => setEmail(event.target.value)}
                />
                <input
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

            {loginMethod === 'code' && codePhase === 'request' && (
              <form className="auth-gate-form" onSubmit={handleSendCode}>
                <input
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
                  {submitting ? '전송 중...' : '인증코드 받기'}
                </button>
              </form>
            )}

            {loginMethod === 'code' && codePhase === 'verify' && (
              <form className="auth-gate-form" onSubmit={handleVerifyCode}>
                <p className="auth-gate-code-target">{email}로 인증코드를 보냈어요.</p>
                <input
                  className="auth-gate-input"
                  value={code}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="인증코드 6자리"
                  onChange={(event) => setCode(event.target.value)}
                />
                {error && <p className="auth-gate-error" role="alert">{error}</p>}
                <button type="submit" className="auth-gate-submit" disabled={submitting || !code.trim()}>
                  {submitting ? '확인 중...' : '로그인'}
                </button>
                <button
                  type="button"
                  className="auth-gate-link"
                  onClick={() => { setCodePhase('request'); setCode(''); resetFeedback() }}
                >
                  다른 이메일 사용하기
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AuthGate
