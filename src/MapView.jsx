import { useEffect, useRef, useState } from 'react'
import {
  createPost,
  updatePost,
  uploadPostImage,
  getPins,
  createPin,
  deletePin,
  subscribeToPinChanges,
} from './supabaseClient'
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, getElapsedRatio, getPinIconEmoji } from './categories'
import { getDistanceMeters } from './geo'
import { findNearbyDuplicate, saveLastPost } from './abuseCheck'
import {
  saveOwnership,
  generateOwnerSecret,
  savePinOwnership,
  forgetPinOwnership,
  getPinOwnerSecret,
} from './myPosts'
import PostModal from './components/PostModal.jsx'
import CategoryFilter from './components/CategoryFilter.jsx'
import PlaceSearch from './components/PlaceSearch.jsx'
import PinMenu from './components/PinMenu.jsx'
import PlacePreview from './components/PlacePreview.jsx'

const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY

// placeholder 가상 뷰포트는 필터 반경보다 조금 더 넉넉하게 잡는다.
const PLACEHOLDER_VIEWPORT_RADIUS_METERS = 1300
// 이 반경 밖에서 쓴 글은 "외부작성"으로 등록된다.
const EXTERNAL_DISTANCE_METERS = 500

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10
const NEAR_EXPIRY_RATIO = 0.7
const NEAR_EXPIRY_OPACITY = 0.45

function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
}

function loadKakaoMapScript(appKey) {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.services) {
      resolve(window.kakao)
      return
    }

    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function getMarkerOpacity(post, referenceTime) {
  return getElapsedRatio(post, referenceTime) >= NEAR_EXPIRY_RATIO ? NEAR_EXPIRY_OPACITY : 1
}

// 이모지가 섞인 SVG는 btoa가 바로 처리 못하므로 유니코드 안전하게 base64로 변환한다.
function svgToDataUrl(svg) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

function createKakaoMarkerImage(kakao, color, emoji) {
  const emojiText = emoji
    ? `<text x="14" y="19" font-size="14" text-anchor="middle">${emoji}</text>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">`
    + `<circle cx="14" cy="14" r="10" fill="${color}" stroke="#fff" stroke-width="2"/>${emojiText}</svg>`
  return new kakao.maps.MarkerImage(svgToDataUrl(svg), new kakao.maps.Size(28, 28))
}

// 아직 글이 없는 "빈 핀" 전용 마커 이미지(점선 원 + 📌).
function createKakaoPinMarkerImage(kakao) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">`
    + `<circle cx="14" cy="14" r="10" fill="#ffffff" stroke="#999999" stroke-width="2" stroke-dasharray="3,2"/>`
    + `<text x="14" y="19" font-size="13" text-anchor="middle">📌</text></svg>`
  return new kakao.maps.MarkerImage(svgToDataUrl(svg), new kakao.maps.Size(28, 28))
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

// placeholder 모드 전용: lat/lng을 뷰포트 bounds 안에서 컨테이너 상대 좌표(%)로 변환한다.
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
  return Boolean(target?.closest?.('.map-marker, .map-pin, .place-search, .category-filter'))
}

