import { useMemo, useState } from 'react'
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ON_COLOR_TEXT } from '../categories'
import PostCard from './PostCard.jsx'

const SORT_OPTIONS = [
  { key: 'latest', label: '최신순' },
  { key: 'likes', label: '추천 많은순' },
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
}) {
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState('latest')

  const filteredPosts = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()

    const matched = keyword
      ? posts.filter((post) => (
        (post.title ?? '').toLowerCase().includes(keyword)
        || post.content.toLowerCase().includes(keyword)
      ))
      : posts

    return [...matched].sort((a, b) => {
      if (sortKey === 'likes') return (b.likes_count ?? 0) - (a.likes_count ?? 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [posts, searchText, sortKey])

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

    if (filteredPosts.length > 0) return null

    if (hasSearch) {
      return (
        <div className="community-empty-state">
          <p>검색 결과가 없어요.</p>
          <button type="button" onClick={() => setSearchText('')}>검색어 지우기</button>
        </div>
      )
    }

    return (
      <div className="community-empty-state">
        <p>{contextLabel} 반경 500m에는 아직 글이 없어요.</p>
        {onWrite && <button type="button" onClick={onWrite}>첫 글 작성하기</button>}
      </div>
    )
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
        {SORT_OPTIONS.map((option) => (
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

      <div className="community-list">
        {renderState()}
        {filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} onClick={() => onSelectPost?.(post.id)} />
        ))}
      </div>
    </div>
  )
}

export default CommunityFeed
