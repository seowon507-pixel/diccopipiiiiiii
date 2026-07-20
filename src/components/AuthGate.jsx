import { useState } from 'react'
import { sendLoginCode, verifyLoginCode, saveNickname, getNickname } from '../auth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 앱 시작 시 온보딩보다 먼저 뜨는 로그인 게이트. session이 없으면 이메일→인증코드 단계를,
// session은 있지만 닉네임(user_metadata)이 없으면 닉네임 입력 단계를 보여준다. 로그인/닉네임
// 저장 성공 이후의 세션 갱신은 App.jsx의 subscribeToAuthState가 처리하므로, 여기서는 그
// 결과로 다시 그려지는 것만 기다리면 된다(자체적으로 "완료" 상태를 들고 있지 않음).
function AuthGate({ session }) {
  const [phase, setPhase] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNicknameValue] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSendCode(event) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed) || sending) return

    setSending(true)
    setError(null)
    try {
      await sendLoginCode(trimmed)
      setEmail(trimmed)
      setPhase('code')
    } catch (err) {
      console.error('[AuthGate] 인증코드 발송 실패', err)
      setError('인증코드를 보내지 못했어요. 이메일 주소를 확인하고 다시 시도해주세요.')
    } finally {
      setSending(false)
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || verifying) return

    setVerifying(true)
    setError(null)
    try {
      await verifyLoginCode(email, trimmed)
    } catch (err) {
      console.error('[AuthGate] 인증코드 확인 실패', err)
      setError('인증코드가 올바르지 않아요. 다시 확인해주세요.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleSaveNickname(event) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)
    try {
      await saveNickname(nickname)
    } catch (err) {
      console.error('[AuthGate] 닉네임 저장 실패', err)
      setError(err instanceof RangeError ? err.message : '닉네임을 저장하지 못했어요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  if (session && !getNickname(session)) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-body">
          <span className="auth-gate-logo" aria-hidden="true">👋</span>
          <h1 className="auth-gate-title">닉네임을 정해주세요</h1>
          <p className="auth-gate-desc">동네 이웃들에게 보여질 이름이에요.</p>

          <form className="auth-gate-form" onSubmit={handleSaveNickname}>
            <input
              className="auth-gate-input"
              value={nickname}
              maxLength={20}
              autoComplete="off"
              placeholder="닉네임 (1~20자)"
              onChange={(event) => setNicknameValue(event.target.value)}
            />
            {error && <p className="auth-gate-error" role="alert">{error}</p>}
            <button type="submit" className="auth-gate-submit" disabled={saving || !nickname.trim()}>
              {saving ? '저장 중...' : '시작하기'}
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
        <p className="auth-gate-desc">이메일로 간단하게 로그인하고 시작해요.</p>

        {phase === 'email' && (
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
              disabled={sending || !EMAIL_PATTERN.test(email.trim())}
            >
              {sending ? '전송 중...' : '인증코드 받기'}
            </button>
          </form>
        )}

        {phase === 'code' && (
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
            <button type="submit" className="auth-gate-submit" disabled={verifying || !code.trim()}>
              {verifying ? '확인 중...' : '로그인'}
            </button>
            <button
              type="button"
              className="auth-gate-link"
              onClick={() => {
                setPhase('email')
                setCode('')
                setError(null)
              }}
            >
              다른 이메일 사용하기
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default AuthGate
