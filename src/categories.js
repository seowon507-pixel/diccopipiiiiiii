export const CATEGORIES = ['웨이팅', '혼잡', '사건사고', '교통']

// 카테고리별 마커/칩 색상. 채도는 절제하되 구분은 명확하게.
export const CATEGORY_COLORS = {
  웨이팅: '#3E6B99',
  혼잡: '#A6763A',
  사건사고: '#A63E3E',
  교통: '#3E8F6B',
}

export const DEFAULT_CATEGORY_COLOR = '#666666'

// 카테고리별 유효시간(분)
export const CATEGORY_VALID_MINUTES = {
  웨이팅: 30,
  혼잡: 20,
  사건사고: 120,
  교통: 60,
}

export const DEFAULT_VALID_MINUTES = 60
