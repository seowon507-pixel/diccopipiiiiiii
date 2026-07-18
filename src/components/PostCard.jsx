import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, categoryHasExpiry, getMarkerIcon, getFadeOpacity } from '../categories'
import { formatDistanceMeters } from '../geo'
import { reportPost } from '../supabaseClient'
import { getReporterSecret } from '../myPosts'
import ReportButton from './ReportButton.jsx'

function formatRelativeTime(dateStr, referenceTime) {
  const diffMin = Math.floor((referenceTime - new Date(dateStr).getTime()) / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  return `${Math.floor(diffHour / 24)}일 전`
}

// 목록에서 한눈에 훑을 수 있게 [카테고리 아이콘] 제목 / 거리·시간 / 반응수로 정리한 카드.
// 실시간 이슈(웨이팅/혼잡/사건사고/교통)만 좌측에 카테고리 색 바를 둬서 구분하고, 유효시간의
// 70% 이상 지난 글은 getFadeOpacity로 옅게 표시한다(지도 마커와 동일한 판정, categories.js 공유).
// 카드 열기와 신고를 서로 독립된 실제 button으로 둬서 키보드/보조기기에서 중첩 인터랙션이
// 생기지 않게 한다.
function PostCard({ post, onClick, distance = null, now }) {
  const referenceTime = now ?? Date.now()
  const isIncident = post.category === '사건사고'
  const isRealtime = categoryHasExpiry(post.category)
  const color = CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR

  const sublineParts = [
    distance != null ? formatDistanceMeters(distance) : null,
    formatRelativeTime(post.updated_at ?? post.created_at, referenceTime),
    post.post_type === 'external' ? '외부작성' : null,
  ].filter(Boolean)

  return (
    <article
      className={`post-card${isRealtime ? ' post-card--realtime' : ''}`}
      style={{ '--post-card-accent': color, opacity: getFadeOpacity(post, referenceTime) }}
    >
      <button type="button" className="post-card-open" onClick={onClick}>
        <span className="post-card-icon" style={{ backgroundColor: color }} aria-hidden="true">
          {getMarkerIcon(post)}
        </span>

        <span className="post-card-main">
          <span className="sr-only">{post.category}</span>
          <span className="post-card-title">{post.title || post.content}</span>
          <span className="post-card-subline">{sublineParts.join(' · ')}</span>
        </span>

        {post.image_url && <img className="post-card-thumbnail" src={post.image_url} alt="" />}
      </button>

      <div className="post-card-trailing">
        <ReportButton targetId={post.id} size="tiny" onReport={() => reportPost(post.id, getReporterSecret())} />
        {isIncident ? (
          <span className="post-card-reaction post-card-incident-badge">🚨 {post.confirm_count}</span>
        ) : isRealtime ? (
          <span className="post-card-reaction">✅ {post.confirm_count}</span>
        ) : (
          <span className="post-card-reaction">👍 {post.likes_count ?? 0}</span>
        )}
      </div>

    </article>
  )
}

export default PostCard
