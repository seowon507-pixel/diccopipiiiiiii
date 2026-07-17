// 실시간 알림형 카테고리 (유효시간이 있어 자동 만료된다)
export const REALTIME_CATEGORIES = ['웨이팅', '혼잡', '사건사고', '교통']

// 자유주제 커뮤니티 카테고리 (유효시간 없음)
export const FREE_CATEGORIES = ['동네질문', '동네소식', '맛집', '일상', '취미']

export const CATEGORIES = [...REALTIME_CATEGORIES, ...FREE_CATEGORIES]

// 카테고리별 마커/칩 색상. 채도는 절제하되 구분은 명확하게.
// index.css :root의 --color-cat-* 변수와 반드시 같은 값으로 유지할 것 — 여기 hex 리터럴을 CSS
// 변수 문자열로 바꾸지 말 것. 카카오맵 SVG 마커는 base64 data URI라 DOM 밖이라서 CSS 변수를
// 읽지 못하기 때문에(:root 스코프가 안 미침), 이 JS 상수가 실제 렌더링에 쓰이는 값의 원본이다.
export const CATEGORY_COLORS = {
  웨이팅: '#3E6B99',
  혼잡: '#A6763A',
  사건사고: '#A63E3E',
  교통: '#3E8F6B',
  동네질문: '#6E4C8C',
  동네소식: '#3E8F99',
  맛집: '#C9634F',
  일상: '#8C8339',
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
export function getElapsedRatio(post, referenceTime) {
  const validMinutes = CATEGORY_VALID_MINUTES[post.category]
  if (validMinutes == null) return 0

  const validMs = validMinutes * 60 * 1000
  const elapsedMs = referenceTime - new Date(post.created_at).getTime()
  return elapsedMs / validMs
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
