import { useEffect, useState } from 'react'

// 건물(좌표 클러스터) 목록. 카카오맵이 있으면 좌표를 건물명/주소로 역지오코딩해서 보여주고,
// 없으면(placeholder 모드) 순번으로만 구분한다. 클릭해야 그 건물의 글 목록으로 들어간다.
// onSelect(building, info)로 이미 조회된 이름/주소를 함께 넘겨서, 선택한 화면에서 다시
// 지오코딩하지 않아도 되게 한다(CommunityPage/MenuPage가 공유).
function BuildingList({ buildings, onSelect }) {
  const [infoById, setInfoById] = useState({})
  const kakao = typeof window !== 'undefined' ? window.kakao : null

  useEffect(() => {
    if (!kakao?.maps?.services) return

    const geocoder = new kakao.maps.services.Geocoder()
    buildings.forEach((building) => {
      geocoder.coord2Address(building.lng, building.lat, (results, status) => {
        if (status !== kakao.maps.services.Status.OK || !results[0]) return
        const { road_address: roadAddress, address: jibunAddress } = results[0]
        setInfoById((prev) => ({
          ...prev,
          [building.id]: {
            name: roadAddress?.building_name || null,
            address: roadAddress?.address_name ?? jibunAddress?.address_name ?? null,
          },
        }))
      })
    })
  }, [kakao, buildings])

  if (buildings.length === 0) {
    return <p className="community-empty">표시할 건물이 없어요.</p>
  }

  return (
    <div className="building-list">
      {buildings.map((building, index) => {
        const info = infoById[building.id]
        const title = info?.name || info?.address || (kakao?.maps?.services ? '이름을 찾는 중...' : `장소 ${index + 1}`)

        return (
          <button
            key={building.id}
            type="button"
            className="building-card"
            onClick={() => onSelect(building, info)}
          >
            <span className="building-card-text">
              <span className="building-card-name">{title}</span>
              {info?.name && info?.address && (
                <span className="building-card-address">{info.address}</span>
              )}
            </span>
            <span className="building-card-count">글 {building.posts.length}개</span>
          </button>
        )
      })}
    </div>
  )
}

export default BuildingList
