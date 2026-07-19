import { useEffect, useRef, useState } from 'react'
import {
  getPins,
  createPin,
  deletePin,
  deleteExpiredPins,
  subscribeToPinChanges,
} from './supabaseClient'
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  getFadeOpacity,
  getMarkerTier,
} from './categories'
import { Glyph, markerGlyphSvg, resolveGlyphName } from './iconGlyphs'
import { clusterByScreenPosition, getClusterTier } from './mapClustering'
import { reverseGeocodeDong } from './geocode'
import { getDistanceMeters } from './geo'
import {
  filterPostsWithinRadius,
  filterMapVisiblePosts,
  getWeeklyDigestPosts,
  COMMUNITY_RADIUS_METERS,
  EXTERNAL_DISTANCE_METERS,
  MAP_VISIBLE_MINUTES,
} from './usePosts'
import {
  generateOwnerSecret,
  savePinOwnership,
  forgetPinOwnership,
  getPinOwnerSecret,
} from './myPosts'
import { getOrCreateDeviceSecret } from './notifications'
import CategoryFilter from './components/CategoryFilter.jsx'
import PlaceSearch from './components/PlaceSearch.jsx'
import PinMenu from './components/PinMenu.jsx'
import PlacePreview from './components/PlacePreview.jsx'
import PlaceCard from './components/PlaceCard.jsx'
import CommunityFeed from './components/CommunityFeed.jsx'
import MapSheet from './components/MapSheet.jsx'
import PostCard from './components/PostCard.jsx'
import WeeklyDigest from './components/WeeklyDigest.jsx'

const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY

// placeholder 가상 뷰포트는 필터 반경보다 조금 더 넉넉하게 잡는다.
const PLACEHOLDER_VIEWPORT_RADIUS_METERS = 1300

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10
// 이 시간 안에 지도가 뜨지 않으면(도메인 미등록 등 script.onerror로 안 잡히는 실패 포함) 에러로 간주한다.
const MAP_LOAD_TIMEOUT_MS = 10000

// index.css :root의 --color-accent와 반드시 같은 값으로 유지할 것 — 카카오맵 SVG 마커는
// base64 data URI라 DOM 밖이라서 CSS 변수를 못 읽기 때문에 여기 hex 리터럴을 원본으로 둔다.
const ACCENT_COLOR = '#0066ff'

// 마커 3단계 크기 — 실시간 알림형(크게)/자유주제 커뮤니티(작게)/클러스터(숫자 원, 개수별로 더 크게).
// 화면 픽셀 기준 지름(px). placeholder 모드(CSS)와 카카오 SVG 마커 양쪽이 이 값을 공유한다.
const MARKER_DIAMETER = { large: 40, small: 28 }
const MARKER_GLYPH_FONT_SIZE = { large: 17, small: 12 }
const CLUSTER_DIAMETER = { small: 34, medium: 44, large: 54 }
const CLUSTER_FONT_SIZE = { small: 13, medium: 15, large: 17 }
// 화면 픽셀 기준 — 이 거리 안에 있는 마커끼리 하나의 숫자 클러스터로 묶는다.
const CLUSTER_CELL_PX = 46

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

// 이모지가 섞인 SVG는 btoa가 바로 처리 못하므로 유니코드 안전하게 base64로 변환한다.
function svgToDataUrl(svg) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

// 모든 마커/클러스터가 공유하는 은은한 그림자(각 SVG는 독립 문서라 id가 겹쳐도 안전하다).
const MARKER_SHADOW_DEF = `<filter id="marker-shadow" x="-60%" y="-60%" width="220%" height="220%">`
  + `<feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="#000000" flood-opacity="0.28"/></filter>`

