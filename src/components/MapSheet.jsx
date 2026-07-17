import { useRef, useState } from 'react'
import CommunityFeed from './CommunityFeed.jsx'

const COLLAPSED_PX = 64
const MIDDLE_RATIO = 0.45
const EXPANDED_RATIO = 0.92
const TAP_THRESHOLD_PX = 6

// 지도 위에 겹치는 드래그형 시트. 평소엔 화면 중간까지만 열려 지도와 주변 글 목록을 함께 보고,
// 핸들을 끝까지 위로 끌면 목록 전체, 끝까지 아래로 끌면 핸들만 남기고 지도만 보이게 접힌다.
// 핸들을 살짝 탭하기만 해도(드래그 없이) 접힘⇄중간 상태를 토글한다.
function MapSheet({ posts, activeCategories, onToggleCategory, onSelectPost }) {
  const wrapperRef = useRef(null)
  const dragStateRef = useRef(null)
  const [heightPx, setHeightPx] = useState(() => (
    typeof window !== 'undefined' ? window.innerHeight * MIDDLE_RATIO : 320
  ))
  const [dragging, setDragging] = useState(false)

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
      setHeightPx(wasCollapsed ? drag.containerHeight * MIDDLE_RATIO : COLLAPSED_PX)
    } else {
      const points = [COLLAPSED_PX, drag.containerHeight * MIDDLE_RATIO, drag.containerHeight * EXPANDED_RATIO]
      const nearest = points.reduce((a, b) => (Math.abs(b - heightPx) < Math.abs(a - heightPx) ? b : a))
      setHeightPx(nearest)
    }

    setDragging(false)
    dragStateRef.current = null
  }

  const isCollapsed = heightPx <= COLLAPSED_PX + 4

  return (
    <div
      ref={wrapperRef}
      className={`map-sheet${dragging ? ' dragging' : ''}`}
      style={{ height: heightPx }}
    >
      <div
        className="map-sheet-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="map-sheet-handle-bar" />
        {isCollapsed && <span className="map-sheet-handle-label">위로 끌어서 주변 글 보기</span>}
      </div>

      {!isCollapsed && (
        <div className="map-sheet-content">
          <CommunityFeed
            posts={posts}
            activeCategories={activeCategories}
            onToggleCategory={onToggleCategory}
            onSelectPost={onSelectPost}
          />
        </div>
      )}
    </div>
  )
}

export default MapSheet
