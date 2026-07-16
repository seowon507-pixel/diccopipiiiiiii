import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from '../categories'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PostCard({ post, onClick }) {
  return (
    <button type="button" className="post-card" onClick={onClick}>
      <div className="post-card-top">
        <span
          className="post-card-category"
          style={{ color: CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR }}
        >
          {post.category}
        </span>
        {post.post_type === 'inquiry' && <span className="post-inquiry-badge">문의</span>}
        <span className="post-card-time">{formatTime(post.updated_at ?? post.created_at)}</span>
      </div>

      {post.title && <p className="post-card-title">{post.title}</p>}
      <p className="post-card-content">{post.content}</p>

      <div className="post-card-meta">
        <span>👍 {post.likes_count ?? 0}</span>
      </div>
    </button>
  )
}

export default PostCard
