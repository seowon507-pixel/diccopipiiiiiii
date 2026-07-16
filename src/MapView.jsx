import { useEffect, useMemo, useRef, useState } from 'react'
import { getPosts, createPost, updatePost, incrementConfirmCount, subscribeToPostChanges } from './supabaseClient'
import { CATEGORIES, CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, CATEGORY_VALID_MINUTES, DEFAULT_VALID_MINUTES } from './categories'
import { getDistanceMeters } from './geo'
import { findNearbyDuplicate, saveLastPost } from './abuseCheck'
import PostModal from './components/PostModal.jsx'
import CategoryFilter from './components/CategoryFilter.jsx'

const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY

// 위치 권한이 없거나 실패하면 서울시청 좌표로 대체한다.
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 }
// 개발 모드 전용: 시드 데이터가 위치한 동네 중심. 실제 기기 위치와 무관하게 마커를 볼 수 있도록 강제한다.
const DEV_LOCATION_OVERRIDE = { lat: 37.5575, lng: 126.9251 }
const NEARBY_RADIUS_METERS = 1000
// placeholder 가상 뷰포트는 필터 반경보다 조금 더 넉넉하게 잡는다.
const PLACEHOLDER_VIEWPORT_RADIUS_METERS = 1300

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10
const NEAR_EXPIRY_RATIO = 0.7
const NEAR_EXPIRY_OPACITY = 0.45
const TICK_INTERVAL_MS = 30 * 1000

function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
}

function loadKakaoMapScript(appKey) {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve(window.kakao)
      return
    }

    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function formatPostTime(createdAt) {
  return new Date(createdAt).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ))
}

// 카테고리 유효시간 대비 경과 비율. 1 이상이면 만료된 것으로 본다.
function getElapsedRatio(post, referenceTime) {
  const validMinutes = CATEGORY_VALID_MINUTES[post.category] ?? DEFAULT_VALID_MINUTES
  const validMs = validMinutes * 60 * 1000
  const elapsedMs = referenceTime - new Date(post.created_at).getTime()
  return elapsedMs / validMs
}

function getMarkerOpacity(post, referenceTime) {
  return getElapsedRatio(post, referenceTime) >= NEAR_EXPIRY_RATIO ? NEAR_EXPIRY_OPACITY : 1
}

// 중심 좌표 기준 반경(m)을 위도/경도 델타로 변환해 placeholder 가상 뷰포트 범위를 만든다.
function getPlaceholderBounds(center) {
  const latDelta = PLACEHOLDER_VIEWPORT_RADIUS_METERS / 111320
  const lngDelta = PLACEHOLDER_VIEWPORT_RADIUS_METERS / (111320 * Math.cos((center.lat * Math.PI) / 180))

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  }
}

function createKakaoMarkerImage(kakao, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">`
    + `<circle cx="14" cy="14" r="10" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`
  const src = `data:image/svg+xml;base64,${btoa(svg)}`
  return new kakao.maps.MarkerImage(src, new kakao.maps.Size(28, 28))
}

function buildInfoWindowHtml(post) {
  const isEdited = Boolean(post.updated_at)
  const timeLabel = formatPostTime(post.updated_at ?? post.created_at)
  const editedBadge = isEdited
    ? ' <span style="color:#a6763a;font-size:11px;font-weight:600;">(수정됨)</span>'
    : ''

  return `
    <div style="padding:8px 10px;font-size:13px;max-width:200px;line-height:1.4;">
      <strong>${escapeHtml(post.category)}</strong>
      <p style="margin:4px 0;">${escapeHtml(post.content)}${editedBadge}</p>
      <span style="color:#888;font-size:12px;">${timeLabel}</span>
      <button
        type="button"
        data-confirm-button
        style="display:block;margin-top:6px;width:100%;padding:6px 0;border:none;border-radius:6px;background:#2e7d6b;color:#fff;font-size:12px;cursor:pointer;"
      >아직 그런가요? (${post.confirm_count})</button>
    </div>
  `
}

// placeholder 모드 전용: lat/lng을 뷰포트 bounds 안에서 컨테이너 상대 좌표(%)로 변환한다.
// 실제 지도가 아니므로 위치는 근사치이며, 카카오맵 연동 후에는 사용되지 않는다.
function projectToPercent(posts, bounds) {
  const positions = new Map()
  const { minLat, maxLat, minLng, maxLng } = bounds
  const latSpan = maxLat - minLat
  const lngSpan = maxLng - minLng

  posts.forEach((post) => {
    const xRatio = (post.lng - minLng) / lngSpan
    const yRatio = (post.lat - minLat) / latSpan
    positions.set(post.id, {
      x: xRatio * 100,
      y: (1 - yRatio) * 100,
    })
  })

  return positions
}

