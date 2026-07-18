import { useState } from 'react'
import { COMMENT_REACTION_EMOJIS } from '../categories'
import { createComment, reportComment, reactToComment } from '../supabaseClient'
import { getReporterSecret } from '../myPosts'
import { getOrCreateDeviceSecret } from '../notifications'
import ReportButton from './ReportButton.jsx'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 댓글 하나(본문+이모지 반응+시각+신고, 답글이면 "답글" 토글은 안 보인다)를 top-level 댓글과
// 답글이 함께 재사용한다 — 두 군데서 같은 마크업을 두 번 쓰지 않기 위한 내부 헬퍼.
function CommentBody({ item, isReply, reactedKeys, onReact, onToggleReply }) {
  return (
    <>
      <p className="post-detail-comment-content">{item.content}</p>

      <div className="comment-reaction-row">
        {COMMENT_REACTION_EMOJIS.map((emoji) => {
          const count = item.reactions?.[emoji] ?? 0
          const active = reactedKeys.has(`${item.id}:${emoji}`)
          return (
            <button
              key={emoji}
              type="button"
              className={`comment-reaction-chip${active ? ' active' : ''}`}
              onClick={() => onReact(item, emoji)}
            >
              {emoji}
              {count > 0 ? ` ${count}` : ''}
            </button>
          )
        })}
      </div>

      <div className="post-detail-comment-footer">
        <span className="post-detail-comment-time">{formatTime(item.created_at)}</span>
        {!isReply && (
          <button type="button" className="post-detail-comment-reply-toggle" onClick={onToggleReply}>
            답글
          </button>
        )}
        <ReportButton targetId={item.id} size="tiny" onReport={() => reportComment(item.id, getReporterSecret())} />
      </div>
    </>
  )
}

// 최상위 댓글 하나 + 그 답글 목록을 함께 그린다. 답글의 답글은 지원하지 않는다(한 단계
// 스레딩으로 충분하다는 판단 — 필요해지면 그때 확장).
function Comment({ comment, replies, postId, onReacted }) {
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  // 새로고침 전까지만 "내가 방금 누른 반응"을 표시하는 용도 — 서버 쪽 중복 방지는
  // reactor hash unique 제약이 이미 보장하므로 이건 순전히 하이라이트 표시용이다.
  const [reactedKeys, setReactedKeys] = useState(() => new Set())

  async function handleReact(targetItem, emoji) {
    try {
      const result = await reactToComment(targetItem.id, emoji, getOrCreateDeviceSecret())
      setReactedKeys((prev) => {
        const next = new Set(prev)
        const key = `${targetItem.id}:${emoji}`
        if (result.reacted) next.add(key)
        else next.delete(key)
        return next
      })
      onReacted(targetItem.id, emoji, result.count)
    } catch (err) {
      console.error('[Comment] 반응 실패', err)
    }
  }

  async function handleReplySubmit(event) {
    event.preventDefault()
    const trimmed = replyText.trim()
    if (!trimmed) return

    setSubmittingReply(true)
    try {
      await createComment(postId, trimmed, comment.id)
      setReplyText('')
      setReplying(false)
    } catch (err) {
      console.error('[Comment] 답글 등록 실패', err)
    } finally {
      setSubmittingReply(false)
    }
  }

  return (
    <li className="post-detail-comment">
      <CommentBody
        item={comment}
        isReply={false}
        reactedKeys={reactedKeys}
        onReact={handleReact}
        onToggleReply={() => setReplying((prev) => !prev)}
      />

      {replying && (
        <form className="post-detail-reply-form" onSubmit={handleReplySubmit}>
          <input
            className="post-detail-comment-input"
            value={replyText}
            maxLength={200}
            placeholder="답글을 입력하세요"
            onChange={(event) => setReplyText(event.target.value)}
          />
          <button
            type="submit"
            className="post-detail-comment-submit"
            disabled={submittingReply || !replyText.trim()}
          >
            등록
          </button>
        </form>
      )}

      {replies.length > 0 && (
        <ul className="post-detail-reply-list">
          {replies.map((reply) => (
            <li key={reply.id} className="post-detail-reply">
              <CommentBody item={reply} isReply reactedKeys={reactedKeys} onReact={handleReact} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default Comment
