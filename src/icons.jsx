// 앱 전역에서 쓰는 라인/솔리드 아이콘 세트.
// - viewBox 24×24, currentColor 기반이라 부모의 color(탭바 활성/비활성 색, 포인트 컬러)를
//   그대로 물려받는다.
// - 탭바 아이콘은 filled prop을 받는다: 비활성 탭은 아웃라인(선), 활성 탭은 솔리드(면)로 그려서
//   쨍한 파랑(#0066FF)이 "덩어리"로 선명하게 찍히게 한다(iOS 하단탭 방식).
// - size prop으로 픽셀 크기를 조절한다(기본 24).
function Outline({ size = 24, strokeWidth = 1.8, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

function Solid({ size = 24, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

// 지도 — 접힌 종이 지도.
export function MapIcon({ filled, ...props }) {
  if (filled) {
    return (
      <Solid {...props}>
        <path d="M8.5 2 1.4 4.9A1 1 0 0 0 1 5.7v15.5a1 1 0 0 0 1.4.9L8.5 19.7l7 2.3 6.1-2.9a1 1 0 0 0 .4-.8V2.8a1 1 0 0 0-1.4-.9L15.5 4.3 8.5 2z" />
        <path d="M8 3.6 8.7 3.8V19.4L8 19.1V3.6z" fill="#fff" fillOpacity="0.92" />
        <path d="M15.3 4.6 16 4.3V19.9l-.7-.2V4.6z" fill="#fff" fillOpacity="0.92" />
      </Solid>
    )
  }
  return (
    <Outline {...props}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </Outline>
  )
}

// 커뮤니티 — 사람 무리(동네 이웃).
export function CommunityIcon({ filled, ...props }) {
  if (filled) {
    return (
      <Solid {...props}>
        <circle cx="9" cy="7.5" r="3.6" />
        <path d="M2.4 19.6C2.4 16 5.4 13.7 9 13.7s6.6 2.3 6.6 5.9c0 .8-.6 1.4-1.4 1.4H3.8c-.8 0-1.4-.6-1.4-1.4z" />
        <circle cx="17.4" cy="8.6" r="2.9" />
        <path d="M16 13.3c3.2 0 5.9 2 5.9 5.1 0 .7-.5 1.2-1.2 1.2h-2.4c.1-.3.2-.7.2-1v-.6c0-1.9-.9-3.5-2.5-4.7z" />
      </Solid>
    )
  }
  return (
    <Outline {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Outline>
  )
}

// 채팅 — 말풍선.
export function ChatIcon({ filled, ...props }) {
  if (filled) {
    return (
      <Solid {...props}>
        <path d="M12 3C6.5 3 2 6.9 2 11.7c0 2 .8 3.9 2.2 5.4-.2 1.4-.8 2.7-1.6 3.7-.3.3-.1.8.4.8 2-.1 3.9-.7 5.4-1.7 1.1.4 2.3.6 3.6.6 5.5 0 10-3.9 10-8.8S17.5 3 12 3z" />
      </Solid>
    )
  }
  return (
    <Outline {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Outline>
  )
}

// 메뉴 — 햄버거(솔리드는 굵은 라운드 바 3개).
export function MenuIcon({ filled, ...props }) {
  if (filled) {
    return (
      <Solid {...props}>
        <rect x="3" y="5" width="18" height="2.6" rx="1.3" />
        <rect x="3" y="10.7" width="18" height="2.6" rx="1.3" />
        <rect x="3" y="16.4" width="18" height="2.6" rx="1.3" />
      </Solid>
    )
  }
  return (
    <Outline {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </Outline>
  )
}

// 카테고리 필터 — 깔때기(항상 아웃라인, 조작 버튼이라 조용하게).
export function FilterIcon(props) {
  return (
    <Outline {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </Outline>
  )
}
