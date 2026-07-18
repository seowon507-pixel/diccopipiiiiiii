import { useEffect, useRef, useState } from 'react'
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, categoryHasExpiry } from '../categories'
import { getComments, createComment, subscribeToComments } from '../supabaseClient'
import { getActorToken } from '../myPosts'

function createClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function mergeComments(current, incoming) {
  const byId = new Map(current.map((comment) => [comment.id, comment]))
  incoming.forEach((comment) => {
    byId.set(comment.id, { ...byId.get(comment.id), ...comment })
  })
  return [...byId.values()].sort((a, b) => {
    const timeDifference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return timeDifference || String(a.id).localeCompare(String(b.id))
  })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PostDetail({ post, onClose, onConfirm, confirming, onLike, liking, isMine, onEdit, onDelete, deleting, actionError }) {
  const [comments, setComments] = useState([])
  const [commentsStatus, setCommentsStatus] = useState('loading')
  const [commentsError, setCommentsError] = useState(null)
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING')
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshGeneration, setRefreshGeneration] = useState(0)
  const requestGenerationRef = useRef(0)
  const pendingCommentIdRef = useRef(null)
  const actorTokenRef = useRef(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(false)
  const confirmDeleteRef = useRef(false)
  closeRef.current = onClose
  busyRef.current = Boolean(deleting || submittingComment)
  confirmDeleteRef.current = confirmDelete

  useEffect(() => {
    const previousFocus = document.activeElement
    const focusTimer = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (confirmDeleteRef.current) {
          setConfirmDelete(false)
        } else if (!busyRef.current) {
          closeRef.current()
        }
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
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
  }, [post.id])

  useEffect(() => {
    const generation = requestGenerationRef.current + 1
    requestGenerationRef.current = generation
    let active = true

    setComments([])
    setCommentsStatus('loading')
    setCommentsError(null)
    setRealtimeStatus('CONNECTING')
    setSubmitError(null)
    pendingCommentIdRef.current = null
    setConfirmDelete(false)

    const acceptComments = (incoming) => {
      if (!active || generation !== requestGenerationRef.current) return
      setComments((current) => mergeComments(current, Array.isArray(incoming) ? incoming : []))
      setCommentsStatus('ready')
      setCommentsError(null)
    }

    const loadComments = () => {
      getComments(post.id).then(acceptComments).catch((error) => {
        if (!active || generation !== requestGenerationRef.current) return
        setCommentsError(error)
        setCommentsStatus((status) => (status === 'ready' ? status : 'error'))
      })
    }

    const unsubscribe = subscribeToComments(
      post.id,
      (newComment) => acceptComments([newComment]),
      (status) => {
        if (!active || generation !== requestGenerationRef.current) return
        setRealtimeStatus(status)
        if (status === 'SUBSCRIBED') loadComments()
      },
    )

    // 구독 생성 직후 조회하고 SUBSCRIBED 시 다시 병합해 구독 준비 전 삽입도 회수한다.
    loadComments()

    return () => {
      active = false
      unsubscribe()
    }
  }, [post.id, refreshGeneration])

  const isRealtime = categoryHasExpiry(post.category)

  async function handleCommentSubmit(event) {
    event.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed) return

    const id = pendingCommentIdRef.current ?? createClientId()
    pendingCommentIdRef.current = id
    actorTokenRef.current ??= getActorToken()

    setSubmittingComment(true)
    setSubmitError(null)
    try {
      const created = await createComment(post.id, trimmed, {
        id,
        actorToken: actorTokenRef.current,
      })
      setComments((current) => mergeComments(current, [created]))
      setCommentsStatus('ready')
      setCommentText('')
      pendingCommentIdRef.current = null
    } catch (err) {
      console.error('[PostDetail] 댓글 등록 실패', err)
      setSubmitError(err)
    } finally {
      setSubmittingComment(false)
    }
  }

  return (
    <div
      className="post-detail-backdrop"
      onClick={(event) => event.target === event.currentTarget && !busyRef.current && onClose()}
    >
      <div
        ref={dialogRef}
        className="post-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-title"
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="post-detail-close"
          disabled={deleting || submittingComment}
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>

        <div className="post-detail-header">
          <span
            className="post-detail-category"
            style={{ color: CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR }}
          >
            {post.category}
          </span>
          {post.post_type === 'external' && <span className="post-inquiry-badge">외부작성</span>}
          <span className="post-detail-time">{formatTime(post.updated_at ?? post.created_at)}</span>
          {post.updated_at && <span className="map-infowindow-edited-badge">(수정됨)</span>}
        </div>

        {post.title && <h2 id="post-detail-title" className="post-detail-title">{post.title}</h2>}
        {!post.title && <h2 id="post-detail-title" className="sr-only">게시글 상세</h2>}
        {post.image_url && (
          <img className="post-detail-image" src={post.image_url} alt="게시글 첨부 이미지" />
        )}
        <p className="post-detail-content">{post.content}</p>

        <div className="post-detail-actions">
          {isRealtime ? (
            <button type="button" className="post-detail-confirm" disabled={confirming} onClick={onConfirm}>
              {confirming ? '확인 중...' : `아직 그런가요? (${post.confirm_count})`}
            </button>
          ) : (
            <button type="button" className="post-detail-like" disabled={liking} onClick={onLike}>
              {liking ? '반영 중...' : `👍 추천해요 (${post.likes_count ?? 0})`}
            </button>
          )}
        </div>
        {actionError && <p className="dialog-error" role="alert">{actionError}</p>}

        <div className="post-detail-comments">
          <h3 className="post-detail-comments-title" data-connection-status={realtimeStatus}>
            댓글 {comments.length}
          </h3>

          {commentsStatus === 'loading' && (
            <p className="post-detail-comments-empty" role="status">댓글을 불러오는 중이에요…</p>
          )}
          {commentsStatus === 'error' && (
            <div className="post-detail-comments-empty" role="alert">
              <p>댓글을 불러오지 못했어요.</p>
              <button type="button" onClick={() => setRefreshGeneration((value) => value + 1)}>다시 시도</button>
            </div>
          )}
          {commentsStatus === 'ready' && comments.length === 0 && (
            <p className="post-detail-comments-empty">첫 댓글을 남겨보세요.</p>
          )}

          <ul className="post-detail-comment-list" aria-live="polite" aria-relevant="additions">
            {comments.map((comment) => (
              <li key={comment.id} className="post-detail-comment">
                <p className="post-detail-comment-content">{comment.content}</p>
                <span className="post-detail-comment-time">{formatTime(comment.created_at)}</span>
              </li>
            ))}
          </ul>

          <form className="post-detail-comment-form" onSubmit={handleCommentSubmit}>
            <input
              className="post-detail-comment-input"
              value={commentText}
              maxLength={200}
              placeholder="댓글을 입력하세요"
              onChange={(event) => {
                if (event.target.value !== commentText) pendingCommentIdRef.current = null
                setCommentText(event.target.value)
                setSubmitError(null)
              }}
            />
            <button
              type="submit"
              className="post-detail-comment-submit"
              disabled={submittingComment || !commentText.trim()}
            >
              등록
            </button>
          </form>
          {commentsError && commentsStatus === 'ready' && (
            <p role="alert">최신 댓글을 확인하지 못했어요. 연결되면 다시 확인할게요.</p>
          )}
          {submitError && <p role="alert">댓글을 등록하지 못했어요. 다시 시도해 주세요.</p>}
        </div>

        {isMine && (
          <div className="post-detail-owner-actions">
            <button
              type="button"
              className="post-detail-edit"
              disabled={deleting || submittingComment}
              onClick={onEdit}
            >
              내 글 수정하기
            </button>
            {confirmDelete ? (
              <div className="post-detail-delete-confirm" role="group" aria-label="게시글 삭제 확인">
                <span>정말 삭제할까요?</span>
                <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>취소</button>
                <button type="button" className="danger" disabled={deleting} onClick={onDelete}>
                  {deleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="post-detail-delete"
                disabled={deleting || submittingComment}
                onClick={() => setConfirmDelete(true)}
              >
                내 글 삭제하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PostDetail
