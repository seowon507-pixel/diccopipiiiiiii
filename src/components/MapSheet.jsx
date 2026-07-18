import { useState } from 'react'
import CommunityFeed from './CommunityFeed.jsx'
import RealtimeIssueCarousel from './RealtimeIssueCarousel.jsx'
import EmptyNeighborhood from './EmptyNeighborhood.jsx'
import { useDraggableSheet } from '../useDraggableSheet'

const COLLAPSED_PX = 64
const MIDDLE_RATIO = 0.45
const EXPANDED_RATIO = 0.92

function getBreakpoints(containerHeight) {
  return [COLLAPSED_PX, containerHeight * MIDDLE_RATIO, containerHeight * EXPANDED_RATIO]
}

// 지도 위에 겹치는 드래그형 시트(드래그 로직은 useDraggableSheet 공용 훅). 평소엔 화면 중간까지만
// 열려 지도와 목록을 함께 보고, 핸들을 끝까지 위로 끌면 거의 전체, 끝까지 아래로 끌면 핸들만
// 남기고 접힌다. 열었을 때 기본은 실시간 이슈 캐러셀만 먼저 보여주고, "커뮤니티 더보기"를 눌러야
// 자유주제 포함 전체 글 목록(검색/필터/정렬)이 펼쳐진다.
function MapSheet({ posts, activeCategories, onToggleCategory, onSelectPost, fallbackPosts, userLocation, now, onOpenQuickPost }) {
  const [communityExpanded, setCommunityExpanded] = useState(false)
  const { wrapperRef, heightPx, dragging, handlers } = useDraggableSheet({
    getBreakpoints,
    initialIndex: 1,
  })

  const isCollapsed = heightPx <= COLLAPSED_PX + 4
  // 내 주변에 글이 하나도 없으면(콜드 스타트) 실시간 이슈 캐러셀 대신 "첫 소식 남기기" 안내를 보여준다.
  const isEmpty = posts.length === 0

  return (
    <div
      ref={wrapperRef}
      className={`map-sheet${dragging ? ' dragging' : ''}`}
      style={{ height: heightPx }}
    >
      <div className="map-sheet-handle" {...handlers}>
        <span className="map-sheet-handle-bar" />
        {isCollapsed && <span className="map-sheet-handle-label">위로 끌어서 주변 글 보기</span>}
      </div>

      {!isCollapsed && (
        <div className="map-sheet-content">
          {!communityExpanded ? (
            isEmpty ? (
              <EmptyNeighborhood
                onOpenQuickPost={onOpenQuickPost}
                fallbackPosts={fallbackPosts}
                onSelectPost={onSelectPost}
                userLocation={userLocation}
                now={now}
              />
            ) : (
              <>
                <RealtimeIssueCarousel posts={posts} onSelectPost={onSelectPost} />
                <button
                  type="button"
                  className="map-sheet-more-button"
                  onClick={() => setCommunityExpanded(true)}
                >
                  🏘 커뮤니티 더보기
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                className="map-sheet-collapse-button"
                onClick={() => setCommunityExpanded(false)}
              >
                ‹ 접기
              </button>
              <CommunityFeed
                posts={posts}
                activeCategories={activeCategories}
                onToggleCategory={onToggleCategory}
                onSelectPost={onSelectPost}
                fallbackPosts={fallbackPosts}
                userLocation={userLocation}
                now={now}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default MapSheet
