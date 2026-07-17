import { useEffect, useMemo, useState } from 'react'
import { getPosts, subscribeToPostChanges } from './supabaseClient'
import { CATEGORIES, getElapsedRatio } from './categories'
import { getDistanceMeters } from './geo'

const NEARBY_RADIUS_METERS = 1000
// 하단 커뮤니티 탭과 메뉴 탭의 위치/건물별 커뮤니티가 함께 쓰는 기본 반경.
export const COMMUNITY_RADIUS_METERS = 500
// 이 반경 밖에서 쓴 글은 "외부작성"으로 등록된다. App.jsx(글쓰기 흐름)와 MapView.jsx(500m 원 표시)가 공유 — 중복 정의 금지.
export const EXTERNAL_DISTANCE_METERS = 500
const TICK_INTERVAL_MS = 30 * 1000
// 지도 마커 전용 노출 시간 — 카테고리 유효시간(만료)과 별개로, 작성 후 이 시간이 지나면
// 자유주제 글도 포함해 지도에서만 사라진다. 커뮤니티/메뉴 탭 피드에는 영향 없음(계속 무기한 열람 가능).
const MAP_VISIBLE_MINUTES = 60

// 지도 마커 전용 시간 컷오프. 카테고리 만료(getElapsedRatio)와 무관하게 작성 후 MAP_VISIBLE_MINUTES가
// 지나면 지도에서 제외한다 — usePosts의 nearbyPosts만 이 필터를 적용한다(피드용 목록은 대상 아님).
export function filterMapVisiblePosts(posts, now) {
  const visibleMs = MAP_VISIBLE_MINUTES * 60 * 1000
  return posts.filter((post) => now - new Date(post.created_at).getTime() < visibleMs)
}

// 카테고리 필터 + 만료 여부만 적용한, 위치 반경과 무관한 "활성 게시글" 목록.
// usePosts 내부 계산과 메뉴 탭의 위치/건물별 커뮤니티(임의의 중심 좌표 기준 반경 필터)가 공유한다 — 중복 정의 금지.
export function filterActivePosts(posts, activeCategories, now) {
  return posts.filter((post) => activeCategories.has(post.category) && getElapsedRatio(post, now) < 1)
}

// 임의의 중심 좌표 기준 반경(m) 필터. 메뉴 탭의 위치/건물별 커뮤니티 검색에서 사용한다.
export function filterPostsWithinRadius(posts, center, radiusMeters) {
  return posts.filter((post) => getDistanceMeters(center.lat, center.lng, post.lat, post.lng) <= radiusMeters)
}

// 게시글 목록/실시간 구독/카테고리 필터를 App 레벨에서 한 번만 관리해서
// 지도 탭과 커뮤니티 탭이 같은 데이터를 공유하게 한다.
export function usePosts(userLocation) {
  const [posts, setPosts] = useState([])
  const [now, setNow] = useState(() => Date.now())
  const [activeCategories, setActiveCategories] = useState(() => new Set(CATEGORIES))

  useEffect(() => {
    let cancelled = false
    getPosts().then((data) => {
      if (!cancelled) setPosts(data)
    })
    return () => {
      cancelled = true
    }
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
      },
    })
    return unsubscribe
  }, [])

  function toggleCategory(name) {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // 카테고리 필터가 켜져 있고 만료되지 않은 게시글(위치 반경과 무관, 메뉴 탭의 "전체 커뮤니티"용).
  const activePosts = useMemo(
    () => filterActivePosts(posts, activeCategories, now),
    [posts, activeCategories, now],
  )

  // 지도 탭 마커용 — 사용자 위치 반경 1km 이내 + 작성 후 1시간 이내(자유주제 포함, 지도 전용 컷오프).
  const nearbyPosts = useMemo(() => {
    if (!userLocation) return []
    return filterMapVisiblePosts(filterPostsWithinRadius(activePosts, userLocation, NEARBY_RADIUS_METERS), now)
  }, [activePosts, userLocation, now])

  // 하단 커뮤니티 탭용 — 사용자 위치 반경 500m 이내로 지도 탭보다 좁게 보여준다.
  const communityPosts = useMemo(() => {
    if (!userLocation) return []
    return filterPostsWithinRadius(activePosts, userLocation, COMMUNITY_RADIUS_METERS)
  }, [activePosts, userLocation])

  return { posts, setPosts, activePosts, nearbyPosts, communityPosts, now, activeCategories, toggleCategory }
}
