import { useEffect, useMemo, useState } from 'react'
import { getPosts, subscribeToPostChanges } from './supabaseClient'
import { CATEGORIES, getElapsedRatio } from './categories'
import { getDistanceMeters } from './geo'

const NEARBY_RADIUS_METERS = 1000
const TICK_INTERVAL_MS = 30 * 1000

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

  return { posts, setPosts, nearbyPosts, now, activeCategories, toggleCategory }
}
