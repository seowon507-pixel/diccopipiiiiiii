import { useEffect, useState } from 'react'
import { REALTIME_CATEGORIES, FREE_CATEGORIES, CATEGORY_COLORS } from '../categories'

const TITLE_MAX_LENGTH = 40
const CONTENT_MAX_LENGTH = 500
const MIN_CONTENT_LENGTH = 2

function PostModal({
  open,
  submitting,
  errorMessage,
  isEditing = false,
  willBeInquiry = false,
  initialCategory = null,
  initialTitle = '',
  initialContent = '',
  onSubmit,
  onClose,
}) {
  const [category, setCategory] = useState(initialCategory)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)

  // 모달이 열릴 때마다(새 글 작성 or 기존 글 수정) 입력값을 초기값으로 맞춘다.
  useEffect(() => {
    if (open) {
      setCategory(initialCategory)
      setTitle(initialTitle)
      setContent(initialContent)
    }
  }, [open, initialCategory, initialTitle, initialContent])

  if (!open) return null

  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()
  const canSubmit = Boolean(category)
    && trimmedTitle.length > 0
    && trimmedContent.length >= MIN_CONTENT_LENGTH
    && !submitting

  function handleClose() {
    onClose()
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({ category, title: trimmedTitle, content: trimmedContent })
  }

  function renderCategoryGroup(label, names) {
    return (
      <div className="post-modal-category-group">
        <p className="post-modal-category-group-label">{label}</p>
        <div className="post-modal-categories">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              className={`post-modal-category-chip${category === name ? ' selected' : ''}`}
              style={category === name ? { backgroundColor: CATEGORY_COLORS[name], borderColor: CATEGORY_COLORS[name] } : undefined}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="post-modal-backdrop" onClick={handleClose}>
      <form className="post-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="post-modal-title">{isEditing ? '게시글 수정' : '무슨 일이 있나요?'}</h2>

        {isEditing && (
          <p className="post-modal-edit-notice">
            5분 이내 근처(50m)에 작성한 글이 있어 수정 모드로 열었어요.
          </p>
        )}
        {!isEditing && willBeInquiry && (
          <p className="post-modal-edit-notice">
            내 위치에서 500m 밖이에요. &quot;문의글&quot;로 등록돼요.
          </p>
        )}

        {renderCategoryGroup('실시간 알림', REALTIME_CATEGORIES)}
        {renderCategoryGroup('자유 주제', FREE_CATEGORIES)}

        <input
          className="post-modal-title-input"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          placeholder="제목"
          onChange={(event) => setTitle(event.target.value)}
        />

        <textarea
          className="post-modal-textarea"
          value={content}
          maxLength={CONTENT_MAX_LENGTH}
          placeholder="내용을 입력해주세요"
          onChange={(event) => setContent(event.target.value)}
        />

        <div className="post-modal-counter">
          <span>{content.length}/{CONTENT_MAX_LENGTH}</span>
        </div>

        {errorMessage && <p className="post-modal-error">{errorMessage}</p>}

        <div className="post-modal-actions">
          <button type="button" className="post-modal-cancel" onClick={handleClose}>
            취소
          </button>
          <button type="submit" className="post-modal-submit" disabled={!canSubmit}>
            {submitting ? (isEditing ? '수정 중...' : '등록 중...') : (isEditing ? '수정 완료' : '등록')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PostModal
