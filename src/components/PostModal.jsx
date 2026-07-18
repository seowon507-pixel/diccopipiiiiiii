import { useEffect, useRef, useState } from 'react'
import { REALTIME_CATEGORIES, FREE_CATEGORIES, CATEGORY_COLORS, PIN_ICONS } from '../categories'

const TITLE_MAX_LENGTH = 40
const CONTENT_MAX_LENGTH = 500
const MIN_CONTENT_LENGTH = 2
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

function PostModal({
  open,
  submitting,
  errorMessage,
  isEditing = false,
  willBeExternal = false,
  initialCategory = null,
  initialTitle = '',
  initialContent = '',
  initialImageUrl = null,
  initialIcon = null,
  onSubmit,
  onClose,
}) {
  const [category, setCategory] = useState(initialCategory)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(initialImageUrl)
  const [imageError, setImageError] = useState(null)
  const [icon, setIcon] = useState(initialIcon)
  const fileInputRef = useRef(null)
  const dialogRef = useRef(null)
  const titleInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  // 모달이 열릴 때마다(새 글 작성 or 기존 글 수정) 입력값을 초기값으로 맞춘다.
  useEffect(() => {
    if (open) {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
      setCategory(initialCategory)
      setTitle(initialTitle)
      setContent(initialContent)
      setImageFile(null)
      setImagePreview(initialImageUrl)
      setImageError(null)
      setIcon(initialIcon)
    }
  }, [open, initialCategory, initialTitle, initialContent, initialImageUrl, initialIcon])

  useEffect(() => {
    if (!open) return undefined

    const previousFocus = document.activeElement
    const focusTimer = window.requestAnimationFrame(() => titleInputRef.current?.focus())

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (!submitting) onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [open, submitting, onClose])

  if (!open) return null

  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()
  const canSubmit = Boolean(category)
    && trimmedTitle.length > 0
    && trimmedContent.length >= MIN_CONTENT_LENGTH
    && !submitting

  function handleClose() {
    if (submitting) return
    onClose()
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setImageError('이미지 파일만 올릴 수 있어요.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError('5MB 이하 이미지만 올릴 수 있어요.')
      return
    }

    setImageError(null)
    setImageFile(file)
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = URL.createObjectURL(file)
    setImagePreview(objectUrlRef.current)
  }

  function handleRemoveImage() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({ category, title: trimmedTitle, content: trimmedContent, imageFile, removeImage: !imagePreview, icon })
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
              aria-pressed={category === name}
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
    <div
      className="post-modal-backdrop"
      onClick={(event) => event.target === event.currentTarget && handleClose()}
    >
      <form
        ref={dialogRef}
        className="post-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-modal-title"
        aria-describedby={errorMessage ? 'post-modal-error' : undefined}
        onSubmit={handleSubmit}
      >
        <h2 id="post-modal-title" className="post-modal-title">{isEditing ? '게시글 수정' : '무슨 일이 있나요?'}</h2>

        {isEditing && (
          <p className="post-modal-edit-notice">
            5분 이내 근처(50m)에 작성한 글이 있어 수정 모드로 열었어요.
          </p>
        )}
        {!isEditing && willBeExternal && (
          <p className="post-modal-edit-notice">
            내 위치에서 500m 밖이에요. &quot;외부작성&quot;으로 등록돼요.
          </p>
        )}

        {renderCategoryGroup('실시간 알림', REALTIME_CATEGORIES)}
        {renderCategoryGroup('자유 주제', FREE_CATEGORIES)}

        <div className="post-modal-icon-field">
          <p className="post-modal-category-group-label">핀 아이콘(선택)</p>
          <div className="post-modal-icons">
            {PIN_ICONS.map(({ key, emoji }) => (
              <button
                key={key}
                type="button"
                className={`post-modal-icon-chip${icon === key ? ' selected' : ''}`}
                onClick={() => setIcon(icon === key ? null : key)}
                aria-label={`아이콘 ${emoji}`}
                aria-pressed={icon === key}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <input
          ref={titleInputRef}
          className="post-modal-title-input"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          placeholder="제목"
          spellCheck="true"
          lang="ko"
          aria-label="게시글 제목"
          onChange={(event) => setTitle(event.target.value)}
        />

        <textarea
          className="post-modal-textarea"
          value={content}
          maxLength={CONTENT_MAX_LENGTH}
          placeholder="내용을 입력해주세요"
          spellCheck="true"
          lang="ko"
          onChange={(event) => setContent(event.target.value)}
        />

        <div className="post-modal-counter">
          <span>{content.length}/{CONTENT_MAX_LENGTH}</span>
        </div>

        <div className="post-modal-image-field">
          {imagePreview ? (
            <div className="post-modal-image-preview">
              <img src={imagePreview} alt="첨부 이미지 미리보기" />
              <button type="button" className="post-modal-image-remove" onClick={handleRemoveImage}>
                이미지 제거
              </button>
            </div>
          ) : (
            <label className="post-modal-image-upload">
              📷 사진 추가
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
            </label>
          )}
          {imageError && <p className="post-modal-error">{imageError}</p>}
        </div>

        {errorMessage && <p id="post-modal-error" className="post-modal-error" role="alert">{errorMessage}</p>}

        <div className="post-modal-actions">
          <button type="button" className="post-modal-cancel" disabled={submitting} onClick={handleClose}>
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
