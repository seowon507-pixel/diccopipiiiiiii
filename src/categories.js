// 실시간 알림형 카테고리 (유효시간이 있어 자동 만료된다)
export const REALTIME_CATEGORIES = ['웨이팅', '혼잡', '사건사고', '교통']

// 자유주제 커뮤니티 카테고리 (유효시간 없음)
export const FREE_CATEGORIES = ['동네질문', '동네소식', '맛집', '일상', '취미']

export const CATEGORIES = [...REALTIME_CATEGORIES, ...FREE_CATEGORIES]

// 카테고리별 마커/칩 색상. 채도는 절제하되 구분은 명확하게.
// index.css :root의 --color-cat-* 변수와 반드시 같은 값으로 유지할 것 — 여기 hex 리터럴을 CSS
// 변수 문자열로 바꾸지 말 것. 카카오맵 SVG 마커는 base64 data URI라 DOM 밖이라서 CSS 변수를
// 읽지 못하기 때문에(:root 스코프가 안 미침), 이 JS 상수가 실제 렌더링에 쓰이는 값의 원본이다.
// 혼잡/교통/동네소식/맛집/일상 5개는 WCAG AA 감사(28번 단계)에서 흰 배경 텍스트 대비가
// 3.6~4.0:1로 4.5:1 미달이라 어둡게 보정했다 — index.css --color-cat-*를 고칠 때 반드시
// 여기도 같이 고칠 것(반대도 마찬가지).
export const CATEGORY_COLORS = {
  웨이팅: '#3E6B99',
  혼잡: '#916733',
  사건사고: '#A63E3E',
  교통: '#398262',
  동네질문: '#6E4C8C',
  동네소식: '#377F88',
  맛집: '#C2523B',
  일상: '#7F7634',
  취미: '#8C4C74',
}

// index.css의 --color-gray-500과 같은 값. 위와 같은 이유로 hex 리터럴 유지.
export const DEFAULT_CATEGORY_COLOR = '#666666'

// 색약 사용자를 위해 색상만으로 카테고리를 구분하지 않도록, 마커에 항상 함께 표시할 기본 아이콘.
// 글쓴이가 PIN_ICONS 중 하나를 직접 골랐으면 그걸 우선하고(getMarkerIcon), 안 골랐을 때만 이걸 쓴다.
export const CATEGORY_ICONS = {
  웨이팅: '⏳',
  혼잡: '👥',
  사건사고: '❗',
  교통: '🚗',
  동네질문: '❓',
  동네소식: '📢',
  맛집: '🍜',
  일상: '🏠',
  취미: '🎨',
}

// 마커에 표시할 아이콘 — 작성자가 고른 아이콘(post.icon)이 있으면 그걸, 없으면 카테고리 기본
// 아이콘을 보여준다(색약 대응, 완전히 아이콘이 없는 마커는 없게 함).
export function getMarkerIcon(post) {
  return getPinIconEmoji(post.icon) ?? CATEGORY_ICONS[post.category] ?? null
}

// 마커 크기 구분 — 실시간 알림형(웨이팅/혼잡/사건사고/교통)은 눈에 잘 띄게 크게,
// 자유주제 커뮤니티 글은 작게. MapView의 3단계 마커 크기 로직이 사용한다.
export function getMarkerTier(category) {
  return REALTIME_CATEGORIES.includes(category) ? 'large' : 'small'
}

// 카테고리별 유효시간(분). 여기 없는 카테고리(자유주제)는 만료되지 않는다.
export const CATEGORY_VALID_MINUTES = {
  웨이팅: 30,
  혼잡: 20,
  사건사고: 120,
  교통: 60,
}

export function categoryHasExpiry(category) {
  return CATEGORY_VALID_MINUTES[category] != null
}

