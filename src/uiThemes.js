export const BASE_UI_THEME = 'alley'

export const BASE_UI_THEME_META = {
  key: BASE_UI_THEME,
  number: '02',
  name: '골목 게시판',
  description: '현재 기본 디자인',
  swatches: ['#f3eee4', '#252823', '#a84531'],
}

// 다섯 명의 서로 다른 디자이너가 각자 한 방향만 맡은 비교 시안이다.
// 차이는 테마 카피가 아니라 레이아웃·타이포·밀도·컴포넌트 규칙으로 표현한다.
export const UI_THEME_OPTIONS = [
  {
    key: 'civic',
    number: '03',
    name: 'Civic Grid',
    description: '정밀한 공공정보 그리드',
    swatches: ['#f6f7f5', '#111820', '#1646d8'],
  },
  {
    key: 'editorial',
    number: '04',
    name: 'Korean Editorial',
    description: '한국어 타이포 중심 편집',
    swatches: ['#f4f1ea', '#171717', '#3157d5'],
  },
  {
    key: 'friendly',
    number: '05',
    name: 'Friendly Mobile',
    description: '한 손 조작 중심 모바일 네이티브',
    swatches: ['#fff9ee', '#202522', '#28785a'],
  },
  {
    key: 'spatial',
    number: '06',
    name: 'Spatial Desk',
    description: '고밀도 공간정보 작업 도구',
    swatches: ['#f2f0e9', '#17212b', '#246bce'],
  },
  {
    key: 'clear',
    number: '07',
    name: 'Clear Stack',
    description: '고대비·저인지부하 단일 열',
    swatches: ['#ffffff', '#111827', '#005fcc'],
  },
]

const STANDARD_NAV = [
  { key: 'map', label: '지도', icon: 'map' },
  { key: 'community', label: '커뮤니티', icon: 'community' },
  { key: 'chat', label: '채팅', icon: 'chat' },
  { key: 'menu', label: '메뉴', icon: 'menu' },
]

export const THEME_NAVIGATION = {
  civic: STANDARD_NAV,
  editorial: STANDARD_NAV,
  friendly: [
    { key: 'map', label: '지도', icon: 'map' },
    { key: 'community', label: '동네생활', icon: 'community' },
    { key: 'chat', label: '채팅', icon: 'chat' },
    { key: 'menu', label: '메뉴', icon: 'menu' },
  ],
  spatial: [
    { key: 'map', label: '지도', icon: 'map' },
    { key: 'community', label: '지역목록', icon: 'community' },
    { key: 'chat', label: '채팅', icon: 'chat' },
    { key: 'menu', label: '설정', icon: 'menu' },
  ],
  clear: [
    { key: 'map', label: '지도', icon: 'map' },
    { key: 'community', label: '기록', icon: 'community' },
    { key: 'chat', label: '대화', icon: 'chat' },
    { key: 'menu', label: '메뉴', icon: 'menu' },
  ],
}

const STORAGE_KEY = 'woorimadong_ui_theme_preview'
const VALID_THEMES = new Set([BASE_UI_THEME, ...UI_THEME_OPTIONS.map((theme) => theme.key)])

export function getUiThemeMeta(theme) {
  return UI_THEME_OPTIONS.find((option) => option.key === theme) ?? BASE_UI_THEME_META
}

export function getSavedUiTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return VALID_THEMES.has(saved) ? saved : BASE_UI_THEME
  } catch {
    return BASE_UI_THEME
  }
}

export function saveUiTheme(theme) {
  if (!VALID_THEMES.has(theme)) return
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 저장이 막혀도 현재 탭의 상태로는 계속 비교할 수 있다.
  }
}
