import { useMemo, useState } from 'react'
import { CATEGORIES, CATEGORY_COLORS } from '../categories'
import PostCard from './PostCard.jsx'
import TrendingFallback from './TrendingFallback.jsx'

const SORT_OPTIONS = [
  { key: 'latest', label: '최신순' },
  { key: 'likes', label: '추천 많은순' },
]

// fallbackPosts: 이 목록(posts) 자체가 비어 있을 때 대신 보여줄 위치 무관 인기 콘텐츠(TrendingFallback).
function CommunityFeed({ posts, activeCategories, onToggleCategory, onSelectPost, fallbackPosts = [] }) {
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
        {posts.length === 0 ? (
          <div className="community-empty-state">
            <p className="community-empty">이 동네엔 아직 글이 없어요. 첫 글을 남겨보는 건 어때요?</p>
            <TrendingFallback posts={fallbackPosts} onSelectPost={onSelectPost} />
          </div>
        ) : filteredPosts.length === 0 ? (
          <p className="community-empty">앗, 조건에 맞는 글을 못 찾았어요. 검색어나 카테고리를 바꿔볼까요?</p>
        ) : (
          filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} onClick={() => onSelectPost(post.id)} />
          ))
        )}
      </div>
    </div>
  )
}

export default CommunityFeed
