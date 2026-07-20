import { getTopWaitingSpots, getTopLikedPosts } from '../usePosts'
import { getDistanceMeters } from '../geo'
import PostCard from './PostCard.jsx'

// 우리 동네에 글이 없을 때 대신 보여줄 콘텐츠 — 위치 제한 없이 앱 전체에서 뽑은
// "지금 웨이팅 많은 곳"과 "다른 동네 인기글". CommunityFeed/CommunityPage 빈 상태가 공유한다.
// userLocation/now는 PostCard의 거리·페이드 표시에 그대로 넘긴다(다른 동네 글이라 거리가 꽤 멀 수 있음).
function TrendingFallback({ posts, onSelectPost, userLocation = null, now }) {
  const waitingSpots = getTopWaitingSpots(posts)
  const popularPosts = getTopLikedPosts(posts)

  function getDistance(post) {
    return userLocation ? getDistanceMeters(userLocation.lat, userLocation.lng, post.lat, post.lng) : null
  }

  if (waitingSpots.length === 0 && popularPosts.length === 0) return null

  return (
    <div className="trending-fallback">
      {waitingSpots.length > 0 && (
        <section className="trending-section">
          <h2 className="trending-section-title">🔥 지금 이 시간 웨이팅 많은 곳</h2>
          <div className="trending-list">
            {waitingSpots.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                distance={getDistance(post)}
                now={now}
                onClick={() => onSelectPost(post.id)}
              />
            ))}
          </div>
        </section>
      )}

      {popularPosts.length > 0 && (
        <section className="trending-section">
          <h2 className="trending-section-title">💬 다른 동네 인기글</h2>
          <div className="trending-list">
            {popularPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                distance={getDistance(post)}
                now={now}
                onClick={() => onSelectPost(post.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default TrendingFallback
