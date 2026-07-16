import { useState } from 'react'

// 카카오맵이 활성화된 경우에만 사용하는 장소/건물 검색. kakao.maps.services 라이브러리가 필요하다.
function PlaceSearch({ kakao, kakaoMap }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  function handleSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || !kakao?.maps?.services) return

    const places = new kakao.maps.services.Places()
    places.keywordSearch(trimmed, (data, status) => {
      setResults(status === kakao.maps.services.Status.OK ? data.slice(0, 5) : [])
      setOpen(true)
    })
  }

  function handleSelect(place) {
    const position = new kakao.maps.LatLng(place.y, place.x)
    kakaoMap.setCenter(position)
    kakaoMap.setLevel(4)
    setOpen(false)
  }

  return (
    <div className="place-search">
      <form className="place-search-form" onSubmit={handleSearch}>
        <input
          className="place-search-input"
          value={query}
          placeholder="장소, 건물 검색"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="place-search-button" aria-label="검색">
          🔍
        </button>
      </form>

      {open && (
        <div className="place-search-results">
          {results.length === 0 && <p className="place-search-empty">검색 결과가 없어요.</p>}
          {results.map((place) => (
            <button
              key={place.id}
              type="button"
              className="place-search-result"
              onClick={() => handleSelect(place)}
            >
              <span className="place-search-result-name">{place.place_name}</span>
              <span className="place-search-result-address">{place.road_address_name || place.address_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default PlaceSearch
