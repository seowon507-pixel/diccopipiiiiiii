// 화면 픽셀 좌표 기준 그리드 클러스터링 — 카카오맵 모드(실제 화면 픽셀)와 placeholder 모드
// (가상 뷰포트를 퍼센트→픽셀로 환산한 좌표) 양쪽에서 공유한다. 지도 SDK와 무관한 순수 함수라
// 두 모드가 각자 다시 구현할 필요가 없다.
//
// items: [{ id, x, y, ...아무 데이터 }] — x/y는 이미 화면 픽셀 좌표로 투영된 값이어야 한다.
// cellSizePx: 이 거리(픽셀) 안에 있는 마커끼리 하나의 클러스터로 묶는다.
//
// 반환: [{ type: 'single', item, x, y } | { type: 'cluster', items, x, y, count }]
export function clusterByScreenPosition(items, cellSizePx) {
  const cells = new Map()

  items.forEach((item) => {
    const cellX = Math.floor(item.x / cellSizePx)
    const cellY = Math.floor(item.y / cellSizePx)
    const key = `${cellX}:${cellY}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(item)
  })

  return Array.from(cells.values()).map((group) => {
    if (group.length === 1) {
      const [only] = group
      return { type: 'single', item: only.item, x: only.x, y: only.y }
    }

    const avgX = group.reduce((sum, g) => sum + g.x, 0) / group.length
    const avgY = group.reduce((sum, g) => sum + g.y, 0) / group.length
    return {
      type: 'cluster',
      items: group.map((g) => g.item),
      x: avgX,
      y: avgY,
      count: group.length,
    }
  })
}

// 클러스터 마커 크기 단계 — 묶인 글 개수에 따라 원 크기를 3단계로 키운다.
export function getClusterTier(count) {
  if (count >= 50) return 'large'
  if (count >= 10) return 'medium'
  return 'small'
}
