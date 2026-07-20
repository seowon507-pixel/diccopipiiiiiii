import { useMemo, useState } from 'react'
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ON_COLOR_TEXT, getReactionCount } from '../categories'
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

function CommunityFeed({
  posts = [],
  activeCategories = new Set(),
  onToggleCategory,
  onSelectPost,
  status = 'success',
  errorMessage = null,
  contextLabel = '이 위치',
  onRetry,
  onWrite,
  fallbackPosts = [],
  userLocation = null,
  now,
}) {
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

  const hasSearch = Boolean(searchText.trim())
  const allCategoriesOff = activeCategories.size === 0
  const resolvedErrorMessage = typeof errorMessage === 'string' ? errorMessage : errorMessage?.message

  function renderState() {
    if (status === 'loading') {
      return <p className="community-empty" role="status">게시글을 불러오는 중...</p>
    }

    if (status === 'error' || resolvedErrorMessage) {
      return (
        <div className="community-empty-state" role="alert">
          <p>{resolvedErrorMessage || '게시글을 불러오지 못했어요.'}</p>
          {onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}
        </div>
      )
    }

    if (allCategoriesOff) {
      return <p className="community-empty">표시할 카테고리를 하나 이상 선택해 주세요.</p>
    }

    if (hasSearch && rankedPosts.length === 0) {
      return (
        <div className="community-empty-state">
          <p>검색 결과가 없어요.</p>
          <button type="button" onClick={() => setSearchText('')}>검색어 지우기</button>
        </div>
      )
    }

    return null
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
              style={active ? {
                backgroundColor: CATEGORY_COLORS[name],
                borderColor: CATEGORY_COLORS[name],
                color: CATEGORY_ON_COLOR_TEXT[name],
              } : undefined}
              aria-pressed={active}
              onClick={() => onToggleCategory?.(name)}
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
            aria-pressed={sortKey === option.key}
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
        {renderState() ?? (basePosts.length === 0 ? (
          <div className="community-empty-state">
            <p className="community-empty">
              {activeFavorite
                ? `${activeFavorite.name} 주변엔 아직 글이 없어요.`
                : `${contextLabel} 반경 500m에는 아직 글이 없어요. 첫 글을 남겨보는 건 어때요?`}
            </p>
            {onWrite && <button type="button" onClick={onWrite}>첫 글 작성하기</button>}
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
              onClick={() => onSelectPost?.(post.id)}
            />
          ))
        ))}
      </div>
    </div>
  )
}

export default CommunityFeed
