import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, REALTIME_CATEGORIES } from '../categories'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// 지도 하단 시트를 열면 가장 먼저 보이는 실시간 이슈(웨이팅/혼잡/사건사고/교통) 가로 캐러셀.
// 자유주제 커뮤니티 글은 여기 안 섞이고 "커뮤니티 더보기"를 눌러야 별도로 보인다(MapSheet.jsx).
function RealtimeIssueCarousel({ posts, onSelectPost }) {
  const issues = posts
    .filter((post) => REALTIME_CATEGORIES.includes(post.category))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  if (issues.length === 0) {
    return <p className="realtime-carousel-empty">지금 이 근처엔 실시간 이슈가 없어요.</p>
  }

  return (
    <div className="realtime-carousel">
      {issues.map((post) => {
        const color = CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR

        return (
          <button
            key={post.id}
            type="button"
            className="realtime-carousel-card"
            style={{ borderColor: color }}
            onClick={() => onSelectPost(post.id)}
          >
            <span className="realtime-carousel-category" style={{ color }}>
              {post.category}
            </span>
            <p className="realtime-carousel-content">{post.content}</p>
            <div className="realtime-carousel-meta">
              <span>아직 그런가요? {post.confirm_count}</span>
              <span>{formatTime(post.created_at)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default RealtimeIssueCarousel
