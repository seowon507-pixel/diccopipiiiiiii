import { useEffect, useRef, useState } from 'react'

// 지도를 클릭한 지점의 건물/장소 정보를 먼저 보여주는 가벼운 미리보기.
// 핀은 아직 서버에 생성되지 않은 상태 — "이 위치에 핀 만들기"를 눌러야 실제로 생성된다.
function PlacePreview({ position, kakao, onCreatePin, onViewCommunity, onClose, creatingPin, errorMessage = null }) {
  const [address, setAddress] = useState(null)
  const [buildingName, setBuildingName] = useState(null)
  const [nearbyPlaceName, setNearbyPlaceName] = useState(null)
  const [lookupStatus, setLookupStatus] = useState('idle')
  const dialogRef = useRef(null)
  const firstActionRef = useRef(null)

  useEffect(() => {
    setAddress(null)
    setBuildingName(null)
    setNearbyPlaceName(null)
    setLookupStatus(position ? 'loading' : 'idle')

    if (!position) return undefined
    if (!kakao?.maps?.services) {
      setLookupStatus('unavailable')
      return undefined
    }

    let cancelled = false

    try {
      const geocoder = new kakao.maps.services.Geocoder()
      geocoder.coord2Address(position.lng, position.lat, (results, status) => {
        if (cancelled) return
        if (status !== kakao.maps.services.Status.OK || !results[0]) {
          setLookupStatus('empty')
          return
        }
        const { road_address: roadAddress, address: jibunAddress } = results[0]
        setAddress(roadAddress?.address_name ?? jibunAddress?.address_name ?? null)
        setBuildingName(roadAddress?.building_name || null)
        setLookupStatus('success')
      })

      // 공원 등 이름 있는 장소(관광명소 카테고리)가 근처에 있으면 주소보다 우선해서 보여준다.
      // 카카오맵 JS SDK의 실제 메서드명은 categorySearch다(categorySearchByRadius는 존재하지 않음 — REST API 경로명과 혼동하지 말 것).
      const places = new kakao.maps.services.Places()
      places.categorySearch(
        'AT4',
        (data, status) => {
          if (!cancelled && status === kakao.maps.services.Status.OK && data[0]) {
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
      setLookupStatus('error')
    }
    return () => {
      cancelled = true
    }
  }, [kakao, position?.lat, position?.lng])

  useEffect(() => {
    if (!position) return undefined
    const previousFocus = document.activeElement
    const focusTimer = window.requestAnimationFrame(() => firstActionRef.current?.focus())

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (!creatingPin) onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [position, creatingPin, onClose])

  if (!position) return null

  const displayName = nearbyPlaceName || buildingName

  return (
    <div
      className="place-preview-backdrop"
      onClick={(event) => event.target === event.currentTarget && !creatingPin && onClose()}
    >
      <div
        ref={dialogRef}
        className="place-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-preview-title"
      >
        <div className="place-preview-info">
          <p id="place-preview-title" className="place-preview-name">{displayName || '선택한 위치'}</p>
          {address ? (
            <p className="place-preview-address">{address}</p>
          ) : lookupStatus === 'loading' ? (
            <p className="place-preview-address" role="status">주소를 찾는 중...</p>
          ) : (
            <p className="place-preview-address place-preview-address-empty">
              이 위치의 주소 정보를 찾을 수 없어요.
            </p>
          )}
        </div>

        <button ref={firstActionRef} type="button" className="place-preview-action" disabled={creatingPin} onClick={onCreatePin}>
          {creatingPin ? '핀 만드는 중...' : '📌 이 위치에 핀 만들기'}
        </button>
        <button
          type="button"
          className="place-preview-action"
          disabled={creatingPin}
          onClick={() => onViewCommunity?.({
            lat: position.lat,
            lng: position.lng,
            name: displayName || '선택한 위치',
            address,
          })}
        >
          🏘 커뮤니티 보기
        </button>

        {errorMessage && <p className="dialog-error" role="alert">{errorMessage}</p>}

        <button type="button" className="place-preview-cancel" disabled={creatingPin} onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  )
}

export default PlacePreview
