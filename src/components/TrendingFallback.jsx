import { getTopWaitingSpots, getTopLikedPosts } from '../usePosts'
import PostCard from './PostCard.jsx'

// 우리 동네에 글이 없을 때 대신 보여줄 콘텐츠 — 위치 제한 없이 앱 전체에서 뽑은
// "지금 웨이팅 많은 곳"과 "다른 동네 인기글". CommunityFeed/CommunityPage 빈 상태가 공유한다.
function TrendingFallback({ posts, onSelectPost }) {
  const waitingSpots = getTopWaitingSpots(posts)
  const popularPosts = getTopLikedPosts(posts)

  if (waitingSpots.length === 0 && popularPosts.length === 0) return null

  return (
    <div className="trending-fallback">
      {waitingSpots.length > 0 && (
        <section className="trending-section">
          <h2 className="trending-section-title">🔥 지금 이 시간 웨이팅 많은 곳</h2>
          <div className="trending-list">
            {waitingSpots.map((post) => (
              <PostCard key={post.id} post={post} onClick={() => onSelectPost(post.id)} />
            ))}
          </div>
        </section>
      )}

      {popularPosts.length > 0 && (
        <section className="trending-section">
          <h2 className="trending-section-title">💬 다른 동네 인기글</h2>
          <div className="trending-list">
            {popularPosts.map((post) => (
              <PostCard key={post.id} post={post} onClick={() => onSelectPost(post.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default TrendingFallback
