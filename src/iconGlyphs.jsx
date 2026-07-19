// 카테고리 마커 / 핀 아이콘 / 메뉴 등에 쓰는 라인 글리프 세트.
// 이모지를 없애고 흰색+쨍한 파랑 톤에 맞춘 단색 라인 아이콘으로 통일한다.
//
// 각 글리프는 24×24 좌표에 "선(stroke) 기반 도형"으로만 정의한다(개별 fill/stroke 색을 넣지
// 않음). 색은 감싸는 쪽에서 정한다:
//   - DOM: <Glyph> 컴포넌트가 stroke=currentColor로 감싸므로 부모 color를 물려받는다.
//   - 카카오맵 마커: markerGlyphSvg()가 흰색(#fff)으로 감싸 base64 data URI에 심는다.
//     (마커 SVG는 DOM 밖이라 currentColor를 못 읽어서 색을 직접 박아야 한다.)
//
// "점"이 필요한 디테일(느낌표 점, 바퀴 등)은 길이 0에 가까운 선 + round cap으로 표현한다.

export const GLYPHS = {
  // 마커/핀 공용
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.4 9.7l5.9-.9z"/>',
  alert: '<path d="M12 4 3 20h18L12 4z"/><line x1="12" y1="10" x2="12" y2="14.5"/><line x1="12" y1="17.4" x2="12" y2="17.5"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.4 9.4a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 3.9"/><line x1="12" y1="16.7" x2="12" y2="16.8"/>',
  bowl: '<path d="M4 11.5h16a8 8 0 0 1-16 0z"/><line x1="6" y1="20" x2="18" y2="20"/><path d="M9 7.4c0-1 .8-1.4.8-2.4M12 7.4c0-1 .8-1.4.8-2.4M15 7.4c0-1 .8-1.4.8-2.4"/>',
  cafe: '<path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8z"/><path d="M16 9h1.8a2.2 2.2 0 0 1 0 4.4H16"/><line x1="7" y1="3.6" x2="7" y2="5"/><line x1="10.5" y1="3.6" x2="10.5" y2="5"/>',
  car: '<path d="M5 17h14M5 17v-3.3l1.7-4A2 2 0 0 1 8.5 8.5h7a2 2 0 0 1 1.8 1.2l1.7 4V17M5 17v2M19 17v2"/><line x1="7.5" y1="17" x2="7.6" y2="17"/><line x1="16.4" y1="17" x2="16.5" y2="17"/>',
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/><path d="M10 19v-4h4v4"/>',
  heart: '<path d="M12 20 4.8 12.8a4.5 4.5 0 0 1 6.4-6.4l.8.8.8-.8a4.5 4.5 0 0 1 6.4 6.4L12 20z"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>',
  hourglass: '<path d="M7 3h10M7 21h10"/><path d="M8 3c0 3.5 3.5 5 4 9M16 3c0 3.5-3.5 5-4 9M8 21c0-3.5 3.5-5 4-9M16 21c0-3.5-3.5-5-4-9"/>',
  users: '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.4"/><path d="M2.5 20v-1A4.5 4.5 0 0 1 7 14.5h2A4.5 4.5 0 0 1 13.5 19v1"/><path d="M15 14.4a4 4 0 0 1 5.5 3.6V20"/>',
  megaphone: '<path d="M3 10v4l11 5V5L3 10z"/><path d="M14 8a4 4 0 0 1 0 8"/><path d="M6 14.5V18a1.5 1.5 0 0 0 2.7.9"/>',
  palette: '<path d="M12 3c-5 0-9 3.6-9 8 0 3.3 2.7 5.4 5.4 5.4.8 0 1.4.6 1.4 1.4 0 1.4 1 2.5 2.4 2.5 4.6 0 8.6-3.6 8.6-9C20.8 6.6 17 3 12 3z"/><line x1="7.5" y1="11" x2="7.6" y2="11"/><line x1="11" y1="7.5" x2="11.1" y2="7.5"/><line x1="15.5" y1="8.5" x2="15.6" y2="8.5"/>',
  // 메뉴/그 외
  buildings: '<path d="M3 21h18"/><path d="M5 21V8l6-3v16"/><path d="M11 21V9.5l8 3V21"/><line x1="8" y1="10" x2="8" y2="10.1"/><line x1="8" y1="14" x2="8" y2="14.1"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10.4 19a1.6 1.6 0 0 0 3.2 0"/>',
  key: '<circle cx="8" cy="8" r="3.5"/><path d="M10.6 10.6 20 20"/><path d="M17.5 17.5 19.5 15.5M15.5 15.5 17 14"/>',
  shield: '<path d="M12 3 5 6v5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-3z"/><path d="M9.4 12l1.9 1.9 3.3-3.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><line x1="16" y1="16" x2="21" y2="21"/>',
  pencil: '<path d="M14.5 5.5l4 4M4.5 20l1-4.2L16 5.3a2 2 0 0 1 3 3L8.7 18.9 4.5 20z"/>',
  locate: '<circle cx="12" cy="12" r="7"/><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><circle cx="12" cy="12" r="2.2"/>',
  building: '<path d="M6 21V4h9v17"/><path d="M15 9h3v12"/><path d="M5 21h14"/><line x1="9" y1="7.5" x2="9" y2="7.6"/><line x1="12" y1="7.5" x2="12" y2="7.6"/><line x1="9" y1="11" x2="9" y2="11.1"/><line x1="12" y1="11" x2="12" y2="11.1"/>',
  news: '<path d="M3 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13H4a1 1 0 0 1-1-1V6z"/><path d="M17 8h3a1 1 0 0 1 1 1v8.5a1.5 1.5 0 0 1-3 0"/><line x1="6" y1="8.5" x2="13" y2="8.5"/><line x1="6" y1="11.5" x2="13" y2="11.5"/><line x1="6" y1="14.5" x2="10" y2="14.5"/>',
}