// 카테고리 유효시간 대비 경과 비율. 자유주제(유효시간 없음)는 항상 0을 반환한다.
// MapView(마커 반투명 처리)와 usePosts(반경 필터의 만료 판정)가 공유하는 공용 함수 — 중복 정의 금지.
//
// 경과 기준 시각은 created_at이 아니라 "가장 최근에 이 글이 여전히 유효하다고 확인된 시각"이다
// (updated_at 수정, last_confirmed_at "아직 그런가요?" 확인 중 더 늦은 쪽). created_at만 봤다면
// 웨이팅 29분째에 100명이 "아직 그런가요?"를 눌러도 30분이 지나는 순간 그대로 만료돼버려서
// 신고/만료 로직 점검(4단계) 중 발견한 문제였다 — 실시간으로 계속 확인되는 글은 그만큼
// 만료 시점도 뒤로 밀려야 "오래된 정보"라는 판정이 실제와 맞아떨어진다.
export function getElapsedRatio(post, referenceTime) {
  const validMinutes = CATEGORY_VALID_MINUTES[post.category]
  if (validMinutes == null) return 0

  const validMs = validMinutes * 60 * 1000
  const lastConfirmedMs = post.last_confirmed_at ? new Date(post.last_confirmed_at).getTime() : 0
  const lastUpdatedMs = new Date(post.updated_at ?? post.created_at).getTime()
  const referenceStart = Math.max(lastConfirmedMs, lastUpdatedMs)
  const elapsedMs = referenceTime - referenceStart
  return elapsedMs / validMs
}

// 유효시간의 70% 이상 지나면(자유주제는 getElapsedRatio가 항상 0이라 대상 아님) 옅게 표시한다.
// MapView(마커)와 PostCard(피드 카드)가 공유하는 공용 함수 — 중복 정의 금지.
const NEAR_EXPIRY_RATIO = 0.7
const NEAR_EXPIRY_OPACITY = 0.45

export function getFadeOpacity(post, referenceTime) {
  return getElapsedRatio(post, referenceTime) >= NEAR_EXPIRY_RATIO ? NEAR_EXPIRY_OPACITY : 1
}

// 카테고리 상관없이 반응 하나로 합친 값(정렬용) — 실시간 알림은 confirm_count, 자유주제는
// likes_count만 실제로 쌓이고 나머지 하나는 항상 0이라 그냥 더해도 안전하다.
export function getReactionCount(post) {
  return (post.confirm_count ?? 0) + (post.likes_count ?? 0)
}

// 글 작성 시 고를 수 있는 마커 아이콘 세트. 선택하지 않으면 카테고리 색 원 마커로 표시된다.
export const PIN_ICONS = [
  { key: 'pin', emoji: '📍' },
  { key: 'star', emoji: '⭐' },
  { key: 'alert', emoji: '❗' },
  { key: 'question', emoji: '❓' },
  { key: 'food', emoji: '🍜' },
  { key: 'cafe', emoji: '☕' },
  { key: 'car', emoji: '🚗' },
  { key: 'home', emoji: '🏠' },
  { key: 'heart', emoji: '❤️' },
  { key: 'flag', emoji: '🚩' },
]

export function getPinIconEmoji(key) {
  return PIN_ICONS.find((icon) => icon.key === key)?.emoji ?? null
}

// 댓글 이모지 반응 팔레트(Comment.jsx). 픽할 게 너무 많아지지 않게 자주 쓰는 5개로 고정.
export const COMMENT_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢']

// FAB → 카테고리 그리드에서 카테고리만 골라 즉시 등록할 때 채워 넣는 기본 본문(content는 NOT
// NULL이라 반드시 값이 있어야 한다). title은 비워두고(null) 이 문장 하나로 글이 끝난다 —
// "자세히 쓰기"로 넘어가면 이 기본값 없이 PostModal에서 직접 제목/본문을 채운다.
export const QUICK_POST_MESSAGES = {
  웨이팅: '여기 웨이팅 있어요',
  혼잡: '여기 혼잡해요',
  사건사고: '여기 사건사고가 있어요',
  교통: '여기 교통 상황이 있어요',
  동네질문: '동네에 질문 있어요',
  동네소식: '동네 소식 공유해요',
  맛집: '여기 맛집이에요',
  일상: '일상을 남겼어요',
  취미: '취미 이야기예요',
}
