import { useEffect, useState } from 'react'
import { CATEGORIES, CATEGORY_COLORS } from '../categories'

const MIN_LENGTH = 2
const MAX_LENGTH = 50

function PostModal({
  open,
  submitting,
  errorMessage,
  isEditing = false,
  initialCategory = null,
  initialContent = '',
  onSubmit,
  onClose,
}) {
  const [category, setCategory] = useState(initialCategory)
  const [content, setContent] = useState(initialContent)

  // 모달이 열릴 때마다(새 글 작성 or 기존 글 수정) 입력값을 초기값으로 맞춘다.
  useEffect(() => {
    if (open) {
      setCategory(initialCategory)
      setContent(initialContent)
    }
  }, [open, initialCategory, initialContent])

  if (!open) return null

  const trimmedLength = content.trim().length
  const canSubmit = Boolean(category) && trimmedLength >= MIN_LENGTH && !submitting

  function handleClose() {
    onClose()
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({ category, content: content.trim() })
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

        <div className="post-modal-categories">
          {CATEGORIES.map((name) => (
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

        <textarea
          className="post-modal-textarea"
          value={content}
          maxLength={MAX_LENGTH}
          placeholder="최소 2자 이상 입력해주세요"
          onChange={(event) => setContent(event.target.value)}
        />

        <div className="post-modal-counter">
          <span>{content.length}/{MAX_LENGTH}</span>
          {trimmedLength > 0 && trimmedLength < MIN_LENGTH && (
            <span className="post-modal-counter-warning">2자 이상 입력해주세요</span>
          )}
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
