import { useMemo, useState } from 'react'
import { CATEGORIES, CATEGORY_COLORS, getReactionCount } from '../categories'
import { getDistanceMeters } from '../geo'
import { filterPostsWithinRadius, COMMUNITY_RADIUS_METERS } from '../usePosts'
import { getFavoriteLocations, addFavoriteLocation, removeFavoriteLocation } from '../favoriteLocations'
import PostCard from './PostCard.jsx'
import TrendingFallback from './TrendingFallback.jsx'

const SORT_OPTIONS = [
  { key: 'latest', label: '방금 올라온 순' },
  { key: 'popular', label: '인기순' },
  { key: 'distance', label: '거리순' },
]

// fallbackPosts: posts 자체가 비어 있을 때 대신 보여줄 위치 무관 인기 콘텐츠(TrendingFallback)이자,
// 즐겨찾기 위치를 골랐을 때 그 좌표 기준으로 다시 반경 필터링할 더 넓은 후보군이기도 하다 —
// posts는 이미 "내 주변 500m"처럼 특정 반경/장소로 좁혀져 있는 경우가 많아 다른 동네에 저장한
// 즐겨찾기("우리 아파트" 등)를 그 안에서는 찾을 수 없기 때문이다.
function CommunityFeed({ posts, activeCategories, onToggleCategory, onSelectPost, fallbackPosts = [], userLocation = null, now }) {
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState('latest')
  const [favorites, setFavorites] = useState(() => getFavoriteLocations())
  const [activeFavoriteId, setActiveFavoriteId] = useState(null)
  const [addingFavorite, setAddingFavorite] = useState(false)
  const [favoriteName, setFavoriteName] = useState('')

  const referenceTime = now ?? Date.now()
  const activeFavorite = favorites.find((favorite) => favorite.id === activeFavoriteId) ?? null

  const basePosts = activeFavorite
    ? filterPostsWithinRadius(fallbackPosts, activeFavorite, COMMUNITY_RADIUS_METERS)
    : posts

  const rankedPosts = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()

    const matched = keyword
      ? basePosts.filter((post) => (
        (post.title ?? '').toLowerCase().includes(keyword)
        || post.content.toLowerCase().includes(keyword)
      ))
      : basePosts

    const withDistance = matched.map((post) => ({
      post,
      distance: userLocation ? getDistanceMeters(userLocation.lat, userLocation.lng, post.lat, post.lng) : null,
    }))

    return withDistance.sort((a, b) => {
      if (sortKey === 'distance' && userLocation) return a.distance - b.distance
      if (sortKey === 'popular') return getReactionCount(b.post) - getReactionCount(a.post)
      return new Date(b.post.created_at) - new Date(a.post.created_at)
    })
  }, [basePosts, searchText, sortKey, userLocation])

  function handleSaveFavorite(event) {
    event.preventDefault()
    const name = favoriteName.trim()
    if (!name || !userLocation) return

    const favorite = addFavoriteLocation({ name, lat: userLocation.lat, lng: userLocation.lng })
    setFavorites((prev) => [...prev, favorite])
    setActiveFavoriteId(favorite.id)
    setFavoriteName('')
    setAddingFavorite(false)
  }

  function handleRemoveFavorite(id) {
    removeFavoriteLocation(id)
    setFavorites((prev) => prev.filter((favorite) => favorite.id !== id))
    setActiveFavoriteId((prev) => (prev === id ? null : prev))
  }

  return (
    <div className="community-feed">
      <input
        className="community-search-input"
        value={searchText}
        placeholder="제목, 내용 검색"
        onChange={(event) => setSearchText(event.target.value)}
      />

      <div className="community-filter-row">
        {CATEGORIES.map((name) => {
          const active = activeCategories.has(name)
          return (
            <button
              key={name}
              type="button"
              className={`community-category-chip${active ? ' active' : ''}`}
              style={active ? { backgroundColor: CATEGORY_COLORS[name], borderColor: CATEGORY_COLORS[name] } : undefined}
              onClick={() => onToggleCategory(name)}
            >
              {name}
            </button>
          )
        })}
      </div>

      <div className="community-sort-row">
        {SORT_OPTIONS.filter((option) => option.key !== 'distance' || userLocation).map((option) => (
          <button
            key={option.key}
            type="button"
            className={`community-sort-chip${sortKey === option.key ? ' active' : ''}`}
            onClick={() => setSortKey(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="community-favorite-row">
        <button
          type="button"
          className={`community-favorite-chip${!activeFavorite ? ' active' : ''}`}
          onClick={() => setActiveFavoriteId(null)}
        >
          전체
        </button>

        {favorites.map((favorite) => (
          <div key={favorite.id} className="community-favorite-item">
            <button
              type="button"
              className={`community-favorite-chip${activeFavoriteId === favorite.id ? ' active' : ''}`}
              onClick={() => setActiveFavoriteId(favorite.id)}
            >
              ⭐ {favorite.name}
            </button>
            <button
              type="button"
              className="community-favorite-remove"
              aria-label={`${favorite.name} 즐겨찾기 삭제`}
              onClick={() => handleRemoveFavorite(favorite.id)}
            >
              ×
            </button>
          </div>
        ))}

        {userLocation && !addingFavorite && (
          <button
            type="button"
            className="community-favorite-chip community-favorite-add"
            onClick={() => setAddingFavorite(true)}
          >
            + 즐겨찾기
          </button>
        )}
      </div>

      {addingFavorite && (
        <form className="community-favorite-form" onSubmit={handleSaveFavorite}>
          <input
            className="community-favorite-input"
            value={favoriteName}
            maxLength={12}
            autoFocus
            placeholder="예: 우리 아파트"
            onChange={(event) => setFavoriteName(event.target.value)}
          />
          <button type="submit" className="community-favorite-save" disabled={!favoriteName.trim()}>
            현재 위치로 저장
          </button>
          <button
            type="button"
            className="community-favorite-cancel"
            onClick={() => {
              setAddingFavorite(false)
              setFavoriteName('')
            }}
          >
            취소
          </button>
        </form>
      )}

      <div className="community-list">
        {basePosts.length === 0 ? (
          <div className="community-empty-state">
            <p className="community-empty">
              {activeFavorite
                ? `${activeFavorite.name} 주변엔 아직 글이 없어요.`
                : '이 동네엔 아직 글이 없어요. 첫 글을 남겨보는 건 어때요?'}
            </p>
            <TrendingFallback posts={fallbackPosts} onSelectPost={onSelectPost} userLocation={userLocation} now={referenceTime} />
          </div>
        ) : rankedPosts.length === 0 ? (
          <p className="community-empty">앗, 조건에 맞는 글을 못 찾았어요. 검색어나 카테고리를 바꿔볼까요?</p>
        ) : (
          rankedPosts.map(({ post, distance }) => (
            <PostCard
              key={post.id}
              post={post}
              distance={distance}
              now={referenceTime}
              onClick={() => onSelectPost(post.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default CommunityFeed
