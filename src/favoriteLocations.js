import { generateOwnerSecret } from './myPosts'

const STORAGE_KEY = 'woorimadong_favorite_locations'

function readList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // localStorage를 쓸 수 없는 환경이면 조용히 무시한다.
  }
}

// "우리 아파트만" 같은 즐겨찾기 위치. 로그인 없이 이 브라우저에만 저장되고, CommunityFeed의
// 즐겨찾기 칩이 그 좌표를 필터 중심으로 써서 앱 전체(activePosts)에서 반경 재검색한다.
export function getFavoriteLocations() {
  return readList()
}

// id는 owner_secret과 같은 uuid 폴백 생성기를 재사용한다(신원 확인용이 아니라 그냥 고유 키라서
// 별도 id 생성 로직을 새로 만들지 않았다).
export function addFavoriteLocation({ name, lat, lng }) {
  const list = readList()
  const favorite = { id: generateOwnerSecret(), name, lat, lng }
  writeList([...list, favorite])
  return favorite
}

export function removeFavoriteLocation(id) {
  writeList(readList().filter((favorite) => favorite.id !== id))
}
