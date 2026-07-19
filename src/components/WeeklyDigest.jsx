import { useState } from 'react'
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, getReactionCount } from '../categories'
import { Glyph, resolveGlyphName } from '../iconGlyphs'

// 홈(지도 탭) 상단에 뜨는 "이번 주 우리 동네 소식" 자동 큐레이션 카드. posts는 이미
// usePosts.js의 getWeeklyDigestPosts로 선별된(최근 7일 + 반응 있는 글 중 인기순 상위 몇 개)
// 목록을 그대로 받는다 — 여기서는 순수하게 보여주기만 한다. 닫으면(×) 이 지도 화면이
// 다시 mount될 때까지만 숨겨진다(탭을 나갔다 오면 다시 보임 — 세션 내내 기억할 만큼
// 중요한 설정은 아니라는 판단, 필요해지면 그때 영속화).
function WeeklyDigest({ posts, onSelectPost }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || posts.length === 0) return null

  return (
    <div className="weekly-digest">
      <div className="weekly-digest-header">
        <span className="weekly-digest-title">
          <Glyph name="news" size={17} strokeWidth={1.8} />
          이번 주 우리 동네 소식
        </span>
        <button type="button" className="weekly-digest-close" aria-label="닫기" onClick={() => setDismissed(true)}>
          ×
        </button>
      </div>

      <div className="weekly-digest-list">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            className="weekly-digest-item"
            onClick={() => onSelectPost(post.id)}
          >
            <span
              className="weekly-digest-item-icon"
              style={{ backgroundColor: CATEGORY_COLORS[post.category] ?? DEFAULT_CATEGORY_COLOR }}
            >
              <Glyph name={resolveGlyphName(post)} size={17} color="#fff" strokeWidth={2} />
            </span>
            <span className="weekly-digest-item-text">
              <span className="weekly-digest-item-title">{post.title || post.content}</span>
              <span className="weekly-digest-item-meta">
                <Glyph name="heart" size={13} strokeWidth={2} /> {getReactionCount(post)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default WeeklyDigest
