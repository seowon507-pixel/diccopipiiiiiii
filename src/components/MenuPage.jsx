import { useMemo, useState } from 'react'
import CommunityFeed from './CommunityFeed.jsx'
import BuildingList from './BuildingList.jsx'
import { filterPostsWithinRadius, groupPostsByBuilding, COMMUNITY_RADIUS_METERS } from '../usePosts'

// 하단 커뮤니티 탭(내 주변 500m)과는 별개로, 거리 제한 없는 전체 커뮤니티와
// 검색으로 고른 임의의 위치/건물 반경 커뮤니티를 여기서 볼 수 있다.
function MenuPage({ posts, activeCategories, onToggleCategory, onSelectPost, onOpenCreateModal }) {
  const [view, setView] = useState('home')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)

  const kakaoReady = Boolean(window.kakao?.maps?.services)
  // 이미 글이 있는 건물부터 먼저 보여준다(거리 제한 없음) — 건물을 눌러야 그 자리의
  // 커뮤니티(피드+글쓰기)로 들어간다. 새 장소를 찾고 싶으면 아래 검색을 쓴다.
  const buildings = useMemo(() => groupPostsByBuilding(posts), [posts])

  function handleOpenLocation() {
    setView('location')
    setSelectedPlace(null)
    setQuery('')
    setResults([])
    setSearched(false)
  }

  function handleSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || !kakaoReady) return

    const places = new window.kakao.maps.services.Places()
    places.keywordSearch(trimmed, (data, status) => {
      setResults(status === window.kakao.maps.services.Status.OK ? data.slice(0, 8) : [])
      setSearched(true)
    })
  }

  function handleSelectPlace(place) {
    setSelectedPlace({
      lat: Number(place.y),
      lng: Number(place.x),
      name: place.place_name,
      address: place.road_address_name || place.address_name,
    })
  }

  // 건물 목록에서 고르면, BuildingList가 이미 조회해둔 이름/주소를 그대로 받아 쓴다(재조회 안 함).
  function handleSelectBuilding(building, info) {
    setSelectedPlace({
      lat: building.lat,
      lng: building.lng,
      name: info?.name ?? null,
      address: info?.address ?? null,
    })
  }

  const locationPosts = selectedPlace
    ? filterPostsWithinRadius(posts, selectedPlace, COMMUNITY_RADIUS_METERS)
    : []

  return (
    <div className="menu-page">
      {view === 'home' && (
        <>
          <h1 className="menu-page-title">메뉴</h1>
          <div className="menu-card-list">
            <button type="button" className="menu-card" onClick={() => setView('all')}>
              <span className="menu-card-icon">🏘</span>
              <span className="menu-card-text">
                <span className="menu-card-label">전체 커뮤니티</span>
                <span className="menu-card-desc">거리 제한 없이 모든 동네 글을 봐요</span>
              </span>
            </button>
            <button type="button" className="menu-card" onClick={handleOpenLocation}>
              <span className="menu-card-icon">📍</span>
              <span className="menu-card-text">
                <span className="menu-card-label">위치·건물별 커뮤니티</span>
                <span className="menu-card-desc">검색한 장소 반경 500m 글을 봐요</span>
              </span>
            </button>
          </div>
        </>
      )}

      {view === 'all' && (
        <>
          <div className="menu-page-header">
            <button type="button" className="menu-back-button" onClick={() => setView('home')}>‹ 메뉴</button>
            <h1 className="menu-page-title">전체 커뮤니티</h1>
          </div>
          <CommunityFeed
            posts={posts}
            activeCategories={activeCategories}
            onToggleCategory={onToggleCategory}
            onSelectPost={onSelectPost}
          />
        </>
      )}

      {view === 'location' && (
        <>
          <div className="menu-page-header">
            <button type="button" className="menu-back-button" onClick={() => setView('home')}>‹ 메뉴</button>
            <h1 className="menu-page-title">위치·건물별 커뮤니티</h1>
          </div>

          {!selectedPlace && buildings.length > 0 && (
            <div className="menu-location-buildings">
              <p className="menu-location-buildings-label">글이 있는 건물</p>
              <BuildingList buildings={buildings} onSelect={handleSelectBuilding} />
            </div>
          )}

          {!kakaoReady && (
            <p className="menu-location-notice">지도 탭을 먼저 한 번 열어야 장소 검색을 쓸 수 있어요.</p>
          )}

          {kakaoReady && !selectedPlace && (
            <div className="menu-location-search">
              <p className="menu-location-buildings-label">다른 장소 찾기</p>
              <form className="place-search-form menu-location-form" onSubmit={handleSearch}>
                <input
                  className="place-search-input"
                  value={query}
                  placeholder="장소, 건물 검색"
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button type="submit" className="place-search-button" aria-label="검색">🔍</button>
              </form>

              {searched && (
                <div className="place-search-results menu-location-results">
                  {results.length === 0 && <p className="place-search-empty">검색 결과가 없어요.</p>}
                  {results.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      className="place-search-result-main menu-location-result"
                      onClick={() => handleSelectPlace(place)}
                    >
                      <span className="place-search-result-name">{place.place_name}</span>
                      <span className="place-search-result-address">
                        {place.road_address_name || place.address_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedPlace && (
            <>
              <div className="menu-location-selected">
                <div className="menu-location-selected-header">
                  <div>
                    <p className="menu-location-selected-name">{selectedPlace.name || '이름을 찾는 중...'}</p>
                    {selectedPlace.address && (
                      <p className="menu-location-selected-address">{selectedPlace.address}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="place-community-write-button"
                    onClick={() => onOpenCreateModal(selectedPlace.lat, selectedPlace.lng)}
                  >
                    ✏️ 글쓰기
                  </button>
                </div>
                <button type="button" className="menu-location-reselect" onClick={() => setSelectedPlace(null)}>
                  다른 장소 검색
                </button>
              </div>
              <CommunityFeed
                posts={locationPosts}
                activeCategories={activeCategories}
                onToggleCategory={onToggleCategory}
                onSelectPost={onSelectPost}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

export default MenuPage
