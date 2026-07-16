import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getPosts,
  createPost,
  updatePost,
  deletePost,
  incrementConfirmCount,
  incrementLikes,
  uploadPostImage,
  subscribeToPostChanges,
} from './supabaseClient'
import {
  CATEGORIES,
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  CATEGORY_VALID_MINUTES,
} from './categories'
import { getDistanceMeters } from './geo'
import { findNearbyDuplicate, saveLastPost } from './abuseCheck'
import { saveOwnership, forgetOwnership, getOwnerSecret, isMyPost, generateOwnerSecret } from './myPosts'
import PostModal from './components/PostModal.jsx'
import CategoryFilter from './components/CategoryFilter.jsx'
import PostDetail from './components/PostDetail.jsx'
import BottomSheet from './components/BottomSheet.jsx'
import CommunityFeed from './components/CommunityFeed.jsx'
import PlaceSearch from './components/PlaceSearch.jsx'

const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY

// 위치 권한이 없거나 실패하면 서울시청 좌표로 대체한다.
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 }
// 개발 모드 전용: 시드 데이터가 위치한 동네 중심. 실제 기기 위치와 무관하게 마커를 볼 수 있도록 강제한다.
const DEV_LOCATION_OVERRIDE = { lat: 37.5575, lng: 126.9251 }
const NEARBY_RADIUS_METERS = 1000
// placeholder 가상 뷰포트는 필터 반경보다 조금 더 넉넉하게 잡는다.
const PLACEHOLDER_VIEWPORT_RADIUS_METERS = 1300
// 이 반경 밖에서 쓴 글은 "외부작성"으로 등록된다.
const EXTERNAL_DISTANCE_METERS = 500

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

// 카테고리 유효시간 대비 경과 비율. 자유주제(유효시간 없음)는 항상 0을 반환한다.
function getElapsedRatio(post, referenceTime) {
  const validMinutes = CATEGORY_VALID_MINUTES[post.category]
  if (validMinutes == null) return 0

  const validMs = validMinutes * 60 * 1000
  const elapsedMs = referenceTime - new Date(post.created_at).getTime()
  return elapsedMs / validMs
}

function getMarkerOpacity(post, referenceTime) {
  return getElapsedRatio(post, referenceTime) >= NEAR_EXPIRY_RATIO ? NEAR_EXPIRY_OPACITY : 1
}

function createKakaoMarkerImage(kakao, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">`
    + `<circle cx="14" cy="14" r="10" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`
  const src = `data:image/svg+xml;base64,${btoa(svg)}`
  return new kakao.maps.MarkerImage(src, new kakao.maps.Size(28, 28))
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
  return Boolean(target?.closest?.('.map-marker, .place-search, .category-filter'))
}