// 게시글 마커 — tier(large/small)로 크기를, glyph로 카테고리 아이콘(색약 대응)을 표시하고,
// selected면 포인트 컬러 테두리로 강조한다(그림자는 항상 은은한 톤 유지).
function createKakaoMarkerImage(kakao, { color, glyphName, tier = 'small', selected = false }) {
  const diameter = MARKER_DIAMETER[tier]
  const radius = diameter / 2 - 2
  const ringExtra = selected ? 4 : 0
  const size = diameter + ringExtra + 6
  const center = size / 2

  const ring = selected
    ? `<circle cx="${center}" cy="${center}" r="${radius + 3}" fill="none" stroke="${ACCENT_COLOR}" stroke-width="3"/>`
    : ''
  // 색약 대응 흰색 라인 글리프(이모지 대체). 마커 크기에 맞춰 지름/굵기를 조절한다.
  const glyphMarkup = glyphName
    ? markerGlyphSvg(glyphName, {
        cx: center,
        cy: center,
        px: tier === 'large' ? 20 : 14,
        stroke: '#fff',
        strokeWidth: tier === 'large' ? 2 : 1.7,
      })
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
    + `<defs>${MARKER_SHADOW_DEF}</defs>`
    + `<g filter="url(#marker-shadow)"><circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" stroke="#fff" stroke-width="2"/></g>`
    + `${ring}${glyphMarkup}</svg>`

  return new kakao.maps.MarkerImage(svgToDataUrl(svg), new kakao.maps.Size(size, size))
}

// 마커가 겹칠 때 대신 보여주는 숫자 클러스터 원 — 포인트 컬러 1개로 통일, 개수별로 3단계 크기.
function createKakaoClusterMarkerImage(kakao, count) {
  const tier = getClusterTier(count)
  const diameter = CLUSTER_DIAMETER[tier]
  const radius = diameter / 2 - 2
  const size = diameter + 6
  const center = size / 2
  const fontSize = CLUSTER_FONT_SIZE[tier]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
    + `<defs>${MARKER_SHADOW_DEF}</defs>`
    + `<g filter="url(#marker-shadow)"><circle cx="${center}" cy="${center}" r="${radius}" fill="${ACCENT_COLOR}" stroke="#fff" stroke-width="2"/></g>`
    + `<text x="${center}" y="${center + fontSize * 0.35}" font-size="${fontSize}" font-weight="700" fill="#fff" text-anchor="middle">${count}</text></svg>`

  return new kakao.maps.MarkerImage(svgToDataUrl(svg), new kakao.maps.Size(size, size))
}

// 아직 글이 없는 "빈 핀" 전용 마커 이미지(점선 원 + 핀 글리프).
function createKakaoPinMarkerImage(kakao) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">`
    + `<circle cx="18" cy="18" r="14" fill="#ffffff" stroke="#999999" stroke-width="2" stroke-dasharray="4,3"/>`
    + `${markerGlyphSvg('pin', { cx: 18, cy: 18, px: 17, stroke: '#666666', strokeWidth: 1.8 })}</svg>`
  return new kakao.maps.MarkerImage(svgToDataUrl(svg), new kakao.maps.Size(36, 36))
}

// 실시간 내 위치를 나타내는 작은 점 마커(카카오맵 전용). post/pin 마커와 구분되는 채움원.
function createKakaoMyLocationMarkerImage(kakao) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">`
    + `<circle cx="9" cy="9" r="7" fill="#0066ff" stroke="#fff" stroke-width="3"/></svg>`
  return new kakao.maps.MarkerImage(svgToDataUrl(svg), new kakao.maps.Size(18, 18))
}

