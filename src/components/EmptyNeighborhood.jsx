import TrendingFallback from './TrendingFallback.jsx'

// 내 반경 1km에 글이 하나도 없을 때(콜드 스타트) 지도 하단 시트 맨 위에 뜨는 안내.
// "지금 이 근처엔 실시간 이슈가 없어요" 한 줄로 죽어 보이던 화면을, 원탭으로 첫 글을 남기게
// 유도하는 화면으로 바꾼다. 다른 동네에 콘텐츠가 있으면 TrendingFallback으로 함께 보여주고
// (아무 데도 없으면 TrendingFallback은 null이라 CTA만 남는다).
function EmptyNeighborhood({ onOpenQuickPost, fallbackPosts, onSelectPost, userLocation, now }) {
  return (
    <div className="empty-neighborhood">
      <span className="empty-neighborhood-emoji" aria-hidden="true">🌱</span>
      <p className="empty-neighborhood-title">아직 이 동네 소식이 없어요</p>
      <p className="empty-neighborhood-desc">첫 소식을 남기면 근처 이웃들에게 바로 보여요.</p>
      <button type="button" className="empty-neighborhood-cta" onClick={onOpenQuickPost}>
        ✏️ 첫 소식 남기기
      </button>

      <TrendingFallback
        posts={fallbackPosts}
        onSelectPost={onSelectPost}
        userLocation={userLocation}
        now={now}
      />
    </div>
  )
}

export default EmptyNeighborhood
