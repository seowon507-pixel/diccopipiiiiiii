import { useEffect, useMemo, useRef, useState } from 'react'
import CommunityFeed from './CommunityFeed.jsx'
import BuildingList from './BuildingList.jsx'
import NotificationSettings from './NotificationSettings.jsx'
import RecoveryCode from './RecoveryCode.jsx'
import AppIcon from './AppIcon.jsx'
import { filterPostsWithinRadius, groupPostsByBuilding, COMMUNITY_RADIUS_METERS } from '../usePosts'
import { getLocationPrivacy, setLocationPrivacy } from '../geoPrivacy'
import { BASE_UI_THEME, getUiThemeMeta, UI_THEME_OPTIONS } from '../uiThemes'

// 하단 커뮤니티 탭(내 주변 500m)과는 별개로, 거리 제한 없는 전체 커뮤니티와
// 검색으로 고른 임의의 위치/건물 반경 커뮤니티를 여기서 볼 수 있다.
function MenuPage({
  posts,
  activeCategories,
  onToggleCategory,
  onSelectPost,
  onOpenCreateModal,
  onOpenQuickPost,
  quickPostDisabled = false,
  active = true,
  uiTheme = BASE_UI_THEME,
  onUiThemeChange,
  userLocation,
  now,
  nickname,
  onSignOut,
}) {
  const [view, setView] = useState('home')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const themeOptionsRef = useRef(null)
  // 위치 보호(현재 위치에 올리는 글/채팅을 대략적 위치로 흐리기) — 기본 ON, 로컬 저장.
  const [locationPrivacy, setLocationPrivacyState] = useState(getLocationPrivacy)

  function toggleLocationPrivacy() {
    const next = !locationPrivacy
    setLocationPrivacy(next)
    setLocationPrivacyState(next)
  }

  const kakaoReady = Boolean(window.kakao?.maps?.services)
  // 이미 글이 있는 건물부터 먼저 보여준다(거리 제한 없음) — 건물을 눌러야 그 자리의
  // 커뮤니티(피드+글쓰기)로 들어간다. 새 장소를 찾고 싶으면 아래 검색을 쓴다.
  const buildings = useMemo(() => groupPostsByBuilding(posts), [posts])
  const activeTheme = getUiThemeMeta(uiTheme)

  // 좁은 화면에서도 현재 선택한 시안이 가로 목록 안에 바로 보이게 맞춘다.
  useEffect(() => {
    if (!active) return
    const container = themeOptionsRef.current
    const activeOption = container?.querySelector('[aria-pressed="true"]')
    if (!container || !activeOption) return

    const containerRect = container.getBoundingClientRect()
    const activeRect = activeOption.getBoundingClientRect()
    const activeLeft = activeRect.left - containerRect.left + container.scrollLeft
    const left = Math.max(0, activeLeft - (container.clientWidth - activeRect.width) / 2)
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ left, behavior: 'auto' })
    } else {
      container.scrollLeft = left
    }
  }, [active, uiTheme])

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
          <header className="menu-hero">
            <span className="menu-hero-mark" aria-hidden="true">동네</span>
            <span className="menu-hero-copy">
              <span className="page-eyebrow">우리동네알림</span>
              <h1 className="menu-page-title">동네 생활판</h1>
              <span className="menu-hero-desc">소식·알림·내 기록을 한곳에서 관리합니다</span>
            </span>
          </header>

          <section className="theme-lab" aria-label="디자인 실험실">
            <div className="theme-lab-summary">
              <span>
                <span className="theme-lab-kicker">DESIGN LAB</span>
                <strong>추가 UI 시안 5종</strong>
              </span>
              <span className="theme-lab-current">
                {activeTheme.number} {activeTheme.name}
              </span>
            </div>
            <div ref={themeOptionsRef} className="theme-lab-options" aria-label="UI 시안 선택">
              {UI_THEME_OPTIONS.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  className="theme-lab-option"
                  data-preview-theme={theme.key}
                  aria-pressed={uiTheme === theme.key}
                  onClick={() => onUiThemeChange?.(theme.key)}
                >
                  <span className="theme-lab-option-topline">
                    <span className="theme-lab-number">{theme.number}</span>
                    <span className="theme-lab-swatches" aria-hidden="true">
                      {theme.swatches.map((color) => (
                        <span key={color} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                  </span>
                  <strong>{theme.name}</strong>
                  <span>{theme.description}</span>
                </button>
              ))}
            </div>
            {uiTheme !== BASE_UI_THEME && (
              <button
                type="button"
                className="theme-lab-reset"
                onClick={() => onUiThemeChange?.(BASE_UI_THEME)}
              >
                02 골목 게시판으로 돌아가기
              </button>
            )}
          </section>

          <button
            type="button"
            className="menu-write-action"
            disabled={quickPostDisabled}
            onClick={onOpenQuickPost}
          >
            <AppIcon name="compose" size={18} />
            지금 이 동네에 기록 남기기
          </button>

          <section className="menu-section" aria-labelledby="menu-explore-title">
            <h2 id="menu-explore-title" className="menu-section-title">동네 둘러보기</h2>
            <div className="menu-card-list">
              <button type="button" className="menu-card" onClick={() => setView('all')}>
                <span className="menu-card-icon menu-card-icon--community"><AppIcon name="globe" size={22} /></span>
                <span className="menu-card-text">
                  <span className="menu-card-label">전체 커뮤니티</span>
                  <span className="menu-card-desc">거리 제한 없이 모든 동네 글을 봐요</span>
                </span>
                <AppIcon name="chevron" size={18} className="menu-card-arrow" />
              </button>
              <button type="button" className="menu-card" onClick={handleOpenLocation}>
                <span className="menu-card-icon menu-card-icon--location"><AppIcon name="location" size={22} /></span>
                <span className="menu-card-text">
                  <span className="menu-card-label">위치·건물별 커뮤니티</span>
                  <span className="menu-card-desc">검색한 장소 반경 500m 글을 봐요</span>
                </span>
                <AppIcon name="chevron" size={18} className="menu-card-arrow" />
              </button>
            </div>
          </section>

          <section className="menu-section" aria-labelledby="menu-manage-title">
            <h2 id="menu-manage-title" className="menu-section-title">내 정보와 안전</h2>
            <div className="menu-card-list">
              <button type="button" className="menu-card" onClick={() => setView('account')}>
                <span className="menu-card-icon"><AppIcon name="user" size={22} /></span>
                <span className="menu-card-text">
                  <span className="menu-card-label">내 계정</span>
                  <span className="menu-card-desc">
                    {nickname ? `${nickname}님으로 로그인 중` : '로그인 정보'}
                  </span>
                </span>
                <AppIcon name="chevron" size={18} className="menu-card-arrow" />
              </button>
              <button type="button" className="menu-card" onClick={() => setView('notifications')}>
                <span className="menu-card-icon menu-card-icon--notification"><AppIcon name="bell" size={22} /></span>
                <span className="menu-card-text">
                  <span className="menu-card-label">알림 설정</span>
                  <span className="menu-card-desc">관심 지역·키워드의 새 소식을 놓치지 않아요</span>
                </span>
                <AppIcon name="chevron" size={18} className="menu-card-arrow" />
              </button>
              <button type="button" className="menu-card" onClick={() => setView('recovery')}>
                <span className="menu-card-icon menu-card-icon--recovery"><AppIcon name="key" size={22} /></span>
                <span className="menu-card-text">
                  <span className="menu-card-label">복구 코드</span>
                  <span className="menu-card-desc">기기를 바꿔도 내 글과 핀을 이어서 관리해요</span>
                </span>
                <AppIcon name="chevron" size={18} className="menu-card-arrow" />
              </button>
              <button
                type="button"
                className="menu-card menu-card--privacy"
                onClick={toggleLocationPrivacy}
                aria-pressed={locationPrivacy}
              >
                <span className="menu-card-icon menu-card-icon--privacy"><AppIcon name="shield" size={22} /></span>
                <span className="menu-card-text">
                  <span className="menu-card-label-row">
                    <span className="menu-card-label">내 위치 보호</span>
                    {locationPrivacy && <span className="menu-card-status">보호 중</span>}
                  </span>
                  <span className="menu-card-desc">
                    {locationPrivacy
                      ? '글·채팅 위치를 동네 수준으로 안전하게 흐려요'
                      : '정확한 현재 위치가 그대로 표시돼요'}
                  </span>
                </span>
                <span className={`menu-card-toggle${locationPrivacy ? ' on' : ''}`} aria-hidden="true">
                  <span className="menu-card-toggle-knob" />
                </span>
              </button>
            </div>
          </section>
        </>
      )}

      {view === 'account' && (
        <>
          <div className="menu-page-header">
            <button type="button" className="menu-back-button" onClick={() => setView('home')}>‹ 메뉴</button>
            <h1 className="menu-page-title">내 계정</h1>
          </div>
          <section className="recovery-section">
            <h2 className="recovery-section-title">닉네임</h2>
            <p className="recovery-section-desc">{nickname}</p>
          </section>
          <button type="button" className="account-signout-button" onClick={onSignOut}>
            로그아웃
          </button>
        </>
      )}

      {view === 'notifications' && (
        <>
          <div className="menu-page-header">
            <button type="button" className="menu-back-button" onClick={() => setView('home')}>‹ 메뉴</button>
            <h1 className="menu-page-title">알림 설정</h1>
          </div>
          <NotificationSettings userLocation={userLocation} />
        </>
      )}

      {view === 'recovery' && (
        <>
          <div className="menu-page-header">
            <button type="button" className="menu-back-button" onClick={() => setView('home')}>‹ 메뉴</button>
            <h1 className="menu-page-title">복구 코드</h1>
          </div>
          <RecoveryCode />
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
            fallbackPosts={posts}
            userLocation={userLocation}
            now={now}
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
                  {results.length === 0 && <p className="place-search-empty">검색 결과가 없어요. 다른 키워드로 찾아볼까요?</p>}
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
                fallbackPosts={posts}
                userLocation={userLocation}
                now={now}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

export default MenuPage
