import CommunityFeed from './CommunityFeed.jsx'

// 지도와 별도의 전체화면 커뮤니티 탭. 표시 데이터(posts)는 App에서 지도 탭과 공유한다.
function CommunityPage({ posts, activeCategories, onToggleCategory, onSelectPost }) {
  return (
    <div className="community-page">
      <h1 className="community-page-title">커뮤니티</h1>
      <CommunityFeed
        posts={posts}
        activeCategories={activeCategories}
        onToggleCategory={onToggleCategory}
        onSelectPost={onSelectPost}
      />
    </div>
  )
}

export default CommunityPage
