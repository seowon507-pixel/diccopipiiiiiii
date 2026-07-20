import { useCallback, useEffect, useState } from 'react'
import { fetchModerationQueue, resolveModerationCase } from '../moderation'

const FILTERS = [
  { value: 'pending', label: '검토 대기' },
  { value: 'actioned', label: '조치 완료' },
  { value: 'dismissed', label: '기각' },
  { value: '', label: '전체' },
]

function targetLabel(type) {
  return type === 'comment' ? '댓글' : '게시글'
}

function ModerationPage({ onBack }) {
  const [status, setStatus] = useState('pending')
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [workingId, setWorkingId] = useState(null)
  const [notes, setNotes] = useState({})

  const loadCases = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCases(await fetchModerationQueue({ status }))
    } catch (loadError) {
      console.error('[ModerationPage] 신고 목록 조회 실패', loadError)
      setError('신고 목록을 불러오지 못했어요. 관리자 권한과 Supabase 마이그레이션을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void loadCases()
  }, [loadCases])

  async function handleAction(item, action) {
    if (workingId != null) return
    setWorkingId(item.case_id)
    setError(null)
    try {
      await resolveModerationCase(item.case_id, action, notes[item.case_id] ?? '')
      await loadCases()
    } catch (actionError) {
      console.error('[ModerationPage] 신고 조치 실패', actionError)
      setError('조치를 저장하지 못했어요. 다시 시도해주세요.')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="moderation-page">
      <div className="menu-page-header">
        <button type="button" className="menu-back-button" onClick={onBack}>‹ 메뉴</button>
        <h1 className="menu-page-title">신고 관리</h1>
      </div>

      <p className="moderation-intro">
        신고자 식별정보는 표시하지 않습니다. 내용과 누적 횟수만 검토하고 모든 조치는 감사 기록에 남습니다.
      </p>

      <div className="moderation-filters" role="group" aria-label="신고 처리 상태">
        {FILTERS.map((filter) => (
          <button
            key={filter.value || 'all'}
            type="button"
            className={`moderation-filter${status === filter.value ? ' active' : ''}`}
            aria-pressed={status === filter.value}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="moderation-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadCases}>다시 시도</button>
        </div>
      )}

      {loading && <p className="moderation-empty" role="status">신고 목록을 확인하는 중...</p>}
      {!loading && !error && cases.length === 0 && (
        <p className="moderation-empty" role="status">이 상태의 신고가 없습니다.</p>
      )}

      <div className="moderation-list">
        {cases.map((item) => {
          const working = workingId === item.case_id
          return (
            <article className="moderation-card" key={item.case_id}>
              <header className="moderation-card-header">
                <span className="moderation-target">{targetLabel(item.target_type)}</span>
                <span className="moderation-count">신고 {item.report_count}회</span>
                {item.hidden && <span className="moderation-hidden">현재 숨김</span>}
              </header>
              {item.title && <h2 className="moderation-title">{item.title}</h2>}
              <p className="moderation-content">{item.content || '내용 없음'}</p>
              <p className="moderation-meta">
                최근 신고 {item.last_reported_at ? new Date(item.last_reported_at).toLocaleString('ko-KR') : '기록 없음'}
              </p>

              {item.status === 'pending' && (
                <>
                  <label className="moderation-note-label" htmlFor={`moderation-note-${item.case_id}`}>
                    조치 메모 <span>(선택, 관리자에게만 표시)</span>
                  </label>
                  <textarea
                    id={`moderation-note-${item.case_id}`}
                    className="moderation-note"
                    maxLength={1000}
                    value={notes[item.case_id] ?? ''}
                    onChange={(event) => setNotes((current) => ({
                      ...current,
                      [item.case_id]: event.target.value,
                    }))}
                  />
                  <div className="moderation-actions">
                    <button type="button" disabled={working} onClick={() => handleAction(item, 'hide')}>
                      콘텐츠 숨기기
                    </button>
                    {item.hidden && (
                      <button type="button" disabled={working} onClick={() => handleAction(item, 'restore')}>
                        다시 공개
                      </button>
                    )}
                    <button type="button" disabled={working} onClick={() => handleAction(item, 'dismiss')}>
                      신고 기각
                    </button>
                  </div>
                </>
              )}

              {item.status !== 'pending' && (
                <p className="moderation-resolution">
                  처리: {item.action || item.status}{item.resolution_note ? ` · ${item.resolution_note}` : ''}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default ModerationPage