// 장소검색 결과 위치를 나타내는 전용 마커(핀/글쓰기 시스템과 무관, 위치 표시 전용).
// 다른 마커보다 크게 그려서 눈에 띄게 하고, 클릭해야만 정보 카드가 뜬다.
// 물방울(핀 드롭) 모양 — 뾰족한 끝이 실제 좌표를 가리킨다.
function createKakaoSearchMarkerImage(kakao) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="68">`
    + `<path d="M26 65 C26 65 8 41 8 26 A18 18 0 1 1 44 26 C44 41 26 65 26 65 Z" fill="#0066ff" stroke="#fff" stroke-width="3"/>`
    + `${markerGlyphSvg('building', { cx: 26, cy: 25, px: 22, stroke: '#fff', strokeWidth: 2 })}</svg>`
  return new kakao.maps.MarkerImage(
    svgToDataUrl(svg),
    new kakao.maps.Size(52, 68),
    { offset: new kakao.maps.Point(26, 65) },
  )
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
  return Boolean(target?.closest?.('.map-marker, .map-cluster-marker, .map-pin, .place-search, .map-header, .map-side-rail, .map-cluster-popover'))
}

// 지도 렌더링 전담. 게시글 목록/위치/카테고리 필터는 App에서 props로 받아 커뮤니티 탭과 공유한다.
function MapView({
  userLocation,
  locationLoading,
  locationDenied,
  nearbyPosts,
  activePosts,
  activeCategories,
  onToggleCategory,
  onSelectPost,
  selectedPostId,
  onOpenCommunity,
  onOpenCreateModal,
  onOpenQuickPost,
  recenterTarget,
}) {
  const mapContainerRef = useRef(null)
  const placeholderRef = useRef(null)
  const kakaoMapRef = useRef(null)
  const myLocationCircleRef = useRef(null)
  const myLocationMarkerRef = useRef(null)
  const searchMarkerRef = useRef(null)
  const markersRef = useRef([])
  const pinMarkersRef = useRef([])
  const longPressTimerRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const lastTouchTimeRef = useRef(0)

  const [pins, setPins] = useState([])
  // 핀이 지도를 뒤덮어 가독성이 떨어질 때 사용자가 직접 껐다 켤 수 있는 표시 여부(서버 데이터는 그대로 유지).
  const [pinsVisible, setPinsVisible] = useState(true)
  const [selectedPinId, setSelectedPinId] = useState(null)
  const [deletingPinId, setDeletingPinId] = useState(null)
  // 지도를 클릭한 지점(아직 서버에 핀이 만들어지지 않은 상태)의 건물/장소 미리보기
  const [previewPosition, setPreviewPosition] = useState(null)
  // 장소검색으로 선택한 위치(핀/글쓰기와 무관, 위치 표시 전용) — 마커만 먼저 뜨고, 마커를 눌러야 정보 카드가 열린다.
  const [searchedPlace, setSearchedPlace] = useState(null)
  const [placeCardOpen, setPlaceCardOpen] = useState(false)
  const [placeCommunityOpen, setPlaceCommunityOpen] = useState(false)
  const [creatingPin, setCreatingPin] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // 카카오맵 스크립트/초기화 진행 상태 — 'loading'(불러오는 중) / 'ready'(정상) / 'error'(도메인 미등록,
  // 네트워크 오류 등으로 실패). placeholder 모드(KAKAO_MAP_KEY 없음)에서는 쓰이지 않는다.
  const [mapStatus, setMapStatus] = useState(() => (KAKAO_MAP_KEY ? 'loading' : 'ready'))
  const [mapRetryToken, setMapRetryToken] = useState(0)
  const [placeholderSize, setPlaceholderSize] = useState({ width: 0, height: 0 })
  // 지도를 드래그/확대·축소할 때마다 증가시켜서 마커 클러스터링을 다시 계산하게 만드는 트리거.
  // 값 자체는 안 쓰고 의존성 배열에만 넣는다(뷰포트/줌 레벨이 바뀌면 화면 픽셀 좌표가 달라지므로).
  const [viewportTick, setViewportTick] = useState(0)
  // placeholder 모드는 실제 줌이 없어서 클러스터를 눌러도 확대로 안 풀리니, 대신 묶인 글 목록을 보여준다.
  const [openClusterPosts, setOpenClusterPosts] = useState(null)
  // 지도 상단 고정 헤더에 표시할 동네명(동 단위). 카카오 서비스가 없는 placeholder 모드에서는 null로 남는다.
  const [neighborhoodName, setNeighborhoodName] = useState(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
      // 만료된(작성 후 MAP_VISIBLE_MINUTES 지난) 빈 핀을 서버에서 실제로 정리한다.
      // 소유자 확인 없이 나이만 보는 멱등 연산이라 접속한 아무 클라이언트나 호출해도 안전하다.
      deleteExpiredPins(MAP_VISIBLE_MINUTES).catch((err) => {
        console.error('[MapView] 만료 핀 정리 실패', err)
      })
    }, 30 * 1000)
    return () => clearInterval(interval)
  }, [])

  // 아직 글이 없는 "빈 핀" 목록도 함께 불러온다.
  useEffect(() => {
    let cancelled = false
    deleteExpiredPins(MAP_VISIBLE_MINUTES).catch((err) => {
      console.error('[MapView] 만료 핀 정리 실패', err)
    })
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

  // 빈 핀도 게시글과 동일하게 반경 1km 이내만 지도에 표시하고, 작성 후 MAP_VISIBLE_MINUTES(기본 1시간)가
  // 지나면 실제 삭제(위 deleteExpiredPins)를 기다리지 않고 클라이언트에서 먼저 숨긴다.
  const nearbyPins = userLocation
    ? filterMapVisiblePosts(
        pins.filter((pin) => getDistanceMeters(userLocation.lat, userLocation.lng, pin.lat, pin.lng) <= 1000),
        now,
      )
    : []
  // pinsVisible이 꺼져 있으면 서버 데이터/구독은 그대로 두고 화면 표시만 숨긴다(마커 클릭도 불가능해짐).
  const visiblePins = pinsVisible ? nearbyPins : []

  // 카카오맵 초기화. 딱 한 번만 생성하고, 이후 위치 갱신은 반경원만 옮긴다.
  // 도메인 미등록처럼 script.onerror로 안 잡히는 실패(스크립트는 로드되지만 지도가 안 뜨는 경우)도
  // 있어서, 정해진 시간 안에 성공/실패 어느 쪽으로도 결론나지 않으면 타임아웃으로 에러 처리한다.
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !mapContainerRef.current || !userLocation || kakaoMapRef.current) return

    let cancelled = false
    setMapStatus('loading')

    const timeoutId = setTimeout(() => {
      if (cancelled || kakaoMapRef.current) return
      cancelled = true
      setMapStatus('error')
    }, MAP_LOAD_TIMEOUT_MS)

    loadKakaoMapScript(KAKAO_MAP_KEY)
      .then((kakao) => {
        if (cancelled || kakaoMapRef.current) return
        clearTimeout(timeoutId)

        const map = new kakao.maps.Map(mapContainerRef.current, {
          center: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
          level: 4,
        })
        kakaoMapRef.current = map
        setMapStatus('ready')

        myLocationCircleRef.current = new kakao.maps.Circle({
          center: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
          radius: EXTERNAL_DISTANCE_METERS,
          strokeWeight: 1.5,
          strokeColor: '#0066ff',
          strokeOpacity: 0.6,
          fillColor: '#0066ff',
          fillOpacity: 0.08,
        })
        myLocationCircleRef.current.setMap(map)

        myLocationMarkerRef.current = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
          map,
          image: createKakaoMyLocationMarkerImage(kakao),
          zIndex: 10,
        })

        // 데스크톱(마우스)만 클릭으로 장소 미리보기를 연다. 모바일은 아래 터치 핸들러의 롱프레스로 처리한다.
        if (!isTouchDevice()) {
          kakao.maps.event.addListener(map, 'click', (mouseEvent) => {
            setPreviewPosition({ lat: mouseEvent.latLng.getLat(), lng: mouseEvent.latLng.getLng() })
          })
        }

        // 드래그/확대·축소가 끝날 때마다 마커 클러스터링을 다시 계산한다(뷰포트 밖 마커 제외 포함).
        kakao.maps.event.addListener(map, 'idle', () => setViewportTick((tick) => tick + 1))
      })
      .catch((err) => {
        console.error('[MapView] 카카오맵 스크립트 로드 실패', err)
        if (cancelled) return
        cancelled = true
        clearTimeout(timeoutId)
        setMapStatus('error')
      })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [userLocation, mapRetryToken])

  // 에러 화면의 "다시 시도" 버튼 — 실패했던 스크립트 로드부터 다시 시도한다.
  function handleRetryMap() {
    kakaoMapRef.current = null
    setMapStatus('loading')
    setMapRetryToken((token) => token + 1)
  }

  // "내 위치로" 버튼 — 지도를 드래그해서 벗어나 있어도 현재 GPS 위치로 바로 되돌아온다.
  // placeholder 모드는 뷰포트가 애초에 항상 userLocation 중심이라 이 버튼 자체를 안 그린다.
  function handleRecenterToMyLocation() {
    if (!kakaoMapRef.current || !userLocation) return
    kakaoMapRef.current.setCenter(new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng))
  }

  // 위치가 갱신될 때마다 반경원/내 위치 점만 옮긴다(지도는 다시 만들지 않음) — 내 위치 실시간 동기화
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !userLocation || !myLocationCircleRef.current) return
    const kakao = window.kakao
    const position = new kakao.maps.LatLng(userLocation.lat, userLocation.lng)
    myLocationCircleRef.current.setPosition(position)
    myLocationMarkerRef.current?.setPosition(position)
  }, [userLocation])

  // FAB 빠른 등록(App.jsx)이 성공하면 그 글 위치로 지도를 옮긴다. App이 매번 새 객체를
  // 넘겨주므로(좌표가 같아도) 연달아 눌러도 매번 재중심된다. placeholder 모드는 애초에
  // 항상 userLocation 중심이라(빠른 등록도 항상 userLocation에서만 일어남) 별도 처리가 없다.
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !kakaoMapRef.current || !recenterTarget) return
    const kakao = window.kakao
    kakaoMapRef.current.setCenter(new kakao.maps.LatLng(recenterTarget.lat, recenterTarget.lng))
  }, [recenterTarget])

  // 지도 상단 고정 헤더에 보여줄 동네명(동 단위) 조회 — 카카오 지도가 준비됐고 위치가 있을 때만.
  useEffect(() => {
    if (mapStatus !== 'ready' || !userLocation) return
    let cancelled = false
    reverseGeocodeDong(window.kakao, userLocation.lat, userLocation.lng).then((dong) => {
      if (!cancelled) setNeighborhoodName(dong)
    })
    return () => {
      cancelled = true
    }
  }, [mapStatus, userLocation])

  // nearbyPosts/뷰포트(드래그·줌)/선택 상태가 바뀔 때마다 카카오맵 마커를 다시 그린다.
  // 성능을 위해 현재 화면(bounds) 밖 마커는 애초에 만들지 않고, 화면 픽셀 거리 기준으로
  // 겹치는 마커는 숫자 클러스터 하나로 합친다(확대하면 다음 idle에서 다시 계산되어 풀린다).
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !kakaoMapRef.current) return
    const kakao = window.kakao
    const map = kakaoMapRef.current
    const bounds = map.getBounds()
    const projection = map.getProjection()

    const visiblePosts = nearbyPosts.filter((post) => (
      bounds.contain(new kakao.maps.LatLng(post.lat, post.lng))
    ))

    const projected = visiblePosts.map((post) => {
      const point = projection.containerPointFromCoords(new kakao.maps.LatLng(post.lat, post.lng))
      return { item: post, x: point.x, y: point.y }
    })

    const clusters = clusterByScreenPosition(projected, CLUSTER_CELL_PX)

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = clusters.map((cluster) => {
      if (cluster.type === 'cluster') {
        const center = cluster.items.reduce(
          (acc, post) => ({ lat: acc.lat + post.lat / cluster.count, lng: acc.lng + post.lng / cluster.count }),
          { lat: 0, lng: 0 },
        )
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(center.lat, center.lng),
          map,
          image: createKakaoClusterMarkerImage(kakao, cluster.count),
          zIndex: 5,
        })
        // 클러스터를 누르면 그 위치를 중심으로 확대한다 — 다음 idle 이벤트에서 재계산되어
        // 개별 마커로 펼쳐지거나, 여전히 겹치면 더 작은 클러스터로 다시 묶인다.
        kakao.maps.event.addListener(marker, 'click', () => {
          const level = map.getLevel()
          map.setLevel(Math.max(level - 2, 1), { anchor: marker.getPosition() })
        })
        return marker
      }

      const post = cluster.item
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(post.lat, post.lng),
        map,
        image: createKakaoMarkerImage(kakao, {
          color: CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR,
          glyphName: resolveGlyphName(post),
          tier: getMarkerTier(post.category),
          selected: post.id === selectedPostId,
        }),
        opacity: getFadeOpacity(post, now),
        zIndex: post.id === selectedPostId ? 8 : 4,
      })

      kakao.maps.event.addListener(marker, 'click', () => {
        onSelectPost(post.id)
      })

      return marker
    })
  }, [nearbyPosts, now, onSelectPost, selectedPostId, viewportTick])

  // visiblePins가 바뀔 때마다 빈 핀 마커를 다시 그린다(pinsVisible이 꺼져 있으면 빈 배열이라 전부 지워진다).
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !kakaoMapRef.current) return
    const kakao = window.kakao

    pinMarkersRef.current.forEach((marker) => marker.setMap(null))
    pinMarkersRef.current = visiblePins.map((pin) => {
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
  }, [visiblePins])

  // 장소검색으로 선택한 위치의 마커를 그리거나 옮기거나(재검색), 지운다(닫기).
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !kakaoMapRef.current) return
    const kakao = window.kakao

    if (!searchedPlace) {
      searchMarkerRef.current?.setMap(null)
      searchMarkerRef.current = null
      return
    }

    const position = new kakao.maps.LatLng(searchedPlace.lat, searchedPlace.lng)
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setPosition(position)
    } else {
      const marker = new kakao.maps.Marker({
        position,
        map: kakaoMapRef.current,
        image: createKakaoSearchMarkerImage(kakao),
        zIndex: 20,
      })
      kakao.maps.event.addListener(marker, 'click', () => setPlaceCardOpen(true))
      searchMarkerRef.current = marker
    }
  }, [searchedPlace])

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

  // 핀에서 시작한 작성이 성공적으로 끝나면(글쓰기든 근처 글 수정이든) 원본 빈 핀은 삭제한다.
  // App.jsx의 openCreateModal에 onConvertPin으로 넘겨서, 글 저장 성공 시 호출되게 한다.
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

  // 좌표에 실제로 서버 핀을 만드는 공용 로직 (지도 미리보기 / 장소검색 결과 선택에서 공유)
  async function createPinAt(lat, lng) {
    try {
      const ownerSecret = generateOwnerSecret()
      const created = await createPin({ lat, lng, ownerSecret, deviceSecret: getOrCreateDeviceSecret() })
      setPins((prev) => (prev.some((pin) => pin.id === created.id) ? prev : [created, ...prev]))
      savePinOwnership(created.id, ownerSecret)
      return created
    } catch (err) {
      console.error('[MapView] 핀 생성 실패', err)
      return null
    }
  }

  // PlacePreview에서 "이 위치에 핀 만들기"를 눌렀을 때만 실제로 서버에 핀을 만든다.
  async function handleCreatePinAtPreview() {
    if (!previewPosition) return

    setCreatingPin(true)
    try {
      const created = await createPinAt(previewPosition.lat, previewPosition.lng)
      if (created) {
        setPreviewPosition(null)
        setSelectedPinId(created.id)
      }
    } finally {
      setCreatingPin(false)
    }
  }

  // 장소검색 결과를 선택하면 핀을 만들지 않고 위치 마커만 띄운다 — 정보 카드는 마커를 눌러야 열린다.
  function handleSelectSearchPlace(place) {
    setSearchedPlace(place)
    setPlaceCardOpen(false)
    setPlaceCommunityOpen(false)
  }

  // 카드를 닫아도 마커는 남아있는다(다시 눌러서 재조회 가능). 다음 검색 선택 시에만 마커가 바뀐다.
  function closePlaceCard() {
    setPlaceCardOpen(false)
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
        <span className="map-placeholder-label">위치를 확인하고 있어요...</span>
      </div>
    )
  }

  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null

  // 장소검색으로 선택한 위치 반경 500m 글 — 사진 스트립과 "이 장소 커뮤니티"에서 함께 쓴다.
  const placePosts = searchedPlace
    ? filterPostsWithinRadius(activePosts, searchedPlace, COMMUNITY_RADIUS_METERS)
    : []
  const placePhotos = placePosts.filter((post) => post.image_url).map((post) => post.image_url)

  // "이번 주 우리 동네 소식" 카드용 — 커뮤니티 탭과 동일한 반경(내 위치 500m)에서 뽑는다.
  // App.jsx의 communityPosts와 같은 계산이라 여기서 다시 만들지 않고 그대로 재사용해도 됐겠지만,
  // MapView는 그 prop을 안 받고 있어서(activePosts만 받음) 이미 갖고 있는 필터 유틸로 다시
  // 구한다 — 새 prop을 추가로 늘리지 않기 위한 선택.
  const digestPool = userLocation ? filterPostsWithinRadius(activePosts, userLocation, COMMUNITY_RADIUS_METERS) : []
  const digestPosts = getWeeklyDigestPosts(digestPool, now)

  const placeholderBounds = userLocation ? getPlaceholderBounds(userLocation) : null
  const placeholderPositions = placeholderBounds ? projectToPercent(nearbyPosts, placeholderBounds) : new Map()
  const placeholderPinPositions = placeholderBounds ? projectToPercent(visiblePins, placeholderBounds) : new Map()
  const myCircleDiameterPx = Math.min(placeholderSize.width, placeholderSize.height)
    * (EXTERNAL_DISTANCE_METERS / PLACEHOLDER_VIEWPORT_RADIUS_METERS)

  // placeholder 모드는 실제 줌이 없어서 카카오 모드처럼 화면 픽셀 좌표로 옮겨 같은 클러스터링
  // 함수를 재사용한다(퍼센트 위치 → 실측 컨테이너 픽셀로 환산, 중복 로직 만들지 않음).
  const placeholderClusters = (placeholderSize.width > 0 && placeholderSize.height > 0)
    ? clusterByScreenPosition(
        nearbyPosts
          .map((post) => {
            const position = placeholderPositions.get(post.id)
            if (!position) return null
            return {
              item: post,
              x: (position.x / 100) * placeholderSize.width,
              y: (position.y / 100) * placeholderSize.height,
            }
          })
          .filter(Boolean),
        CLUSTER_CELL_PX,
      )
    : []

  return (
    <>
      {locationBanner}
      <div className="map-view">
        <div className="map-header">
          {neighborhoodName && (
            <span className="map-header-neighborhood">
              <Glyph name="pin" size={14} strokeWidth={2} />
              {neighborhoodName}
            </span>
          )}
          {mapStatus === 'ready' && (
            <PlaceSearch
              kakao={window.kakao}
              kakaoMap={kakaoMapRef.current}
              onWriteHere={(lat, lng) => onOpenCreateModal(lat, lng)}
              onSelectPlace={handleSelectSearchPlace}
            />
          )}
          <WeeklyDigest posts={digestPosts} onSelectPost={onSelectPost} />
        </div>

        <div className="map-side-rail">
          <CategoryFilter activeCategories={activeCategories} onToggle={onToggleCategory} />
          <button
            type="button"
            className={`pin-toggle-button${pinsVisible ? ' active' : ''}`}
            aria-pressed={pinsVisible}
            aria-label={pinsVisible ? '핀 숨기기' : '핀 보기'}
            onClick={() => {
              setPinsVisible((prev) => !prev)
              setSelectedPinId(null)
            }}
          >
            <Glyph name="pin" size={20} />
          </button>
          {KAKAO_MAP_KEY && (
            <button
              type="button"
              className="recenter-button"
              aria-label="내 위치로 이동"
              disabled={!userLocation}
              onClick={handleRecenterToMyLocation}
            >
              <Glyph name="locate" size={20} />
            </button>
          )}
        </div>

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
            <div className="my-location-dot" aria-hidden="true" />

            {placeholderClusters.map((cluster) => {
              const leftPct = (cluster.x / placeholderSize.width) * 100
              const topPct = (cluster.y / placeholderSize.height) * 100

              if (cluster.type === 'cluster') {
                const tier = getClusterTier(cluster.count)
                const diameter = CLUSTER_DIAMETER[tier]

                return (
                  <button
                    key={`cluster-${cluster.items[0].id}`}
                    type="button"
                    className="map-cluster-marker"
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: diameter,
                      height: diameter,
                      fontSize: CLUSTER_FONT_SIZE[tier],
                    }}
                    aria-label={`게시글 ${cluster.count}개 묶음`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpenClusterPosts(cluster.items)
                    }}
                  >
                    {cluster.count}
                  </button>
                )
              }

              const post = cluster.item
              const tier = getMarkerTier(post.category)

              return (
                <button
                  key={post.id}
                  type="button"
                  className={`map-marker map-marker--${tier}${post.id === selectedPostId ? ' selected' : ''}`}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    backgroundColor: CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR,
                    opacity: getFadeOpacity(post, now),
                  }}
                  aria-label={`${post.category} 게시글`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectPost(post.id)
                  }}
                >
                  <Glyph name={resolveGlyphName(post)} size={getMarkerTier(post.category) === 'large' ? 18 : 14} color="#fff" strokeWidth={2} />
                </button>
              )
            })}

            {visiblePins.map((pin) => {
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
                  <Glyph name="pin" size={17} color="#666666" strokeWidth={1.8} />
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <div
              ref={mapContainerRef}
              className="map-container"
              onTouchStart={handleKakaoTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onContextMenu={(event) => event.preventDefault()}
            />

            {mapStatus === 'loading' && (
              <div className="map-loading-overlay" role="status" aria-label="지도 불러오는 중">
                <span className="map-loading-spinner" aria-hidden="true" />
                <span>지도를 불러오고 있어요...</span>
              </div>
            )}

            {mapStatus === 'error' && (
              <div className="map-error-overlay" role="alert">
                <p>어, 지도가 잘 안 불러와지네요.<br />새로고침 한번 해볼까요?</p>
                <button type="button" className="map-error-retry-button" onClick={handleRetryMap}>
                  다시 시도
                </button>
              </div>
            )}
          </>
        )}

        {placeCommunityOpen && searchedPlace && (
          <div className="place-community-overlay">
            <div className="place-community-header">
              <button type="button" className="menu-back-button" onClick={() => setPlaceCommunityOpen(false)}>
                ‹ 뒤로
              </button>
              <div className="place-community-header-text">
                <h1 className="community-page-title">{searchedPlace.name}</h1>
                <p className="community-page-subtitle">이 장소 반경 500m 글이에요.</p>
              </div>
              <button
                type="button"
                className="place-community-write-button"
                onClick={() => onOpenCreateModal(searchedPlace.lat, searchedPlace.lng)}
              >
                <Glyph name="pencil" size={16} strokeWidth={2} /> 글쓰기
              </button>
            </div>
            <CommunityFeed
              posts={placePosts}
              activeCategories={activeCategories}
              onToggleCategory={onToggleCategory}
              onSelectPost={onSelectPost}
              fallbackPosts={activePosts}
              userLocation={userLocation}
              now={now}
            />
          </div>
        )}

        {!placeCommunityOpen && (
          <MapSheet
            posts={nearbyPosts}
            activeCategories={activeCategories}
            onToggleCategory={onToggleCategory}
            onSelectPost={onSelectPost}
            fallbackPosts={activePosts}
            userLocation={userLocation}
            now={now}
            onOpenQuickPost={onOpenQuickPost}
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

      {placeCardOpen && !placeCommunityOpen && (
        <PlaceCard
          place={searchedPlace}
          photos={placePhotos}
          onViewCommunity={() => setPlaceCommunityOpen(true)}
          onClose={closePlaceCard}
        />
      )}

      {openClusterPosts && (
        <div className="map-cluster-popover-backdrop" onClick={() => setOpenClusterPosts(null)}>
          <div className="map-cluster-popover" onClick={(event) => event.stopPropagation()}>
            <div className="map-cluster-popover-header">
              <p className="map-cluster-popover-title">이 근처 글 {openClusterPosts.length}개</p>
              <button
                type="button"
                className="map-cluster-popover-close"
                aria-label="닫기"
                onClick={() => setOpenClusterPosts(null)}
              >
                ✕
              </button>
            </div>
            <div className="map-cluster-popover-list">
              {openClusterPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  distance={userLocation ? getDistanceMeters(userLocation.lat, userLocation.lng, post.lat, post.lng) : null}
                  now={now}
                  onClick={() => {
                    setOpenClusterPosts(null)
                    onSelectPost(post.id)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedPin && (
        <PinMenu
          onWrite={() => {
            setSelectedPinId(null)
            onOpenCreateModal(selectedPin.lat, selectedPin.lng, {
              onConvertPin: () => convertPinToPost(selectedPin.id),
            })
          }}
          onDelete={() => handleDeletePin(selectedPin)}
          onClose={() => setSelectedPinId(null)}
          deleting={deletingPinId === selectedPin.id}
        />
      )}
    </>
  )
}

export default MapView
