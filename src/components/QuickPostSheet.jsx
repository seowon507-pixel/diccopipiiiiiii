import { CATEGORIES, CATEGORY_COLORS } from '../categories'
import { Glyph, CATEGORY_GLYPH } from '../iconGlyphs'

// FAB을 누르면 뜨는 카테고리 그리드 — 칸 하나를 고르면 그 자리에서 바로 등록까지 끝난다
// (제목/사진 없이 현재 위치 + 카테고리 1개). 제목/사진까지 채우고 싶으면 하단의 작은
// "자세히 쓰기" 링크로 기존 PostModal 전체 작성 흐름으로 넘어간다.
function QuickPostSheet({ open, submitting, onSelectCategory, onOpenDetailedModal, onClose }) {
  if (!open) return null

  return (
    <div className="quick-post-backdrop" onClick={onClose}>
      <div className="quick-post-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="quick-post-header">
          <div>
            <h2 className="quick-post-title">뭘 남길까요?</h2>
            <p className="quick-post-subtitle">지금 내 위치에 바로 등록돼요.</p>
          </div>
          <button type="button" className="quick-post-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="quick-post-grid">
          {CATEGORIES.map((name) => (
            <button
              key={name}
              type="button"
              className="quick-post-item"
              disabled={submitting}
              onClick={() => onSelectCategory(name)}
            >
              <span className="quick-post-icon" style={{ backgroundColor: CATEGORY_COLORS[name] }}>
                <Glyph name={CATEGORY_GLYPH[name]} size={20} color="#fff" strokeWidth={2} />
              </span>
              <span className="quick-post-label">{name}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="quick-post-detail-link"
          disabled={submitting}
          onClick={onOpenDetailedModal}
        >
          자세히 쓰기 (제목·사진 추가)
        </button>
      </div>
    </div>
  )
}

export default QuickPostSheet
