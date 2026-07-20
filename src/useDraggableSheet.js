import { useEffect, useRef, useState } from 'react'

const TAP_THRESHOLD_PX = 6

// 드래그형 바텀시트 공용 로직 — 정해진 스냅 높이(breakpoints, 낮은→높은 순 px 배열) 사이를
// 드래그하거나, 핸들을 살짝 탭하면 첫 번째⇄두 번째 스냅으로 토글한다.
// MapSheet(주변 글 목록)와 PostDetail(게시글 상세) 양쪽이 공유한다 — 중복 구현 금지.
//
// getBreakpoints(containerHeight): 컨테이너 실측 높이를 받아 낮은→높은 순 px 배열을 반환.
// initialIndex: 처음 열렸을 때 스냅할 인덱스.
// onDismissBelowMin: 첫 번째(가장 낮은) 스냅보다 한참 아래로 끌어내렸다 놓으면 호출된다(생략하면
// 그냥 최소 높이로 스냅 — PostDetail은 닫기용으로 쓰고, MapSheet는 안 쓴다).
export function useDraggableSheet({ getBreakpoints, initialIndex = 0, onDismissBelowMin }) {
  const wrapperRef = useRef(null)
  const dragStateRef = useRef(null)
  const initializedRef = useRef(false)
  const [heightPx, setHeightPx] = useState(0)
  const [dragging, setDragging] = useState(false)

  function getContainerHeight() {
    return wrapperRef.current?.parentElement?.clientHeight ?? 0
  }

  // 최초 렌더 시 부모 높이를 알아야 스냅 지점을 계산할 수 있어서, 첫 포인터 조작 때 지연 초기화한다.
  function ensureInitialized() {
    if (initializedRef.current) return
    const containerHeight = getContainerHeight()
    if (!containerHeight) return
    const breakpoints = getBreakpoints(containerHeight)
    setHeightPx(breakpoints[initialIndex] ?? breakpoints[0])
    initializedRef.current = true
  }

  // 마운트 시점에 바로 초기 스냅 높이로 열려 있어야 하므로(사용자가 만지기 전에도), 레이아웃이
  // 잡힌 직후 한 번 초기화를 시도한다.
  useEffect(() => {
    ensureInitialized()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePointerDown(event) {
    ensureInitialized()
    const containerHeight = getContainerHeight()
    dragStateRef.current = { startY: event.clientY, startHeight: heightPx, containerHeight, moved: 0 }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    const drag = dragStateRef.current
    if (!drag) return

    const delta = drag.startY - event.clientY
    drag.moved = Math.max(drag.moved, Math.abs(delta))

    const breakpoints = getBreakpoints(drag.containerHeight)
    const min = breakpoints[0]
    const max = breakpoints[breakpoints.length - 1]
    // 닫기 제스처가 있는 시트는 최소 스냅보다 더 아래로 끌 수 있게(닫기 여부 판단용) 살짝 여유를 준다.
    const floor = onDismissBelowMin ? min * 0.45 : min
    setHeightPx(Math.min(max, Math.max(floor, drag.startHeight + delta)))
  }

  function handlePointerUp() {
    const drag = dragStateRef.current
    if (!drag) return
    const breakpoints = getBreakpoints(drag.containerHeight)
    const min = breakpoints[0]

    if (drag.moved < TAP_THRESHOLD_PX) {
      // 살짝 탭: 첫 번째(미리보기/접힘) ⇄ 두 번째(중간) 스냅만 토글한다.
      const wasAtMin = drag.startHeight <= min + 4
      setHeightPx(wasAtMin ? (breakpoints[1] ?? breakpoints[0]) : min)
    } else if (onDismissBelowMin && heightPx < min * 0.75) {
      onDismissBelowMin()
    } else {
      const nearest = breakpoints.reduce((a, b) => (Math.abs(b - heightPx) < Math.abs(a - heightPx) ? b : a))
      setHeightPx(nearest)
    }

    setDragging(false)
    dragStateRef.current = null
  }

  return {
    wrapperRef,
    heightPx,
    dragging,
    ensureInitialized,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  }
}
