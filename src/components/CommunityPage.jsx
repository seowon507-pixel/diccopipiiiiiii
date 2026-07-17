import { useMemo, useState } from 'react'
import CommunityFeed from './CommunityFeed.jsx'
import BuildingList from './BuildingList.jsx'
import { groupPostsByBuilding } from '../usePosts'

// 지도와 별도의 전체화면 커뮤니티 탭. 표시 데이터(posts)는 App에서 지도 탭과 공유한다(내 주변 500m).
// 글 목록을 바로 보여주지 않고, 먼저 건물 단위로 묶어 보여준 뒤 건물을 선택해야 그 건물의 글이 나온다.
function CommunityPage({ posts, activeCategories, onToggleCategory, onSelectPost }) {
  const [selectedBuilding, setSelectedBuilding] = useState(null)

  const buildings = useMemo(() => groupPostsByBuilding(posts), [posts])

  if (selectedBuilding) {
    return (
      <div className="community-page">
        <div className="menu-page-header">
          <button type="button" className="menu-back-button" onClick={() => setSelectedBuilding(null)}>
            ‹ 건물 목록
          </button>
        </div>
        <CommunityFeed
          posts={selectedBuilding.posts}
          activeCategories={activeCategories}
          onToggleCategory={onToggleCategory}
          onSelectPost={onSelectPost}
        />
      </div>
    )
  }

  return (
    <div className="community-page">
      <h1 className="community-page-title">커뮤니티</h1>
      <p className="community-page-subtitle">내 주변 500m 이내 건물이에요. 눌러서 글을 봐요.</p>
      <BuildingList buildings={buildings} onSelect={setSelectedBuilding} />
    </div>
  )
}

export default CommunityPage
