import { useState } from 'react'
import { isReported, markReported } from '../myPosts'

// 게시글/댓글이 공유하는 신고 버튼. onReport만 다르게 넘기면 어디든 재사용할 수 있다
// (호출 성공 후 로컬에 신고 기록을 남겨 새로고침해도 "신고됨" 상태가 유지된다 —
// 서버 쪽 중복 방지는 report_post/report_comment RPC의 unique 제약이 이미 보장한다).
function ReportButton({ targetId, onReport, size = 'small' }) {
  const [status, setStatus] = useState(() => (isReported(targetId) ? 'done' : 'idle'))

  async function handleClick(event) {
    event.stopPropagation()
    if (status !== 'idle') return

    setStatus('reporting')
    try {
      await onReport()
      markReported(targetId)
      setStatus('done')
    } catch (err) {
      console.error('[ReportButton] 신고 실패', err)
      setStatus('idle')
    }
  }

  return (
    <button
      type="button"
      className={`report-button report-button--${size}${status === 'done' ? ' reported' : ''}`}
      disabled={status !== 'idle'}
      onClick={handleClick}
    >
      {status === 'done' ? '신고됨' : status === 'reporting' ? '신고 중...' : '🚩 신고'}
    </button>
  )
}

export default ReportButton
