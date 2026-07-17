// 카카오 Geocoder.coord2Address를 Promise로 감싼 공용 헬퍼. 좌표 → 동네명/주소 조회가 필요한
// 곳(지도 상단 동네명 표시 등)에서 쓴다. BuildingList.jsx/PlacePreview.jsx는 각자 다른 부가 조회
// (여러 건물 순회, 근처 장소 검색)가 섞여 있어 그대로 두고, 새로 필요한 단순 조회만 여기로 통일한다.
export function reverseGeocodeDong(kakao, lat, lng) {
  return new Promise((resolve) => {
    if (!kakao?.maps?.services) {
      resolve(null)
      return
    }

    try {
      const geocoder = new kakao.maps.services.Geocoder()
      geocoder.coord2Address(lng, lat, (results, status) => {
        if (status !== kakao.maps.services.Status.OK || !results[0]) {
          resolve(null)
          return
        }
        const { road_address: roadAddress, address: jibunAddress } = results[0]
        const dong = jibunAddress?.region_3depth_name || roadAddress?.region_3depth_name || null
        resolve(dong)
      })
    } catch (err) {
      console.error('[geocode] 동네명 조회 실패', err)
      resolve(null)
    }
  })
}
