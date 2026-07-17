import { useEffect, useState } from 'react'
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, categoryHasExpiry } from '../categories'
import { getComments, createComment, subscribeToComments } from '../supabaseClient'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PostDetail({ post, onClose, onConfirm, confirming, onLike, liking, isMine, onDelete, deleting }) {
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    let cancelled = false

    getComments(post.id).then((data) => {
      if (!cancelled) setComments(data)
    })

    const unsubscribe = subscribeToComments(post.id, (newComment) => {
      setComments((prev) => (prev.some((comment) => comment.id === newComment.id) ? prev : [...prev, newComment]))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [post.id])

  const isRealtime = categoryHasExpiry(post.category)

  async function handleCommentSubmit(event) {
    event.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed) return

    setSubmittingComment(true)
    try {
      await createComment(post.id, trimmed)
      setCommentText('')
    } catch (err) {
      console.error('[PostDetail] 댓글 등록 실패', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  return (
    <div className="post-detail-backdrop" onClick={onClose}>
      <div className="post-detail" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="post-detail-close" onClick={onClose} aria-label="닫기">
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

        {post.title && <h2 className="post-detail-title">{post.title}</h2>}
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

        <div className="post-detail-comments">
          <h3 className="post-detail-comments-title">댓글 {comments.length}</h3>

          {comments.length === 0 && <p className="post-detail-comments-empty">첫 댓글을 남겨보세요.</p>}

          <ul className="post-detail-comment-list">
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
              onChange={(event) => setCommentText(event.target.value)}
            />
            <button
              type="submit"
              className="post-detail-comment-submit"
              disabled={submittingComment || !commentText.trim()}
            >
              등록
            </button>
          </form>
        </div>

        {isMine && (
          <button type="button" className="post-detail-delete" disabled={deleting} onClick={onDelete}>
            {deleting ? '삭제 중...' : '내 글 삭제하기'}
          </button>
        )}
      </div>
    </div>
  )
}

export default PostDetail
