import { useState } from 'react'
import { getOrCreateDeviceSecret, adoptDeviceSecret } from '../notifications'
import { restoreOwnership } from '../supabaseClient'
import { saveOwnership, savePinOwnership } from '../myPosts'

// 회원가입 없이 폰을 바꿔도 내 글/핀을 계속 관리(수정/삭제)할 수 있게 하는 화면.
// "코드"의 실체는 notifications.js가 이미 관리하던 이 브라우저의 device_secret이다 —
// 별도의 짧은 코드 체계를 새로 만들지 않고, 글/핀을 만들 때 이미 함께 저장해두는 값을
// 그대로 복구 코드로 재사용한다(24번 단계, myPosts.js owner_secret 패턴과 같은 철학).
function RecoveryCode() {
  const [myCode] = useState(() => getOrCreateDeviceSecret())
  const [copied, setCopied] = useState(false)
  const [inputCode, setInputCode] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [result, setResult] = useState(null) // { count } | { error: true }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(myCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[RecoveryCode] 복사 실패', err)
    }
  }

  async function handleRestore(event) {
    event.preventDefault()
    const normalized = inputCode.trim().toLowerCase()
    if (!normalized || restoring) return

    setRestoring(true)
    setResult(null)
    try {
      const rows = await restoreOwnership(normalized)
      rows.forEach((row) => {
        if (row.target_type === 'post') saveOwnership(row.target_id, row.owner_secret)
        else savePinOwnership(row.target_id, row.owner_secret)
      })
      // 이 기기가 그 코드의 정체성을 이어받는다 — 앞으로 여기서 쓰는 글/핀도 같은 코드로 묶인다.
      adoptDeviceSecret(normalized)
      setResult({ count: rows.length })
      setInputCode('')
    } catch (err) {
      console.error('[RecoveryCode] 복구 실패', err)
      setResult({ error: true })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="recovery-code">
      <section className="recovery-section">
        <h2 className="recovery-section-title">내 복구 코드</h2>
        <p className="recovery-section-desc">
          회원가입 없이도 이 코드만 있으면 다른 기기에서 내가 쓴 글/핀을 계속 관리할 수 있어요.
          잘 저장해두세요 — 잃어버리면 되찾을 방법이 없어요.
        </p>
        <div className="recovery-code-display">
          <span className="recovery-code-text">{myCode}</span>
          <button type="button" className="recovery-code-copy" onClick={handleCopy}>
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      </section>

      <section className="recovery-section">
        <h2 className="recovery-section-title">다른 기기에서 복구하기</h2>
        <p className="recovery-section-desc">
          전에 쓰던 기기의 복구 코드를 입력하면 그 기기에서 만든 글/핀을 이 기기로 가져와요.
        </p>
        <form className="recovery-restore-form" onSubmit={handleRestore}>
          <input
            className="recovery-restore-input"
            value={inputCode}
            placeholder="복구 코드를 붙여넣으세요"
            onChange={(event) => setInputCode(event.target.value)}
          />
          <button type="submit" className="recovery-restore-button" disabled={restoring || !inputCode.trim()}>
            {restoring ? '복구 중...' : '복구하기'}
          </button>
        </form>

        {result?.count != null && (
          <p className="recovery-restore-success">
            {result.count > 0 ? `글/핀 ${result.count}개를 되찾았어요!` : '이 코드로 만든 글/핀이 아직 없어요.'}
          </p>
        )}
        {result?.error && <p className="recovery-restore-error">복구에 실패했어요. 코드를 다시 확인해주세요.</p>}
      </section>
    </div>
  )
}

export default RecoveryCode
