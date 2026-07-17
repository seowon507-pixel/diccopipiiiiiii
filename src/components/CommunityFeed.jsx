import { useMemo, useState } from 'react'
import { CATEGORIES, CATEGORY_COLORS } from '../categories'
import PostCard from './PostCard.jsx'

const SORT_OPTIONS = [
  { key: 'latest', label: '최신순' },
  { key: 'likes', label: '추천 많은순' },
]

function CommunityFeed({ posts, activeCategories, onToggleCategory, onSelectPost }) {
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
        {SORT_OPTIONS.map((option) => (
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

      <div className="community-list">
        {filteredPosts.length === 0 && <p className="community-empty">표시할 게시글이 없어요.</p>}
        {filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} onClick={() => onSelectPost(post.id)} />
        ))}
      </div>
    </div>
  )
}

export default CommunityFeed
