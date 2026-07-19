import { useEffect, useRef } from 'react'

// 장소검색 결과를 선택했을 때 뜨는 하단 카드. 핀 생성/글쓰기와 무관한 순수 위치 정보 열람용.
function PlaceCard({ place, photos = [], onViewCommunity, onClose }) {
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!place) return undefined
    const previousFocus = document.activeElement
    const focusTimer = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )]
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
  }, [place?.lat, place?.lng])

  if (!place) return null

  return (
    <div
      className="place-card-backdrop"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className="place-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-card-title"
      >
        <div className="place-card-header">
          <div className="place-card-info">
            <p id="place-card-title" className="place-card-name">{place.name}</p>
            {place.category && <p className="place-card-category">{place.category}</p>}
            {place.address && <p className="place-card-address">{place.address}</p>}
            {place.phone && <p className="place-card-phone">📞 {place.phone}</p>}
          </div>
          <button ref={closeButtonRef} type="button" className="place-card-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {photos.length > 0 && (
          <div className="place-card-photos-section">
            <p className="place-card-photos-label">이 장소에 올라온 사진</p>
            <div className="place-card-photos">
              {photos.map((url) => (
                <img key={url} src={url} alt={`${place.name} 사진`} className="place-card-photo" />
              ))}
            </div>
          </div>
        )}

        {place.placeUrl && (
          <a
            className="place-card-kakao-link"
            href={place.placeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            🔗 카카오맵에서 사진·상세정보 보기
          </a>
        )}

        <button type="button" className="place-card-community-button" onClick={onViewCommunity}>
          🏘 이 장소 커뮤니티 보기
        </button>
      </div>
    </div>
  )
}

export default PlaceCard