function MapView() {
  const mapContainerRef = useRef(null)
  const placeholderRef = useRef(null)
  const kakaoMapRef = useRef(null)
  const myLocationCircleRef = useRef(null)
  const markersRef = useRef([])
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
  const [likingPostId, setLikingPostId] = useState(null)
  const [deletingPostId, setDeletingPostId] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  // null이면 새 글 작성, 값이 있으면 해당 게시글 수정 모드
  const [editTarget, setEditTarget] = useState(null)

  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationDenied, setLocationDenied] = useState(false)

  const [kakaoReady, setKakaoReady] = useState(false)
  const [placeholderSize, setPlaceholderSize] = useState({ width: 0, height: 0 })
  const [sheetOpen, setSheetOpen] = useState(false)

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

  // 사용자 위치를 실시간으로 추적해서 지도 중심/반경원에 반영한다. 실패/거부 시 서울시청으로 대체한다.
  useEffect(() => {
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

    const watchId = navigator.geolocation.watchPosition(
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

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // 유효시간 경과율(반투명/만료)을 주기적으로 재계산하기 위한 시계
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // 다른 사용자가 등록/수정/삭제한 게시글을 실시간으로 반영한다.
  useEffect(() => {
    const unsubscribe = subscribeToPostChanges({
      onInsert: (newPost) => {
        setPosts((prev) => (prev.some((post) => post.id === newPost.id) ? prev : [newPost, ...prev]))
      },
      onUpdate: (updatedPost) => {
        setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? { ...post, ...updatedPost } : post)))
      },
      onDelete: (deletedPost) => {
        setPosts((prev) => prev.filter((post) => post.id !== deletedPost.id))
        setSelectedPostId((prev) => (prev === deletedPost.id ? null : prev))
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
        image: createKakaoMarkerImage(kakao, CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR),
        opacity: getMarkerOpacity(post, now),
      })

      kakao.maps.event.addListener(marker, 'click', () => {
        setSelectedPostId(post.id)
      })

      return marker
    })
  }, [nearbyPosts, now])

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
        title: existingPost.title,
        content: existingPost.content,
        image_url: existingPost.image_url,
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

  async function handleSubmitPost({ category, title, content, imageFile, removeImage }) {
    if (!pendingPosition) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const imageUrl = imageFile
        ? await uploadPostImage(imageFile)
        : (removeImage ? null : editTarget?.image_url ?? null)

      if (editTarget) {
        await updatePost(editTarget.id, { category, title, content, imageUrl })
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
          ownerSecret,
        })
        saveLastPost({ id: created.id, lat: pendingPosition.lat, lng: pendingPosition.lng })
        saveOwnership(created.id, ownerSecret)
      }
      closeCreateModal()
    } catch (err) {
      console.error('[MapView] 게시글 저장 실패', err)
      setSubmitError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  // 작성자 본인만 삭제 가능(서버가 owner_secret 일치 여부를 확인한다).
  async function handleDeletePost(post) {
    const ownerSecret = getOwnerSecret(post.id)
    if (!ownerSecret) return

    setDeletingPostId(post.id)
    try {
      const deleted = await deletePost(post.id, ownerSecret)
      if (deleted) {
        forgetOwnership(post.id)
        setPosts((prev) => prev.filter((p) => p.id !== post.id))
        setSelectedPostId(null)
      }
    } catch (err) {
      console.error('[MapView] 게시글 삭제 실패', err)
    } finally {
      setDeletingPostId(null)
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

  // 추천(좋아요) 시 likes_count를 1 증가시킨다.
  async function handleLike(post) {
    if (likingPostId === post.id) return

    setLikingPostId(post.id)
    try {
      await incrementLikes(post.id, post.likes_count ?? 0)
    } catch (err) {
      console.error('[MapView] likes_count 갱신 실패', err)
    } finally {
      setLikingPostId(null)
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

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null

  const willBeExternal = !editTarget && Boolean(pendingPosition) && Boolean(userLocation)
    && getDistanceMeters(userLocation.lat, userLocation.lng, pendingPosition.lat, pendingPosition.lng) > EXTERNAL_DISTANCE_METERS

  const placeholderBounds = userLocation ? getPlaceholderBounds(userLocation) : null
  const placeholderPositions = placeholderBounds ? projectToPercent(nearbyPosts, placeholderBounds) : new Map()
  const myCircleDiameterPx = Math.min(placeholderSize.width, placeholderSize.height)
    * (EXTERNAL_DISTANCE_METERS / PLACEHOLDER_VIEWPORT_RADIUS_METERS)

  return (
    <>
      {locationBanner}
      <div className="map-view">
        <CategoryFilter activeCategories={activeCategories} onToggle={toggleCategory} />
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
                    setSelectedPostId(post.id)
                  }}
                />
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

        <BottomSheet open={sheetOpen} onToggle={setSheetOpen}>
          <CommunityFeed
            posts={nearbyPosts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSelectPost={setSelectedPostId}
          />
        </BottomSheet>
      </div>

      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onConfirm={() => handleConfirm(selectedPost)}
          confirming={confirmingPostId === selectedPost.id}
          onLike={() => handleLike(selectedPost)}
          liking={likingPostId === selectedPost.id}
          isMine={isMyPost(selectedPost.id)}
          onDelete={() => handleDeletePost(selectedPost)}
          deleting={deletingPostId === selectedPost.id}
        />
      )}

      <PostModal
        open={modalOpen}
        submitting={submitting}
        errorMessage={submitError}
        isEditing={Boolean(editTarget)}
        willBeExternal={willBeExternal}
        initialCategory={editTarget?.category ?? null}
        initialTitle={editTarget?.title ?? ''}
        initialContent={editTarget?.content ?? ''}
        initialImageUrl={editTarget?.image_url ?? null}
        onSubmit={handleSubmitPost}
        onClose={closeCreateModal}
      />
    </>
  )
}

export default MapView
