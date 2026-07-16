import { useEffect, useState } from 'react'

// 지도를 클릭한 지점의 건물/장소 정보를 먼저 보여주는 가벼운 미리보기.
// 핀은 아직 서버에 생성되지 않은 상태 — "이 위치에 핀 만들기"를 눌러야 실제로 생성된다.
function PlacePreview({ position, kakao, onCreatePin, onViewCommunity, onClose, creatingPin }) {
  const [address, setAddress] = useState(null)
  const [buildingName, setBuildingName] = useState(null)
  const [nearbyPlaceName, setNearbyPlaceName] = useState(null)

  useEffect(() => {
    setAddress(null)
    setBuildingName(null)
    setNearbyPlaceName(null)

    if (!kakao?.maps?.services || !position) return

    try {
      const geocoder = new kakao.maps.services.Geocoder()
      geocoder.coord2Address(position.lng, position.lat, (results, status) => {
        if (status !== kakao.maps.services.Status.OK || !results[0]) return
        const { road_address: roadAddress, address: jibunAddress } = results[0]
        setAddress(roadAddress?.address_name ?? jibunAddress?.address_name ?? null)
        setBuildingName(roadAddress?.building_name || null)
      })

      // 공원 등 이름 있는 장소(관광명소 카테고리)가 근처에 있으면 주소보다 우선해서 보여준다.
      // 카카오맵 JS SDK의 실제 메서드명은 categorySearch다(categorySearchByRadius는 존재하지 않음 — REST API 경로명과 혼동하지 말 것).
      const places = new kakao.maps.services.Places()
      places.categorySearch(
        'AT4',
        (data, status) => {
          if (status === kakao.maps.services.Status.OK && data[0]) {
            setNearbyPlaceName(data[0].place_name)
          }
        },
        {
          location: new kakao.maps.LatLng(position.lat, position.lng),
          radius: 40,
          sort: kakao.maps.services.SortBy.DISTANCE,
        },
      )
    } catch (err) {
      // 장소 정보 조회는 부가 기능이라, 여기서 에러가 나도 핀 생성/커뮤니티 보기는 계속 동작해야 한다.
      console.error('[PlacePreview] 장소 정보 조회 실패', err)
    }
  }, [kakao, position?.lat, position?.lng])

  if (!position) return null

  const displayName = nearbyPlaceName || buildingName

  return (
    <div className="place-preview-backdrop" onClick={onClose}>
      <div className="place-preview" onClick={(event) => event.stopPropagation()}>
        <div className="place-preview-info">
          {displayName && <p className="place-preview-name">{displayName}</p>}
          {address ? (
            <p className="place-preview-address">{address}</p>
          ) : (
            <p className="place-preview-address place-preview-address-empty">
              이 위치의 주소 정보를 찾을 수 없어요.
            </p>
          )}
        </div>

        <button type="button" className="place-preview-action" disabled={creatingPin} onClick={onCreatePin}>
          {creatingPin ? '핀 만드는 중...' : '📌 이 위치에 핀 만들기'}
        </button>
        <button type="button" className="place-preview-action" onClick={onViewCommunity}>
          🏘 커뮤니티 보기
        </button>

        <button type="button" className="place-preview-cancel" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  )
}

export default PlacePreview