// 카테고리 → 글리프 이름
export const CATEGORY_GLYPH = {
  웨이팅: 'hourglass',
  혼잡: 'users',
  사건사고: 'alert',
  교통: 'car',
  동네질문: 'question',
  동네소식: 'megaphone',
  맛집: 'bowl',
  일상: 'home',
  취미: 'palette',
}

// 작성자가 고를 수 있는 핀 아이콘 키 → 글리프 이름 (categories.js PIN_ICONS와 키 일치)
export const PIN_GLYPH = {
  pin: 'pin',
  star: 'star',
  alert: 'alert',
  question: 'question',
  food: 'bowl',
  cafe: 'cafe',
  car: 'car',
  home: 'home',
  heart: 'heart',
  flag: 'flag',
}

// post의 마커 글리프 이름 — 작성자가 고른 핀 아이콘(post.icon) 우선, 없으면 카테고리 기본.
export function resolveGlyphName(post) {
  return PIN_GLYPH[post?.icon] ?? CATEGORY_GLYPH[post?.category] ?? null
}

// DOM용 라인 글리프. 부모 color를 stroke로 물려받는다(color prop으로 강제 지정도 가능).
export function Glyph({ name, size = 24, strokeWidth = 1.9, color, className, style }) {
  const inner = GLYPHS[name]
  if (!inner) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

// 카카오맵 마커 SVG(문자열)에 심을 글리프 그룹. DOM 밖이라 색을 직접 박는다(기본 흰색).
// px = 마커 안에서 글리프가 차지할 대략적 지름. stroke-width는 스케일 보정해 실제 굵기를 맞춘다.
export function markerGlyphSvg(name, { cx, cy, px = 18, stroke = '#fff', strokeWidth = 2 }) {
  const inner = GLYPHS[name]
  if (!inner) return ''
  const s = px / 24
  const tx = cx - 12 * s
  const ty = cy - 12 * s
  return (
    `<g transform="translate(${tx} ${ty}) scale(${s})" fill="none" stroke="${stroke}"`
    + ` stroke-width="${(strokeWidth / s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`
  )
}
