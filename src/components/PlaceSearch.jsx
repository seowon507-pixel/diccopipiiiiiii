import { useEffect, useRef, useState } from 'react'
import AppIcon from './AppIcon.jsx'

// 카카오맵이 활성화된 경우에만 사용하는 장소/건물 검색. kakao.maps.services 라이브러리가 필요하다.
function PlaceSearch({ kakao, kakaoMap, onWriteHere, onSelectPlace }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const searchGenerationRef = useRef(0)

  function closeResults({ restoreFocus = false } = {}) {
    searchGenerationRef.current += 1
    setOpen(false)
    setStatus('idle')
    if (restoreFocus) inputRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return undefined

    function handleMouseDown(event) {
      if (!rootRef.current?.contains(event.target)) closeResults()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') closeResults({ restoreFocus: true })
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function handleSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || !kakao?.maps?.services) return

    const generation = searchGenerationRef.current + 1
    searchGenerationRef.current = generation
    setResults([])
    setStatus('loading')
    setOpen(true)
    const places = new kakao.maps.services.Places()
    places.keywordSearch(trimmed, (data, status) => {
      if (generation !== searchGenerationRef.current) return
      setResults(status === kakao.maps.services.Status.OK ? data.slice(0, 5) : [])
      setStatus('ready')
    })
  }

  function handleSelect(place) {
    const position = new kakao.maps.LatLng(place.y, place.x)
    kakaoMap.setCenter(position)
    kakaoMap.setLevel(4)
    onSelectPlace?.({
      lat: Number(place.y),
      lng: Number(place.x),
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      category: place.category_name ? place.category_name.split(' > ').pop() : null,
      phone: place.phone || null,
      placeUrl: place.place_url || null,
    })
    closeResults()
  }

  function handleWriteHere(event, place) {
    event.stopPropagation()
    onWriteHere(Number(place.y), Number(place.x))
    closeResults()
  }

  return (
    <div ref={rootRef} className="place-search">
      <form className="place-search-form" onSubmit={handleSearch}>
        <input
          ref={inputRef}
          className="place-search-input"
          value={query}
          placeholder="장소, 건물 검색"
          aria-expanded={open}
          aria-controls="place-search-results"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="place-search-button" aria-label="검색">
          <AppIcon name="search" size={18} />
        </button>
      </form>

      {open && (
        <div
          id="place-search-results"
          className="place-search-results"
          role="region"
          aria-label="장소 검색 결과"
        >
          <div className="place-search-results-header">
            <span>{status === 'loading' ? '검색 중' : `검색 결과 ${results.length}개`}</span>
            <button
              type="button"
              className="place-search-results-close"
              aria-label="검색 결과 닫기"
              onClick={() => closeResults({ restoreFocus: true })}
            >
              ×
            </button>
          </div>
          {status === 'loading' && <p className="place-search-empty" role="status">검색 중...</p>}
          {status === 'ready' && results.length === 0 && (
            <p className="place-search-empty">검색 결과가 없어요. 다른 키워드로 찾아볼까요?</p>
          )}
          {status === 'ready' && results.map((place) => (
            <div key={place.id} className="place-search-result">
              <button type="button" className="place-search-result-main" onClick={() => handleSelect(place)}>
                <span className="place-search-result-name">{place.place_name}</span>
                <span className="place-search-result-address">{place.road_address_name || place.address_name}</span>
              </button>
              <button
                type="button"
                className="place-search-write-here"
                onClick={(event) => handleWriteHere(event, place)}
              >
                여기에 글쓰기
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PlaceSearch
