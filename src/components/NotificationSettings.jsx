import { useState } from 'react'
import {
  MAX_INTEREST_AREAS,
  DEFAULT_INTEREST_RADIUS_METERS,
  getNotificationPrefs,
  enableNotifications,
  disableNotifications,
  syncNotificationPrefs,
  isPushSupported,
} from '../notifications'

// 로그인 없이 브라우저 알림(Web Push)을 켜고, 관심 지역(최대 MAX_INTEREST_AREAS개)/키워드/
// 조용한 시간을 설정하는 화면. 저장은 매번 notifications.js를 통해 서버(push_subscriptions)와
// localStorage 양쪽에 동기화한다 — 서버는 device_secret으로만 이 기기를 식별한다(로그인 불필요).
function NotificationSettings({ userLocation }) {
  const [prefs, setPrefs] = useState(() => getNotificationPrefs())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [keywordInput, setKeywordInput] = useState('')

  const kakaoReady = Boolean(window.kakao?.maps?.services)
  const supported = isPushSupported()
  const areaLimitReached = prefs.interestAreas.length >= MAX_INTEREST_AREAS

  async function handleToggleEnabled() {
    setError(null)
    setBusy(true)
    try {
      const next = prefs.enabled ? await disableNotifications(prefs) : await enableNotifications(prefs)
      setPrefs(next)
    } catch (err) {
      console.error('[NotificationSettings] 알림 설정 실패', err)
      setError(err.message || '알림 설정에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function persist(nextPrefs) {
    setPrefs(nextPrefs)
    if (!nextPrefs.enabled) return
    try {
      await syncNotificationPrefs(nextPrefs)
    } catch (err) {
      console.error('[NotificationSettings] 설정 동기화 실패', err)
      setError('설정 저장에 실패했어요.')
    }
  }

  function addInterestArea(area) {
    if (areaLimitReached) return
    const nextAreas = [...prefs.interestAreas, { id: crypto.randomUUID(), ...area }]
    persist({ ...prefs, interestAreas: nextAreas })
    setResults([])
    setQuery('')
  }

  function removeInterestArea(id) {
    persist({ ...prefs, interestAreas: prefs.interestAreas.filter((area) => area.id !== id) })
  }

  function addCurrentLocation() {
    if (!userLocation) return
    addInterestArea({
      label: '내 현재 위치',
      lat: userLocation.lat,
      lng: userLocation.lng,
      radiusM: DEFAULT_INTEREST_RADIUS_METERS,
    })
  }

  function handleSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || !kakaoReady) return

    const places = new window.kakao.maps.services.Places()
    places.keywordSearch(trimmed, (data, status) => {
      setResults(status === window.kakao.maps.services.Status.OK ? data.slice(0, 5) : [])
    })
  }

  function addKeyword(event) {
    event.preventDefault()
    const trimmed = keywordInput.trim()
    if (!trimmed || prefs.keywords.includes(trimmed)) return
    persist({ ...prefs, keywords: [...prefs.keywords, trimmed] })
    setKeywordInput('')
  }

  function removeKeyword(keyword) {
    persist({ ...prefs, keywords: prefs.keywords.filter((k) => k !== keyword) })
  }

  function updateQuietHours(patch) {
    persist({ ...prefs, ...patch })
  }

  return (
    <div className="notification-settings">
      {!supported && (
        <p className="notification-settings-unsupported">이 브라우저/기기는 푸시 알림을 지원하지 않아요.</p>
      )}

      <div className="notification-settings-toggle-row">
        <div>
          <p className="notification-settings-toggle-label">브라우저 알림</p>
          <p className="notification-settings-toggle-desc">
            {prefs.enabled
              ? '관심 지역·키워드에 새 글이 올라오면 알려드려요.'
              : '꺼져 있어요. 켜면 알림 권한을 요청해요.'}
          </p>
        </div>
        <button
          type="button"
          className={`notification-settings-switch${prefs.enabled ? ' active' : ''}`}
          role="switch"
          aria-checked={prefs.enabled}
          disabled={!supported || busy}
          onClick={handleToggleEnabled}
        />
      </div>

      {error && <p className="notification-settings-error">{error}</p>}

      <section className="notification-settings-section">
        <h2 className="notification-settings-section-title">
          관심 지역 ({prefs.interestAreas.length}/{MAX_INTEREST_AREAS})
        </h2>

        {prefs.interestAreas.length > 0 && (
          <div className="notification-settings-area-list">
            {prefs.interestAreas.map((area) => (
              <div key={area.id} className="notification-settings-area-chip">
                <span>📍 {area.label}</span>
                <button type="button" onClick={() => removeInterestArea(area.id)} aria-label="삭제">✕</button>
              </div>
            ))}
          </div>
        )}

        {areaLimitReached ? (
          <p className="notification-settings-hint">최대 {MAX_INTEREST_AREAS}개까지 저장할 수 있어요.</p>
        ) : (
          <>
            {userLocation && (
              <button type="button" className="notification-settings-add-current" onClick={addCurrentLocation}>
                📍 내 현재 위치 추가
              </button>
            )}

            {kakaoReady && (
              <form className="place-search-form notification-settings-search-form" onSubmit={handleSearch}>
                <input
                  className="place-search-input"
                  value={query}
                  placeholder="다른 동네 검색 (예: 역삼동)"
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button type="submit" className="place-search-button" aria-label="검색">🔍</button>
              </form>
            )}

            {results.length > 0 && (
              <div className="place-search-results">
                {results.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    className="place-search-result-main"
                    onClick={() => addInterestArea({
                      label: place.place_name,
                      lat: Number(place.y),
                      lng: Number(place.x),
                      radiusM: DEFAULT_INTEREST_RADIUS_METERS,
                    })}
                  >
                    <span className="place-search-result-name">{place.place_name}</span>
                    <span className="place-search-result-address">
                      {place.road_address_name || place.address_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="notification-settings-section">
        <h2 className="notification-settings-section-title">키워드</h2>

        {prefs.keywords.length > 0 && (
          <div className="notification-settings-keyword-list">
            {prefs.keywords.map((keyword) => (
              <span key={keyword} className="notification-settings-keyword-chip">
                {keyword}
                <button type="button" onClick={() => removeKeyword(keyword)} aria-label="삭제">✕</button>
              </span>
            ))}
          </div>
        )}

        <form className="place-search-form notification-settings-search-form" onSubmit={addKeyword}>
          <input
            className="place-search-input"
            value={keywordInput}
            placeholder="예: 맛집, 강아지"
            maxLength={20}
            onChange={(event) => setKeywordInput(event.target.value)}
          />
          <button type="submit" className="place-search-button" aria-label="키워드 추가">＋</button>
        </form>
      </section>

      <section className="notification-settings-section">
        <div className="notification-settings-toggle-row">
          <p className="notification-settings-toggle-label">조용한 시간</p>
          <button
            type="button"
            className={`notification-settings-switch${prefs.quietEnabled ? ' active' : ''}`}
            role="switch"
            aria-checked={prefs.quietEnabled}
            onClick={() => updateQuietHours({ quietEnabled: !prefs.quietEnabled })}
          />
        </div>

        {prefs.quietEnabled && (
          <div className="notification-settings-quiet-row">
            <select
              value={prefs.quietStart}
              onChange={(event) => updateQuietHours({ quietStart: Number(event.target.value) })}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>{hour}시</option>
              ))}
            </select>
            <span>부터</span>
            <select
              value={prefs.quietEnd}
              onChange={(event) => updateQuietHours({ quietEnd: Number(event.target.value) })}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>{hour}시</option>
              ))}
            </select>
            <span>까지 알림 안 보냄</span>
          </div>
        )}
      </section>
    </div>
  )
}

export default NotificationSettings