// placeholder 컨테이너 안의 클릭 좌표(px)를 bounds 기준 lat/lng으로 역변환한다.
function placeholderPointToLatLng(container, clientX, clientY, bounds) {
  const rect = container.getBoundingClientRect()
  const xRatio = (clientX - rect.left) / rect.width
  const yRatio = (clientY - rect.top) / rect.height
  const { minLat, maxLat, minLng, maxLng } = bounds

  return {
    lat: maxLat - yRatio * (maxLat - minLat),
    lng: minLng + xRatio * (maxLng - minLng),
  }
}

function isMarkerOrInfoWindowTarget(target) {
  return Boolean(target?.closest?.('.map-marker, .map-infowindow'))
}

function MapView() {
  const mapContainerRef = useRef(null)
  const kakaoMapRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const lastTouchTimeRef = useRef(0)

  const [posts, setPosts] = useState([])
  const [selectedPostId, setSelectedPostId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingPosition, setPendingPosition] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [confirmingPostId, setConfirmingPostId] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  // null이면 새 글 작성, 값이 있으면 해당 게시글 수정 모드
  const [editTarget, setEditTarget] = useState(null)

  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationDenied, setLocationDenied] = useState(false)

  // 기본은 전체 카테고리 켜짐
  const [activeCategories, setActiveCategories] = useState(() => new Set(CATEGORIES))

  function toggleCategory(name) {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    getPosts().then((data) => {
      if (!cancelled) setPosts(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 사용자 위치를 한 번 조회해서 지도 중심으로 쓴다. 실패/거부 시 서울시청으로 대체한다.
  useEffect(() => {
    // 개발 모드에서는 실제 기기 위치와 무관하게 시드 데이터 동네를 강제로 사용한다 (프로덕션 빌드에는 영향 없음).
    if (import.meta.env.DEV) {
      setUserLocation(DEV_LOCATION_OVERRIDE)
      setLocationLoading(false)
      return
    }

    if (!navigator.geolocation) {
      setUserLocation(SEOUL_CITY_HALL)
      setLocationDenied(true)
      setLocationLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationLoading(false)
      },
      () => {
        setUserLocation(SEOUL_CITY_HALL)
        setLocationDenied(true)
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }, [])

  // 유효시간 경과율(반투명/만료)을 주기적으로 재계산하기 위한 시계
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // 다른 사용자가 등록/수정한 게시글을 실시간으로 반영한다.
  useEffect(() => {
    const unsubscribe = subscribeToPostChanges({
      onInsert: (newPost) => {
        setPosts((prev) => (prev.some((post) => post.id === newPost.id) ? prev : [newPost, ...prev]))
      },
      onUpdate: (updatedPost) => {
        setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? { ...post, ...updatedPost } : post)))
      },
    })
    return unsubscribe
  }, [])

  // 카테고리 필터가 켜져 있고, 만료되지 않고, 사용자 위치 반경 1km 이내인 게시글만 남긴다.
  const nearbyPosts = useMemo(() => {
    if (!userLocation) return []

    return posts.filter((post) => {
      if (!activeCategories.has(post.category)) return false
      if (getElapsedRatio(post, now) >= 1) return false
      const distance = getDistanceMeters(userLocation.lat, userLocation.lng, post.lat, post.lng)
      return distance <= NEARBY_RADIUS_METERS
    })
  }, [posts, now, userLocation, activeCategories])

  // 카카오맵 초기화. 키가 없거나(placeholder 상태) 위치가 아직 없으면 실행하지 않는다.
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !mapContainerRef.current || !userLocation) return

    let cancelled = false

    loadKakaoMapScript(KAKAO_MAP_KEY).then((kakao) => {
      if (cancelled) return

      const map = new kakao.maps.Map(mapContainerRef.current, {
        center: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
        level: 4,
      })
      kakaoMapRef.current = map
      infoWindowRef.current = new kakao.maps.InfoWindow({ removable: true })

      // 데스크톱(마우스)만 클릭으로 작성 모달을 연다. 모바일은 아래 터치 핸들러의 롱프레스로 처리한다.
      if (!isTouchDevice()) {
        kakao.maps.event.addListener(map, 'click', (mouseEvent) => {
          openCreateModal(mouseEvent.latLng.getLat(), mouseEvent.latLng.getLng())
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [userLocation])

  // nearbyPosts가 바뀔 때마다 카카오맵 마커를 다시 그린다.
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !kakaoMapRef.current) return
    const kakao = window.kakao

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = nearbyPosts.map((post) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(post.lat, post.lng),
        map: kakaoMapRef.current,
        image: createKakaoMarkerImage(kakao, CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR),
        opacity: getMarkerOpacity(post, now),
      })

      kakao.maps.event.addListener(marker, 'click', () => {
        infoWindowRef.current.setContent(buildInfoWindowHtml(post))
        infoWindowRef.current.open(kakaoMapRef.current, marker)

        // kakao InfoWindow는 순수 HTML이라 React 이벤트가 닿지 않는다. DOM에서 버튼을 직접 찾아 붙인다.
        requestAnimationFrame(() => {
          const button = document.querySelector('[data-confirm-button]')
          if (!button) return
          button.onclick = () => {
            button.disabled = true
            button.textContent = '확인 중...'
            handleConfirm(post).finally(() => {
              if (button.isConnected) button.textContent = '확인했어요'
            })
          }
        })
      })

      return marker
    })
  }, [nearbyPosts, now])

  // 5분 이내 반경 50m 안에 내가 쓴 글이 있으면 새 글 대신 그 글을 수정하도록 연다.
  function openCreateModal(lat, lng) {
    setSubmitError(null)
    setPendingPosition({ lat, lng })

    const duplicate = findNearbyDuplicate(lat, lng)
    const existingPost = duplicate ? posts.find((post) => post.id === duplicate.id) : null

    if (existingPost) {
      setEditTarget({
        id: existingPost.id,
        lat: existingPost.lat,
        lng: existingPost.lng,
        category: existingPost.category,
        content: existingPost.content,
      })
    } else {
      setEditTarget(null)
    }

    setModalOpen(true)
  }

  function closeCreateModal() {
    setModalOpen(false)
    setPendingPosition(null)
    setSubmitError(null)
    setEditTarget(null)
  }

  async function handleSubmitPost({ category, content }) {
    if (!pendingPosition) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      if (editTarget) {
        await updatePost(editTarget.id, { category, content })
        saveLastPost({ id: editTarget.id, lat: editTarget.lat, lng: editTarget.lng })
      } else {
        const created = await createPost({ lat: pendingPosition.lat, lng: pendingPosition.lng, category, content })
        saveLastPost({ id: created.id, lat: pendingPosition.lat, lng: pendingPosition.lng })
      }
      closeCreateModal()
    } catch (err) {
      console.error('[MapView] 게시글 저장 실패', err)
      setSubmitError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  // "아직 그런가요?" 확인 시 confirm_count를 1 증가시킨다. 화면 반영은 realtime UPDATE로 처리한다.
  async function handleConfirm(post) {
    if (confirmingPostId === post.id) return

    setConfirmingPostId(post.id)
    try {
      await incrementConfirmCount(post.id, post.confirm_count)
    } catch (err) {
      console.error('[MapView] confirm_count 갱신 실패', err)
    } finally {
      setConfirmingPostId(null)
    }
  }

  // ---- placeholder 클릭 / 롱프레스 ----

  function handlePlaceholderClick(event, bounds) {
    if (isMarkerOrInfoWindowTarget(event.target)) return
    // 터치 후 브라우저가 자동 발생시키는 synthetic click은 무시한다 (모바일은 롱프레스로만 연다).
    if (Date.now() - lastTouchTimeRef.current < 700) return

    const { lat, lng } = placeholderPointToLatLng(event.currentTarget, event.clientX, event.clientY, bounds)
    openCreateModal(lat, lng)
  }

  function handlePlaceholderTouchStart(event, bounds) {
    if (isMarkerOrInfoWindowTarget(event.target)) return

    const touch = event.touches[0]
    const touchX = touch.clientX
    const touchY = touch.clientY
    const container = event.currentTarget

    touchStartRef.current = { x: touchX, y: touchY }
    lastTouchTimeRef.current = Date.now()

    longPressTimerRef.current = setTimeout(() => {
      const { lat, lng } = placeholderPointToLatLng(container, touchX, touchY, bounds)
      openCreateModal(lat, lng)
    }, LONG_PRESS_MS)
  }

  // ---- 카카오맵 롱프레스 (모바일) ----

  function handleKakaoTouchStart(event) {
    if (!kakaoMapRef.current) return

    const touch = event.touches[0]
    const touchX = touch.clientX
    const touchY = touch.clientY
    const container = event.currentTarget

    touchStartRef.current = { x: touchX, y: touchY }

    longPressTimerRef.current = setTimeout(() => {
      const kakao = window.kakao
      const rect = container.getBoundingClientRect()
      const point = new kakao.maps.Point(touchX - rect.left, touchY - rect.top)
      const coords = kakaoMapRef.current.getProjection().coordsFromContainerPoint(point)
      openCreateModal(coords.getLat(), coords.getLng())
    }, LONG_PRESS_MS)
  }

  function handleTouchMove(event) {
    const touch = event.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearTimeout(longPressTimerRef.current)
    }
  }

  function handleTouchEnd() {
    clearTimeout(longPressTimerRef.current)
    lastTouchTimeRef.current = Date.now()
  }

  const locationBanner = locationDenied && (
    <div className="location-banner" role="status">
      위치 접근이 거부되어 서울시청 기준 위치로 표시하고 있어요.
    </div>
  )

  if (locationLoading) {
    return (
      <div className="map-placeholder" role="status" aria-label="위치 확인 중">
        <span className="map-placeholder-label">위치 확인 중...</span>
      </div>
    )
  }

  // 카카오맵 키가 .env에 채워지기 전까지는 placeholder 위에 마커/인포윈도우/작성 흐름을 흉내낸다.
  if (!KAKAO_MAP_KEY) {
    const bounds = getPlaceholderBounds(userLocation)
    const positions = projectToPercent(nearbyPosts, bounds)
    const selectedPost = nearbyPosts.find((post) => post.id === selectedPostId)
    const selectedPosition = selectedPostId ? positions.get(selectedPostId) : null

    return (
      <>
        {locationBanner}
        <div className="map-view">
          <CategoryFilter activeCategories={activeCategories} onToggle={toggleCategory} />
          <div
            className="map-placeholder"
            role="img"
            aria-label="지도 영역 placeholder"
            onClick={(event) => handlePlaceholderClick(event, bounds)}
            onTouchStart={(event) => handlePlaceholderTouchStart(event, bounds)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="map-placeholder-label">지도 영역</span>

            {nearbyPosts.map((post) => {
              const position = positions.get(post.id)
              if (!position) return null

              return (
                <button
                  key={post.id}
                  type="button"
                  className="map-marker"
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    backgroundColor: CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR,
                    opacity: getMarkerOpacity(post, now),
                  }}
                  aria-label={`${post.category} 게시글`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedPostId(post.id)
                  }}
                />
              )
            })}

            {selectedPost && selectedPosition && (
              <div
                className="map-infowindow"
                style={{ left: `${selectedPosition.x}%`, top: `${selectedPosition.y}%` }}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="map-infowindow-close"
                  aria-label="닫기"
                  onClick={() => setSelectedPostId(null)}
                >
                  ×
                </button>
                <p
                  className="map-infowindow-category"
                  style={{ color: CATEGORY_COLORS[selectedPost.category] ?? DEFAULT_CATEGORY_COLOR }}
                >
                  {selectedPost.category}
                </p>
                <p className="map-infowindow-content">
                  {selectedPost.content}
                  {selectedPost.updated_at && <span className="map-infowindow-edited-badge"> (수정됨)</span>}
                </p>
                <p className="map-infowindow-time">
                  {formatPostTime(selectedPost.updated_at ?? selectedPost.created_at)}
                </p>
                <button
                  type="button"
                  className="map-infowindow-confirm"
                  disabled={confirmingPostId === selectedPost.id}
                  onClick={() => handleConfirm(selectedPost)}
                >
                  {confirmingPostId === selectedPost.id ? '확인 중...' : `아직 그런가요? (${selectedPost.confirm_count})`}
                </button>
              </div>
            )}
          </div>

          <PostModal
            open={modalOpen}
            submitting={submitting}
            errorMessage={submitError}
            isEditing={Boolean(editTarget)}
            initialCategory={editTarget?.category ?? null}
            initialContent={editTarget?.content ?? ''}
            onSubmit={handleSubmitPost}
            onClose={closeCreateModal}
          />
        </div>
      </>
    )
  }

  return (
    <>
      {locationBanner}
      <div className="map-view">
        <CategoryFilter activeCategories={activeCategories} onToggle={toggleCategory} />
        <div
          ref={mapContainerRef}
          className="map-container"
          onTouchStart={handleKakaoTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onContextMenu={(event) => event.preventDefault()}
        />
        <PostModal
          open={modalOpen}
          submitting={submitting}
          errorMessage={submitError}
          isEditing={Boolean(editTarget)}
          initialCategory={editTarget?.category ?? null}
          initialContent={editTarget?.content ?? ''}
          onSubmit={handleSubmitPost}
          onClose={closeCreateModal}
        />
      </div>
    </>
  )
}

export default MapView
