import { useRef, useState } from 'react'

const DRAG_CLOSE_THRESHOLD_PX = 80

// 하단에서 올라오는 시트. 손잡이를 탭하거나 아래로 드래그해서 접고 펼 수 있다.
function BottomSheet({ open, onToggle, children }) {
  const dragStateRef = useRef({ dragging: false, startY: 0 })
  const [dragOffset, setDragOffset] = useState(0)

  function handlePointerDown(event) {
    dragStateRef.current = { dragging: true, startY: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    if (!dragStateRef.current.dragging) return
    const delta = event.clientY - dragStateRef.current.startY
    setDragOffset(open ? Math.max(0, delta) : Math.min(0, delta))
  }

  function handlePointerUp() {
    if (!dragStateRef.current.dragging) return
    dragStateRef.current.dragging = false

    if (open && dragOffset > DRAG_CLOSE_THRESHOLD_PX) {
      onToggle(false)
    } else if (!open && dragOffset < -DRAG_CLOSE_THRESHOLD_PX) {
      onToggle(true)
    }
    setDragOffset(0)
  }

  function handleHandleClick() {
    if (dragOffset === 0) onToggle(!open)
  }

  return (
    <div
      className={`bottom-sheet${open ? ' open' : ' collapsed'}`}
      style={dragOffset !== 0 ? { transform: `translateY(${dragOffset}px)`, transition: 'none' } : undefined}
    >
      <div
        className="bottom-sheet-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleHandleClick}
      >
        <span className="bottom-sheet-handle-bar" />
        <span className="bottom-sheet-handle-label">{open ? '지도 보기 ▾' : '커뮤니티 보기 ▴'}</span>
      </div>

      {open && <div className="bottom-sheet-content">{children}</div>}
    </div>
  )
}

export default BottomSheet
