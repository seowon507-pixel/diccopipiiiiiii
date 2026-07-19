import { useEffect, useRef, useState } from 'react'
import CommunityFeed from './CommunityFeed.jsx'
import RealtimeIssueCarousel from './RealtimeIssueCarousel.jsx'
import EmptyNeighborhood from './EmptyNeighborhood.jsx'
import AppIcon from './AppIcon.jsx'

const COLLAPSED_PX = 64
const MIDDLE_RATIO = 0.45
const EXPANDED_RATIO = 0.92
const TAP_THRESHOLD_PX = 6
const SNAP_LABELS = ['접힘', '중간', '펼침']

// 지도 위에 겹치는 드래그형 시트. 평소엔 화면 중간까지만 열려 지도와 주변 글 목록을 함께 보고,
// 핸들을 끝까지 위로 끌면 목록 전체, 끝까지 아래로 끌면 핸들만 남기고 지도만 보이게 접힌다.
// 핸들을 살짝 탭하기만 해도(드래그 없이) 접힘⇄중간 상태를 토글한다.
function MapSheet({
  posts,
  activeCategories,
  onToggleCategory,
  onSelectPost,
  fallbackPosts,
  userLocation,
  now,
  onOpenQuickPost,
}) {
  const wrapperRef = useRef(null)
  const dragStateRef = useRef(null)
  const [heightPx, setHeightPx] = useState(() => (
    typeof window !== 'undefined' ? window.innerHeight * MIDDLE_RATIO : 320
  ))
  const [dragging, setDragging] = useState(false)
  const [snapIndex, setSnapIndex] = useState(1)
  const [communityExpanded, setCommunityExpanded] = useState(false)

  function getSnapPoints(containerHeight) {
    return [COLLAPSED_PX, containerHeight * MIDDLE_RATIO, containerHeight * EXPANDED_RATIO]
  }

  function moveToSnap(index, containerHeight = wrapperRef.current?.parentElement?.clientHeight) {
    if (!containerHeight) return
    const nextIndex = Math.max(0, Math.min(2, index))
    setSnapIndex(nextIndex)
    setHeightPx(getSnapPoints(containerHeight)[nextIndex])
  }

  useEffect(() => {
    function handleResize() {
      moveToSnap(snapIndex)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [snapIndex])

  function handlePointerDown(event) {
    const containerHeight = wrapperRef.current.parentElement.clientHeight
    dragStateRef.current = {
      startY: event.clientY,
      startHeight: heightPx,
      containerHeight,
      moved: 0,
    }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    const drag = dragStateRef.current
    if (!drag) return

    const delta = drag.startY - event.clientY
    drag.moved = Math.max(drag.moved, Math.abs(delta))

    const next = Math.min(
      drag.containerHeight * EXPANDED_RATIO,
      Math.max(COLLAPSED_PX, drag.startHeight + delta),
    )
    setHeightPx(next)
  }

  function handlePointerUp() {
    const drag = dragStateRef.current
    if (!drag) return

    if (drag.moved < TAP_THRESHOLD_PX) {
      const wasCollapsed = drag.startHeight <= COLLAPSED_PX + 4
      moveToSnap(wasCollapsed ? 1 : 0, drag.containerHeight)
    } else {
      const points = getSnapPoints(drag.containerHeight)
      const nearestIndex = points.reduce(
        (best, point, index) => (Math.abs(point - heightPx) < Math.abs(points[best] - heightPx) ? index : best),
        0,
      )
      moveToSnap(nearestIndex, drag.containerHeight)
    }

    setDragging(false)
    dragStateRef.current = null
  }
  const isCollapsed = heightPx <= COLLAPSED_PX + 4
  // 내 주변에 글이 하나도 없으면(콜드 스타트) 실시간 이슈 캐러셀 대신 "첫 소식 남기기" 안내를 보여준다.
  const isEmpty = posts.length === 0

  function handleKeyDown(event) {
    let nextIndex = null
    if (event.key === 'ArrowUp') nextIndex = snapIndex + 1
    if (event.key === 'ArrowDown') nextIndex = snapIndex - 1
    if (event.key === 'Home' || event.key === 'Escape') nextIndex = 0
    if (event.key === 'End') nextIndex = 2
    if (event.key === 'Enter' || event.key === ' ') nextIndex = snapIndex === 0 ? 1 : 0
    if (nextIndex == null) return
    event.preventDefault()
    moveToSnap(nextIndex)
  }

  return (
    <div
      ref={wrapperRef}
      className={`map-sheet${dragging ? ' dragging' : ''}`}
      style={{ height: heightPx }}
    >
      <button
        type="button"
        className="map-sheet-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        aria-expanded={!isCollapsed}
        aria-controls="map-sheet-content"
        aria-label={`주변 글 시트: ${SNAP_LABELS[snapIndex]}`}
      >
        <span className="map-sheet-handle-bar" aria-hidden="true" />
        {isCollapsed && <span className="map-sheet-handle-label">위로 끌어서 주변 글 보기</span>}
      </button>

      <div id="map-sheet-content" className="map-sheet-content" hidden={isCollapsed}>
        {!isCollapsed && (
          <>
            <div className="map-sheet-heading">
              <span>
                <span className="page-eyebrow">주변 기록</span>
                <strong>{communityExpanded ? '동네 커뮤니티' : '내 주변 소식'}</strong>
              </span>
              <span className="map-sheet-count">{posts.length}개</span>
            </div>
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
                    <AppIcon name="community" size={18} />
                    커뮤니티 전체 보기
                    <AppIcon name="chevron" size={16} />
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
          </>
        )}
      </div>
    </div>
  )
}

export default MapSheet