// 지도 렌더링 전담. 게시글 목록/위치/카테고리 필터는 App에서 props로 받아 커뮤니티 탭과 공유한다.
function MapView({
  userLocation,
  locationLoading,
  locationDenied,
  nearbyPosts,
  activeCategories,
  onToggleCategory,
  onSelectPost,
  onOpenCommunity,
}) {
  const mapContainerRef = useRef(null)
  const placeholderRef = useRef(null)
  const kakaoMapRef = useRef(null)
  const myLocationCircleRef = useRef(null)
  const markersRef = useRef([])
  const pinMarkersRef = useRef([])
  const longPressTimerRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const lastTouchTimeRef = useRef(0)

  const [pins, setPins] = useState([])
  const [selectedPinId, setSelectedPinId] = useState(null)
  const [deletingPinId, setDeletingPinId] = useState(null)
  // 지도를 클릭한 지점(아직 서버에 핀이 만들어지지 않은 상태)의 건물/장소 미리보기
  const [previewPosition, setPreviewPosition] = useState(null)
  const [creatingPin, setCreatingPin] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingPosition, setPendingPosition] = useState(null)
  const [pendingPinId, setPendingPinId] = useState(null)
  const [quickCategory, setQuickCategory] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  // null이면 새 글 작성, 값이 있으면 해당 게시글 수정 모드
  const [editTarget, setEditTarget] = useState(null)

  const [kakaoReady, setKakaoReady] = useState(false)
  const [placeholderSize, setPlaceholderSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(interval)
  }, [])

  // 아직 글이 없는 "빈 핀" 목록도 함께 불러온다.
  useEffect(() => {
    let cancelled = false
    getPins().then((data) => {
      if (!cancelled) setPins(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 다른 사용자가 만들거나 지운 빈 핀을 실시간으로 반영한다.
  useEffect(() => {
    const unsubscribe = subscribeToPinChanges({
      onInsert: (newPin) => {
        setPins((prev) => (prev.some((pin) => pin.id === newPin.id) ? prev : [newPin, ...prev]))
      },
      onDelete: (deletedPin) => {
        setPins((prev) => prev.filter((pin) => pin.id !== deletedPin.id))
        setSelectedPinId((prev) => (prev === deletedPin.id ? null : prev))
      },
    })
    return unsubscribe
  }, [])

  // 빈 핀도 게시글과 동일하게 반경 1km 이내만 지도에 표시한다.
  const nearbyPins = userLocation
    ? pins.filter((pin) => getDistanceMeters(userLocation.lat, userLocation.lng, pin.lat, pin.lng) <= 1000)
    : []

  // 카카오맵 초기화. 딱 한 번만 생성하고, 이후 위치 갱신은 반경원만 옮긴다.
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !mapContainerRef.current || !userLocation || kakaoMapRef.current) return

    let cancelled = false

    loadKakaoMapScript(KAKAO_MAP_KEY).then((kakao) => {
      if (cancelled || kakaoMapRef.current) return

      const map = new kakao.maps.Map(mapContainerRef.current, {
        center: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
        level: 4,
      })
      kakaoMapRef.current = map
      setKakaoReady(true)

      myLocationCircleRef.current = new kakao.maps.Circle({
        center: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
        radius: EXTERNAL_DISTANCE_METERS,
        strokeWeight: 1.5,
        strokeColor: '#2e7d6b',
        strokeOpacity: 0.6,
        fillColor: '#2e7d6b',
        fillOpacity: 0.08,
      })
      myLocationCircleRef.current.setMap(map)

      // 데스크톱(마우스)만 클릭으로 장소 미리보기를 연다. 모바일은 아래 터치 핸들러의 롱프레스로 처리한다.
      if (!isTouchDevice()) {
        kakao.maps.event.addListener(map, 'click', (mouseEvent) => {
          setPreviewPosition({ lat: mouseEvent.latLng.getLat(), lng: mouseEvent.latLng.getLng() })
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [userLocation])

  // 위치가 갱신될 때마다 반경원 위치만 옮긴다(지도는 다시 만들지 않음) — 내 위치 실시간 동기화
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !userLocation || !myLocationCircleRef.current) return
    const kakao = window.kakao
    myLocationCircleRef.current.setPosition(new kakao.maps.LatLng(userLocation.lat, userLocation.lng))
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
        image: createKakaoMarkerImage(
          kakao,
          CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR,
          getPinIconEmoji(post.icon),
        ),
        opacity: getMarkerOpacity(post, now),
      })

      kakao.maps.event.addListener(marker, 'click', () => {
        onSelectPost(post.id)
      })

      return marker
    })
  }, [nearbyPosts, now, onSelectPost])

  // nearbyPins가 바뀔 때마다 빈 핀 마커를 다시 그린다.
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !kakaoMapRef.current) return
    const kakao = window.kakao

    pinMarkersRef.current.forEach((marker) => marker.setMap(null))
    pinMarkersRef.current = nearbyPins.map((pin) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(pin.lat, pin.lng),
        map: kakaoMapRef.current,
        image: createKakaoPinMarkerImage(kakao),
      })

      kakao.maps.event.addListener(marker, 'click', () => {
        setSelectedPinId(pin.id)
      })

      return marker
    })
  }, [nearbyPins])

  // placeholder 컨테이너 크기를 재서 500m 원을 정확한 원형(px)으로 그린다.
  useEffect(() => {
    if (KAKAO_MAP_KEY) return
    const el = placeholderRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setPlaceholderSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [locationLoading])

  // 5분 이내 반경 50m 안에 내가 쓴 글이 있으면 새 글 대신 그 글을 수정하도록 연다.
  // pinId가 있으면 이 작성 흐름이 끝났을 때(성공 시) 그 빈 핀을 지운다. presetCategory는 "질문 등록" 같은 빠른 진입용 기본 카테고리.
  function openCreateModal(lat, lng, { pinId = null, presetCategory = null } = {}) {
    setSubmitError(null)
    setPendingPosition({ lat, lng })
    setPendingPinId(pinId)
    setSelectedPinId(null)

    const duplicate = findNearbyDuplicate(lat, lng)
    const existingPost = duplicate ? nearbyPosts.find((post) => post.id === duplicate.id) : null

    if (existingPost) {
      setEditTarget({
        id: existingPost.id,
        lat: existingPost.lat,
        lng: existingPost.lng,
        category: existingPost.category,
        title: existingPost.title,
        content: existingPost.content,
        image_url: existingPost.image_url,
        icon: existingPost.icon,
      })
      setQuickCategory(null)
    } else {
      setEditTarget(null)
      setQuickCategory(presetCategory)
    }

    setModalOpen(true)
  }

  function closeCreateModal() {
    setModalOpen(false)
    setPendingPosition(null)
    setSubmitError(null)
    setEditTarget(null)
    setPendingPinId(null)
    setQuickCategory(null)
  }

  // 핀에서 시작한 작성이 성공적으로 끝나면(글쓰기든 근처 글 수정이든) 원본 빈 핀은 삭제한다.
  async function convertPinToPost(pinId) {
    const ownerSecret = getPinOwnerSecret(pinId)
    if (!ownerSecret) return

    try {
      const deleted = await deletePin(pinId, ownerSecret)
      if (deleted) {
        forgetPinOwnership(pinId)
        setPins((prev) => prev.filter((pin) => pin.id !== pinId))
      }
    } catch (err) {
      console.error('[MapView] 핀 삭제(전환) 실패', err)
    }
  }

  async function handleSubmitPost({ category, title, content, imageFile, removeImage, icon }) {
    if (!pendingPosition) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const imageUrl = imageFile
        ? await uploadPostImage(imageFile)
        : (removeImage ? null : editTarget?.image_url ?? null)

      if (editTarget) {
        await updatePost(editTarget.id, { category, title, content, imageUrl, icon })
        saveLastPost({ id: editTarget.id, lat: editTarget.lat, lng: editTarget.lng })
      } else {
        const distanceFromMe = userLocation
          ? getDistanceMeters(userLocation.lat, userLocation.lng, pendingPosition.lat, pendingPosition.lng)
          : 0
        const postType = distanceFromMe > EXTERNAL_DISTANCE_METERS ? 'external' : 'local'
        const ownerSecret = generateOwnerSecret()

        const created = await createPost({
          lat: pendingPosition.lat,
          lng: pendingPosition.lng,
          category,
          title,
          content,
          postType,
          imageUrl,
          icon,
          ownerSecret,
        })
        saveLastPost({ id: created.id, lat: pendingPosition.lat, lng: pendingPosition.lng })
        saveOwnership(created.id, ownerSecret)
      }

      if (pendingPinId) {
        await convertPinToPost(pendingPinId)
      }

      closeCreateModal()
    } catch (err) {
      console.error('[MapView] 게시글 저장 실패', err)
      setSubmitError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  // PlacePreview에서 "이 위치에 핀 만들기"를 눌렀을 때만 실제로 서버에 핀을 만든다.
  async function handleCreatePinAtPreview() {
    if (!previewPosition) return

    setCreatingPin(true)
    try {
      const ownerSecret = generateOwnerSecret()
      const created = await createPin({ lat: previewPosition.lat, lng: previewPosition.lng, ownerSecret })
      setPins((prev) => (prev.some((pin) => pin.id === created.id) ? prev : [created, ...prev]))
      savePinOwnership(created.id, ownerSecret)
      setPreviewPosition(null)
      setSelectedPinId(created.id)
    } catch (err) {
      console.error('[MapView] 핀 생성 실패', err)
    } finally {
      setCreatingPin(false)
    }
  }

  // PlacePreview에서 "커뮤니티 보기"를 누르면 미리보기를 닫고 커뮤니티 탭으로 전환한다.
  function handleViewCommunityFromPreview() {
    setPreviewPosition(null)
    onOpenCommunity()
  }

  // 핀 메뉴에서 "핀 삭제"를 누르면 본인이 만든 핀만(owner_secret 일치) 삭제된다.
  async function handleDeletePin(pin) {
    const ownerSecret = getPinOwnerSecret(pin.id)
    if (!ownerSecret) return

    setDeletingPinId(pin.id)
    try {
      const deleted = await deletePin(pin.id, ownerSecret)
      if (deleted) {
        forgetPinOwnership(pin.id)
        setPins((prev) => prev.filter((p) => p.id !== pin.id))
        setSelectedPinId(null)
      }
    } catch (err) {
      console.error('[MapView] 핀 삭제 실패', err)
    } finally {
      setDeletingPinId(null)
    }
  }

  // ---- placeholder 클릭 / 롱프레스 ----

  function handlePlaceholderClick(event, bounds) {
    if (isMarkerOrInfoWindowTarget(event.target)) return
    // 터치 후 브라우저가 자동 발생시키는 synthetic click은 무시한다 (모바일은 롱프레스로만 연다).
    if (Date.now() - lastTouchTimeRef.current < 700) return

    const { lat, lng } = placeholderPointToLatLng(event.currentTarget, event.clientX, event.clientY, bounds)
    setPreviewPosition({ lat, lng })
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
      setPreviewPosition({ lat, lng })
    }, LONG_PRESS_MS)
  }

  // ---- 카카오맵 롱프레스 (모바일) ----

  function handleKakaoTouchStart(event) {
    if (!kakaoMapRef.current) return
    if (isMarkerOrInfoWindowTarget(event.target)) return

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
      setPreviewPosition({ lat: coords.getLat(), lng: coords.getLng() })
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

  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null

  const willBeExternal = !editTarget && Boolean(pendingPosition) && Boolean(userLocation)
    && getDistanceMeters(userLocation.lat, userLocation.lng, pendingPosition.lat, pendingPosition.lng) > EXTERNAL_DISTANCE_METERS

  const placeholderBounds = userLocation ? getPlaceholderBounds(userLocation) : null
  const placeholderPositions = placeholderBounds ? projectToPercent(nearbyPosts, placeholderBounds) : new Map()
  const placeholderPinPositions = placeholderBounds ? projectToPercent(nearbyPins, placeholderBounds) : new Map()
  const myCircleDiameterPx = Math.min(placeholderSize.width, placeholderSize.height)
    * (EXTERNAL_DISTANCE_METERS / PLACEHOLDER_VIEWPORT_RADIUS_METERS)

  return (
    <>
      {locationBanner}
      <div className="map-view">
        <CategoryFilter activeCategories={activeCategories} onToggle={onToggleCategory} />
        {kakaoReady && (
          <PlaceSearch
            kakao={window.kakao}
            kakaoMap={kakaoMapRef.current}
            onWriteHere={(lat, lng) => openCreateModal(lat, lng)}
          />
        )}

        {!KAKAO_MAP_KEY ? (
          <div
            ref={placeholderRef}
            className="map-placeholder"
            role="img"
            aria-label="지도 영역 placeholder"
            onClick={(event) => handlePlaceholderClick(event, placeholderBounds)}
            onTouchStart={(event) => handlePlaceholderTouchStart(event, placeholderBounds)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="map-placeholder-label">지도 영역</span>

            {myCircleDiameterPx > 0 && (
              <div
                className="my-location-circle"
                style={{ width: myCircleDiameterPx, height: myCircleDiameterPx }}
              />
            )}

            {nearbyPosts.map((post) => {
              const position = placeholderPositions.get(post.id)
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
                    onSelectPost(post.id)
                  }}
                >
                  {getPinIconEmoji(post.icon)}
                </button>
              )
            })}

            {nearbyPins.map((pin) => {
              const position = placeholderPinPositions.get(pin.id)
              if (!position) return null

              return (
                <button
                  key={pin.id}
                  type="button"
                  className="map-pin"
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  aria-label="빈 핀"
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedPinId(pin.id)
                  }}
                >
                  📌
                </button>
              )
            })}
          </div>
        ) : (
          <div
            ref={mapContainerRef}
            className="map-container"
            onTouchStart={handleKakaoTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onContextMenu={(event) => event.preventDefault()}
          />
        )}
      </div>

      <PlacePreview
        position={previewPosition}
        kakao={window.kakao}
        onCreatePin={handleCreatePinAtPreview}
        onViewCommunity={handleViewCommunityFromPreview}
        onClose={() => setPreviewPosition(null)}
        creatingPin={creatingPin}
      />

      {selectedPin && (
        <PinMenu
          onWrite={() => openCreateModal(selectedPin.lat, selectedPin.lng, { pinId: selectedPin.id })}
          onAskQuestion={() => openCreateModal(selectedPin.lat, selectedPin.lng, { pinId: selectedPin.id, presetCategory: '동네질문' })}
          onDelete={() => handleDeletePin(selectedPin)}
          onClose={() => setSelectedPinId(null)}
          deleting={deletingPinId === selectedPin.id}
        />
      )}

      <PostModal
        open={modalOpen}
        submitting={submitting}
        errorMessage={submitError}
        isEditing={Boolean(editTarget)}
        willBeExternal={willBeExternal}
        initialCategory={editTarget?.category ?? quickCategory ?? null}
        initialTitle={editTarget?.title ?? ''}
        initialContent={editTarget?.content ?? ''}
        initialImageUrl={editTarget?.image_url ?? null}
        initialIcon={editTarget?.icon ?? null}
        onSubmit={handleSubmitPost}
        onClose={closeCreateModal}
      />
    </>
  )
}

export default MapView
