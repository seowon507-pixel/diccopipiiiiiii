import { useEffect, useMemo, useState } from 'react'
import CommunityFeed from './CommunityFeed.jsx'
import BuildingList from './BuildingList.jsx'
import { COMMUNITY_RADIUS_METERS, filterPostsWithinRadius, groupPostsByBuilding } from '../usePosts'

// 지도와 별도의 전체화면 커뮤니티 탭. 표시 데이터(posts)는 App에서 지도 탭과 공유한다(내 주변 500m).
// 글 목록을 바로 보여주지 않고, 먼저 건물 단위로 묶어 보여준 뒤 건물을 선택해야 그 건물의 글이 나온다.
function CommunityPage({
  posts = [],
  userLocation = null,
  isLocationTrusted = false,
  locationStatus = 'loading',
  communityTarget = null,
  onResetTarget,
  postsStatus = 'success',
  postsError = null,
  onRetry,
  onWrite,
  activeCategories,
  onToggleCategory,
  onEnableAllCategories,
  onSelectPost,
}) {
  const [selectedBuildingId, setSelectedBuildingId] = useState(null)

  const center = communityTarget ?? userLocation
  const scopedPosts = useMemo(
    () => (center ? filterPostsWithinRadius(posts, center, COMMUNITY_RADIUS_METERS) : posts),
    [posts, center],
  )

  const buildings = useMemo(() => groupPostsByBuilding(scopedPosts), [scopedPosts])
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null

  useEffect(() => {
    setSelectedBuildingId(null)
  }, [communityTarget?.lat, communityTarget?.lng])

  useEffect(() => {
    if (selectedBuildingId && !selectedBuilding) setSelectedBuildingId(null)
  }, [selectedBuildingId, selectedBuilding])

  const targetLabel = communityTarget?.name || communityTarget?.address || '선택한 위치'
  const resolvedPostsError = typeof postsError === 'string' ? postsError : postsError?.message

  if (communityTarget) {
    return (
      <div className="community-page">
        <div className="community-location-header">
          <div>
            <h1 className="community-page-title">{targetLabel}</h1>
            <p className="community-page-subtitle">선택한 위치 반경 500m 글이에요.</p>
          </div>
          {onResetTarget && (
            <button type="button" className="community-reset-location" onClick={onResetTarget}>
              내 주변으로
            </button>
          )}
        </div>
        <CommunityFeed
          posts={scopedPosts}
          activeCategories={activeCategories}
          onToggleCategory={onToggleCategory}
          onSelectPost={onSelectPost}
          status={postsStatus}
          errorMessage={resolvedPostsError}
          onRetry={onRetry}
          onWrite={onWrite && center ? () => onWrite(center.lat, center.lng) : undefined}
          contextLabel={targetLabel}
        />
      </div>
    )
  }

  if (selectedBuilding) {
    return (
      <div className="community-page">
        <div className="menu-page-header">
          <button type="button" className="menu-back-button" onClick={() => setSelectedBuildingId(null)}>
            ‹ 건물 목록
          </button>
        </div>
        <CommunityFeed
          posts={selectedBuilding.posts}
          activeCategories={activeCategories}
          onToggleCategory={onToggleCategory}
          onSelectPost={onSelectPost}
          status={postsStatus}
          errorMessage={resolvedPostsError}
          onRetry={onRetry}
          onWrite={onWrite ? () => onWrite(selectedBuilding.lat, selectedBuilding.lng) : undefined}
          contextLabel="이 건물"
        />
      </div>
    )
  }

  return (
    <div className="community-page">
      <h1 className="community-page-title">커뮤니티</h1>
      <p className="community-page-subtitle">
        {isLocationTrusted
          ? '내 주변 500m 이내 건물이에요. 눌러서 글을 봐요.'
          : locationStatus === 'loading'
            ? '현재 위치를 확인하고 있어요.'
            : '위치를 확인하지 못해 서울시청 기준 500m를 보여드려요.'}
      </p>
      {postsStatus === 'error' || resolvedPostsError ? (
        <div className="community-empty-state" role="alert">
          <p>{resolvedPostsError || '게시글을 불러오지 못했어요.'}</p>
          {onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}
        </div>
      ) : postsStatus === 'loading' ? (
        <p className="community-empty" role="status">건물 목록을 불러오는 중...</p>
      ) : activeCategories?.size === 0 ? (
        <div className="community-empty-state">
          <p>모든 카테고리가 꺼져 있어 건물을 표시할 수 없어요.</p>
          {onEnableAllCategories && (
            <button type="button" onClick={onEnableAllCategories}>모든 카테고리 켜기</button>
          )}
        </div>
      ) : (
        <BuildingList buildings={buildings} onSelect={(building) => setSelectedBuildingId(building.id)} />
      )}
    </div>
  )
}

export default CommunityPage
