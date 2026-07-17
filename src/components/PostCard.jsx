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
// 카드 전체가 클릭 가능한 영역이라 안에 진짜 <button>(신고)을 또 넣을 수 없어(button-in-button은
// 유효하지 않은 HTML이라 클릭 버블링이 꼬인다) 루트를 div+role="button"으로 뒀다.
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
    <div
      role="button"
      tabIndex={0}
      className={`post-card${isRealtime ? ' post-card--realtime' : ''}`}
      style={{ '--post-card-accent': color, opacity: getFadeOpacity(post, referenceTime) }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <span className="post-card-icon" style={{ backgroundColor: color }}>
        {getMarkerIcon(post)}
      </span>

      <div className="post-card-main">
        <p className="post-card-title">{post.title || post.content}</p>
        <p className="post-card-subline">{sublineParts.join(' · ')}</p>
      </div>

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

      {post.image_url && <img className="post-card-thumbnail" src={post.image_url} alt="" />}
    </div>
  )
}

export default PostCard
