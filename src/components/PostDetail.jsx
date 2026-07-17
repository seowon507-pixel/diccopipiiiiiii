import { useEffect, useState } from 'react'
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, categoryHasExpiry } from '../categories'
import { getComments, createComment, subscribeToComments, reportPost } from '../supabaseClient'
import { getReporterSecret } from '../myPosts'
import { useDraggableSheet } from '../useDraggableSheet'
import ReportButton from './ReportButton.jsx'
import Comment from './Comment.jsx'

// 3단계 높이(미리보기/절반/전체, 뷰포트 비율) — 드래그 핸들을 끌거나 살짝 탭해서 오간다.
// 마커를 탭해도 지도는 그대로 있고 이 시트만 위로 올라온다(지도 이동/재중심 없음).
const PREVIEW_RATIO = 0.4
const HALF_RATIO = 0.62
const FULL_RATIO = 0.92

function getBreakpoints(containerHeight) {
  return [containerHeight * PREVIEW_RATIO, containerHeight * HALF_RATIO, containerHeight * FULL_RATIO]
}

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
  // 미리보기 높이보다 한참 아래로 끌어내려 놓으면(onDismissBelowMin) 닫힘 — 스와이프로 닫기.
  const { wrapperRef, heightPx, dragging, handlers } = useDraggableSheet({
    getBreakpoints,
    initialIndex: 0,
    onDismissBelowMin: onClose,
  })

  useEffect(() => {
    let cancelled = false

    getComments(post.id).then((data) => {
      if (!cancelled) setComments(data)
    })

    const unsubscribe = subscribeToComments(post.id, {
      onInsert: (newComment) => {
        setComments((prev) => (prev.some((comment) => comment.id === newComment.id) ? prev : [...prev, newComment]))
      },
      // 신고 누적으로 hidden=true가 되면(다른 사용자 화면 포함) 목록에서 즉시 제거한다.
      onUpdate: (updatedComment) => {
        setComments((prev) => (
          updatedComment.hidden
            ? prev.filter((comment) => comment.id !== updatedComment.id)
            : prev.map((comment) => (comment.id === updatedComment.id ? { ...comment, ...updatedComment } : comment))
        ))
      },
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [post.id])

  const isRealtime = categoryHasExpiry(post.category)
  const isIncident = post.category === '사건사고'

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

  // Comment.jsx가 반응 토글에 성공하면 그 결과를 여기 comments state에도 낙관적으로 반영한다
  // (realtime UPDATE로도 곧 같은 값이 오지만, 누른 사람 화면은 그걸 기다리지 않아도 된다).
  function handleCommentReacted(commentId, emoji, count) {
    setComments((prev) => prev.map((comment) => (
      comment.id === commentId ? { ...comment, reactions: { ...comment.reactions, [emoji]: count } } : comment
    )))
  }

  // 답글(parent_comment_id 있음)은 한 단계만 지원한다 — top-level 댓글마다 자기 답글 목록을 묶어서 넘긴다.
  const topLevelComments = comments.filter((comment) => !comment.parent_comment_id)

  return (
    <div className="post-detail-backdrop" onClick={onClose}>
      <div
        ref={wrapperRef}
        className={`post-detail${dragging ? ' dragging' : ''}`}
        style={{ height: heightPx || undefined }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="post-detail-handle" {...handlers}>
          <span className="post-detail-handle-bar" />
        </div>

        <button type="button" className="post-detail-close" onClick={onClose} aria-label="닫기">
          ×
        </button>

        <div className="post-detail-scroll">
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
            <ReportButton targetId={post.id} onReport={() => reportPost(post.id, getReporterSecret())} />
          </div>

          {post.title && <h2 className="post-detail-title">{post.title}</h2>}
          {post.image_url && (
            <img className="post-detail-image" src={post.image_url} alt="게시글 첨부 이미지" />
          )}
          <p className="post-detail-content">{post.content}</p>

          <div className="post-detail-actions">
            {isIncident ? (
              <div className="post-detail-incident-banner">
                <span className="post-detail-incident-label">🚨 확인 {post.confirm_count}명</span>
                <button
                  type="button"
                  className="post-detail-confirm post-detail-confirm--incident"
                  disabled={confirming}
                  onClick={onConfirm}
                >
                  {confirming ? '확인 중...' : '아직 그런가요?'}
                </button>
              </div>
            ) : isRealtime ? (
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
              {topLevelComments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  replies={comments.filter((reply) => reply.parent_comment_id === comment.id)}
                  postId={post.id}
                  onReacted={handleCommentReacted}
                />
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
    </div>
  )
}

export default PostDetail
