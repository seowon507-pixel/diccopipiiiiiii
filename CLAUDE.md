# CLAUDE.md

이 파일은 프로젝트 루트에 두면 Claude(Cursor/Claude Code)가 매 요청마다
자동으로 참고한다. 목적: 반복 설명 제거, 불필요한 탐색 최소화, 일관된 결과물.

## 프로젝트 한 줄 요약
우리동네알림 — 지도 기반 동네 커뮤니티 앱.
실시간 알림(웨이팅/혼잡/사건사고/교통, 유효시간 있음)과
자유주제 커뮤니티 글(동네질문/동네소식/맛집/일상/취미, 유효시간 없음)을
지도 위에 남기고, 댓글/추천으로 소통한다.

## 스택 (재확인 불필요, 항상 이 조합 사용)
- Vite + React (함수형 컴포넌트 + Hooks만, 클래스 컴포넌트 금지)
- 지도: 카카오맵 JS SDK
- DB/실시간: Supabase (Postgres + Realtime)
- PWA: 현재 미적용 (vite-plugin-pwa 제거됨, 아래 8번 참고)

## 파일 구조 (이 구조를 벗어나지 말 것)
```
src/
  App.jsx              지도/커뮤니티/채팅 탭 전환 + 공유 상태(위치, 게시글) 소유 + PostDetail 오버레이
  MapView.jsx          지도 렌더링 전담(카카오맵 SDK, 핀, 장소 미리보기). posts/위치는 App에서 props로 받음
  useUserLocation.js    위치 추적 훅 (App에서 한 번만 구독, 탭들이 공유)
  usePosts.js           게시글 목록/실시간구독/카테고리필터 훅 (App에서 한 번만 구독, 탭들이 공유)
  supabaseClient.js     Supabase 연결 및 CRUD 함수, 다른 곳에서 직접 fetch 금지
  categories.js         카테고리 목록/색상/유효시간/경과율 계산(getElapsedRatio) 정의
  geo.js                하버사인 거리 계산 (공용, 중복 생성 금지)
  abuseCheck.js         중복 게시글 방지 로직
  myPosts.js            내가 쓴 글/핀의 owner_secret을 localStorage에 보관 (삭제 권한 확인용)
  components/
    TabBar.jsx             하단 탭바 (지도/커뮤니티/채팅 전환)
    CommunityPage.jsx      지도와 분리된 전체화면 커뮤니티 탭 (CommunityFeed를 감쌈)
    ChatRoom.jsx           내 위치 1km 이내 동네 전체 공용 실시간 채팅방
    PostModal.jsx        게시글 작성/수정 모달 (제목+카테고리+내용+사진+아이콘)
    CategoryFilter.jsx    지도 위 카테고리 필터 칩
    PostDetail.jsx        마커/카드 클릭 시 상세 + 댓글 + 확인/추천/삭제 버튼
    CommunityFeed.jsx     검색/필터/정렬 + 게시글 목록 (CommunityPage 안에서 사용)
    PostCard.jsx          피드의 게시글 카드 1개
    PlaceSearch.jsx        카카오맵 전용 장소/건물 검색 (kakao.maps.services)
    PinMenu.jsx            빈 핀 클릭 시 글쓰기/질문 등록/핀 삭제 메뉴
    PlacePreview.jsx       지도 클릭 시(핀 생성 전) 건물/장소 정보 + 핀 만들기/커뮤니티 보기
dummy-data.json          Supabase 연결 실패 시 fallback 데이터
.env                     실제 키 (git 추적 금지)
.env.example             키 이름만 적힌 템플릿
```
새 기능 추가 시 이 구조 안에서 배치할 위치를 먼저 판단하고,
애매하면 새 파일을 만들기보다 기존 파일에 함수를 추가하는 쪽을 우선한다.
BottomSheet.jsx는 14번 단계에서 탭 구조로 바뀌며 제거되었다 — 다시 만들지 말 것.

## 데이터 모델 — 매번 다시 묻지 말 것

### posts 테이블
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | pk, default gen_random_uuid() |
| lat, lng | float8 | 게시글 위치 |
| category | text | categories.js의 REALTIME_CATEGORIES/FREE_CATEGORIES 중 하나 |
| title | text | 제목 (nullable — 마이그레이션 이전 글은 없을 수 있음) |
| content | text | 본문 |
| confirm_count | int | default 0. 실시간 카테고리 전용 "아직 그런가요?" 확인수 |
| likes_count | int | default 0. 자유주제 카테고리 전용 "추천" 수 |
| post_type | text | default 'local'. 'local'(작성자가 500m 이내) / 'external'(500m 밖에서 쓴 "외부작성") |
| image_url | text | nullable. Storage 'post-images' 버킷의 공개 URL |
| icon | text | nullable. categories.js PIN_ICONS의 key. 없으면 카테고리 색 원 마커 |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | nullable. 수정 시에만 채워짐 (있으면 "수정됨" 표시) |

카테고리별 유효시간(categories.js CATEGORY_VALID_MINUTES에 있는 것만 만료됨):
웨이팅 30분 · 혼잡 20분 · 사건사고 2시간 · 교통 1시간.
자유주제(동네질문/동네소식/맛집/일상/취미)는 유효시간 없음, 만료/반투명 대상 아님.

### comments 테이블
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | pk |
| post_id | uuid | posts(id) FK, on delete cascade |
| content | text | |
| created_at | timestamptz | default now() |

### post_owners 테이블 (삭제 권한 확인 전용, 절대 직접 select/insert 만들지 말 것)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| post_id | uuid | pk, posts(id) FK, on delete cascade |
| owner_secret | text | 게시글 작성 시 클라이언트가 생성해 localStorage(myPosts.js)와 여기 동시에 저장 |

RLS는 켜져 있지만 정책이 하나도 없어서 anon/authenticated는 이 테이블에 절대
직접 접근 못 한다 — `create_post_with_owner`, `delete_own_post` 두 SECURITY DEFINER
함수로만 조작된다. **posts 테이블에 직접 삽입/삭제하는 코드를 새로 만들지 말고
반드시 이 두 RPC를 통해서만 생성/삭제할 것** — 이게 "작성자만 자기 글 삭제 가능"의
핵심 보안 장치다 (진짜 로그인 없이도 안전하게 소유권을 확인하는 방식).

comments 테이블은 RLS 활성화 + 누구나 select/insert 가능, DELETE 정책 없음(관리자가
지워야 할 땐 Supabase MCP execute_sql로 직접). posts 테이블도 일반 UPDATE는 여전히
누구나 가능(수정 권한까지 제한하진 않음 — 요청받은 건 삭제 권한뿐이었음).

게시글 작성 시 post_type 판정: 작성자의 현재 위치와 게시글 좌표 사이 거리가
500m 이내면 'local', 초과하면 'external'로 자동 등록된다(MapView.jsx의
EXTERNAL_DISTANCE_METERS). 지도 클릭/롱프레스뿐 아니라 PlaceSearch에서 검색 결과의
"여기에 글쓰기" 버튼으로도 원하는 곳에 바로 글을 쓸 수 있다 — 위치 제한은 결과
표시(문구)에만 영향을 주고, 어디든 글을 쓰는 것 자체는 막지 않는다.

### pins 테이블 (아직 글이 없는 "빈 핀")
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | pk, default gen_random_uuid() |
| lat, lng | float8 | 핀 위치 |
| created_at | timestamptz | default now() |

RLS 활성화 + 누구나 select 가능(다른 사용자 실시간 동기화용). insert/delete 정책은
없고 `create_pin_with_owner`/`delete_own_pin` RPC로만 조작한다(post_owners와
동일한 패턴). realtime publication에도 추가되어 있다.

### pin_owners 테이블 (핀 삭제 권한 확인 전용, post_owners와 동일한 패턴)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| pin_id | uuid | pk, pins(id) FK, on delete cascade |
| owner_secret | text | 핀 생성 시 클라이언트가 생성해 localStorage(myPosts.js)와 여기 동시에 저장 |

RLS는 켜져 있지만 정책이 없어 anon/authenticated는 절대 직접 접근 못 한다.

### chat_messages 테이블 (동네 전체 공용 실시간 채팅, 게시글 댓글과 별개)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | pk, default gen_random_uuid() |
| lat, lng | float8 | 발신자가 메시지를 보낼 당시의 위치 |
| content | text | 메시지 내용 |
| created_at | timestamptz | default now() |

RLS 활성화 + 누구나 select/insert 가능(익명 참여). UPDATE/DELETE 정책은 없음(관리자가
지워야 할 땐 Supabase MCP execute_sql로 직접). realtime publication에 추가되어 있다.
"동네" 범위는 별도 지역 테이블 없이 posts/pins와 동일하게 클라이언트에서 내 위치 기준
1km 반경으로 필터링한다(ChatRoom.jsx).

### Storage 'post-images' 버킷
public 버킷. 누구나 업로드/읽기 가능(post_images_public_read / post_images_anyone_upload
정책). supabaseClient.js의 uploadPostImage(file)로 업로드 후 공개 URL을 posts.image_url에
저장한다.

## 환경변수 (하드코딩 절대 금지)
```
VITE_KAKAO_MAP_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
모든 API 키는 `import.meta.env.VITE_*`로만 접근한다.
코드, 커밋 메시지, 주석 어디에도 실제 키 값을 남기지 않는다.

## 작업 방식 (효율성 규칙)
- 한 번에 여러 파일을 고쳐야 하면 각 파일마다 되묻지 말고 필요한 변경을
  모두 먼저 계획한 뒤 순서대로 적용한다.
- 이미 만든 함수/컴포넌트가 있는지 먼저 확인하고 재사용한다. 중복 함수
  생성 금지 (예: 거리 계산 함수는 하나만, utils.js 등에 통합).
- 파일 전체를 다시 출력하지 말고, 변경이 필요한 부분만 diff 형태로 수정한다.
- 에러 발생 시 관련 파일 전체를 다시 훑기보다, 에러 메시지가 가리키는
  파일/라인부터 확인한다.
- Git/Supabase MCP가 연결되어 있으면 터미널 명령을 사람에게 대신
  안내하지 말고 MCP로 직접 실행한다.
- 커밋은 기능 단위로 나눠서 하고, 메시지는 한국어로 `feat:`, `fix:`,
  `chore:` 접두사를 사용한다.

## 디자인 원칙
모노톤 베이스 + 포인트 컬러 1개. 네온/그라데이션/과한 장식 금지.
카테고리 색상은 구분은 명확하되 채도는 절제한다.

## 지금까지의 개발 단계 (완료된 것은 다시 만들지 않는다)
1. 프로젝트 세팅, MapView placeholder — 완료 여부는 src/MapView.jsx 확인
2. Supabase posts 테이블 + supabaseClient.js — 완료 여부는 파일 존재로 확인
3. 마커 표시, 게시글 작성 — components/PostModal.jsx 존재 여부로 확인
4. 유효시간 만료, 신뢰도 확인 — PostDetail.jsx 내 confirm_count 로직 확인
5. 위치 기반 필터 — Geolocation 관련 코드 존재 확인
6. 카테고리 필터 토글 — CategoryFilter.jsx 존재 확인
7. 중복 방지 — abuseCheck.js 존재 확인
8. PWA 설정 — 한 번 붙였다가 제거됨. Vercel에 파일 직접 업로드로 배포하는
   과정에서 아이콘(PNG) 바이너리를 안전하게 다룰 방법이 마땅치 않아
   vite-plugin-pwa/manifest/아이콘 세트를 통째로 뺐다. 필요해지면
   git 저장소를 정상적으로 clone → 아이콘 파일을 실제 바이너리로 커밋 →
   vite-plugin-pwa 재설치 순서로 다시 붙이는 게 안전하다. vite.config.js에
   VitePWA 플러그인이 없으면 아직 미적용 상태로 판단한다.
9. 카카오맵 실제 연동 — .env에 VITE_KAKAO_MAP_KEY 값이 실제로
   채워져 있는지로 판단 (placeholder 문구가 아직 남아있으면 미완료).
   카카오 디벨로퍼스 콘솔에서 "Web 플랫폼 도메인" 등록과 "카카오맵" 제품
   활성화가 별도로 필요하다는 점도 기억해둘 것 (둘 다 안 하면 도메인
   불일치/서비스 비활성 에러가 남). 완료됨 (프로덕션 도메인 등록 + 서비스
   활성화 확인함).
10. 커뮤니티 기능 확장 — 완료 여부는 src/components/CommunityFeed.jsx,
    PostDetail.jsx 존재로 확인. 포함된 것:
    - 위치 실시간 동기화(watchPosition, 지금은 useUserLocation.js)
    - 내 위치 기준 500m 반경 원 표시(카카오 Circle / placeholder는 CSS 원)
    - 500m 이내/밖 글쓰기 자동 구분(local/inquiry, post_type 컬럼)
    - 커뮤니티 피드 열람(원래는 하단 바텀시트였으나 14번 단계에서 별도
      탭으로 바뀜 — BottomSheet.jsx는 삭제됨)
    - 카카오 Places 키워드 장소 검색(PlaceSearch.jsx, kakao 모드 전용,
      placeholder 모드에서는 렌더링 안 됨 — 실제 지오코딩 대안 없음)
    - 피드 검색(제목/내용 텍스트 매칭, 클라이언트 사이드)/카테고리 필터/
      정렬(최신순, 추천많은순)
    - 댓글(comments 테이블, PostDetail.jsx)
    - 카테고리 다양화(자유주제 5개 추가, categories.js)
    마커 클릭 시 예전엔 카카오 InfoWindow(순수 HTML)를 썼지만, 지금은
    PostDetail.jsx라는 React 오버레이로 통일했다 — placeholder/카카오 두
    모드가 같은 상세/댓글 UI를 공유한다. 카카오 InfoWindow 관련 코드를
    다시 만들지 말 것.
11. 사진 업로드/작성자 삭제/장소검색 글쓰기/한글 맞춤법 — 완료 여부는
    src/myPosts.js 존재, posts.image_url 컬럼, post_owners 테이블 존재로 확인.
    - 사진 업로드: PostModal.jsx에 파일 입력(5MB 제한) → uploadPostImage로
      'post-images' 버킷에 업로드 → 공개 URL을 image_url에 저장. PostCard/
      PostDetail에서 표시.
    - 작성자 삭제: post_owners 테이블 + create_post_with_owner/delete_own_post
      RPC로 구현(위 데이터 모델 섹션 참고). PostDetail에 "내 글 삭제하기" 버튼은
      myPosts.js의 isMyPost(post.id)가 true일 때만 보인다.
    - 장소검색 글쓰기: PlaceSearch.jsx 검색 결과에 "여기에 글쓰기" 버튼 추가,
      선택 시 그 위치로 작성 모달이 열린다(카카오 모드 전용).
    - 한글 맞춤법: 진짜 맞춤법 API(부산대/다음 등) 연동은 안 했고, textarea/
      input에 spellCheck="true" lang="ko"만 넣어 브라우저/OS 기본 맞춤법 검사에
      맡긴다. 실제 문법 교정이 필요하면 서버(Edge Function) 프록시를 통한 외부
      맞춤법 API 연동이 별도로 필요하다는 점을 기억할 것.
    - "문의글"이라는 이름은 "외부작성"으로 바뀌었다(post_type 값도 'inquiry'
      대신 'external'). 코드에서 'inquiry' 문자열을 다시 쓰지 말 것.
12. 지도 핀 시스템(카카오맵 스타일) — 완료 여부는 src/components/PinMenu.jsx,
    pins/pin_owners 테이블 존재로 확인.
    - 지도를 클릭/롱프레스하면 바로 작성 모달이 열리지 않는다. 대신 그
      좌표에 서버(pins 테이블)에 즉시 저장되는 "빈 핀"(점선 원 + 📌)이
      생기고, 다른 사용자에게도 실시간으로 보인다.
    - 빈 핀을 클릭하면 PinMenu.jsx 메뉴가 뜬다: 글쓰기 / 질문 등록 / 핀 삭제.
      "질문 등록"은 별도 데이터 구조가 아니라 PostModal을 카테고리
      "동네질문"이 미리 선택된 상태로 여는 빠른 진입 경로일 뿐이다(원하면
      다른 카테고리로 바꿔도 됨).
    - 글쓰기/질문 등록으로 실제 게시글이 만들어지면(또는 5분/50m 내 기존
      글 수정으로 이어지면) 그 시작점이었던 빈 핀은 자동으로 삭제된다
      (MapView.jsx의 convertPinToPost). 핀 삭제 버튼을 직접 눌러도 같은
      RPC로 지워진다.
    - 보안 모델은 post_owners와 완전히 동일한 패턴이다: pins 테이블은
      누구나 읽을 수 있지만(select), pin_owners 테이블은 정책이 하나도
      없어 anon이 절대 직접 접근 못 하고, `create_pin_with_owner`/
      `delete_own_pin` SECURITY DEFINER 함수로만 생성/삭제된다. 소유권
      토큰은 myPosts.js의 savePinOwnership/getPinOwnerSecret 등으로
      localStorage에 보관한다(post 소유권과 같은 파일, 다른 storage key).
      **pins 테이블에 직접 삽입/삭제하는 코드를 새로 만들지 말 것.**
    - 핀 디자인(아이콘)은 categories.js의 PIN_ICONS 목록(이모지 세트)
      중 사용자가 PostModal 작성 화면에서 직접 골라 posts.icon 컬럼에
      저장한다. 카테고리 자동 배정이 아니라 사용자 선택 방식이다.
      아이콘을 고르지 않으면 기존처럼 카테고리 색 원 마커로 표시된다
      (getPinIconEmoji가 null을 반환 → 이모지 없이 렌더링).
    - PlaceSearch의 "여기에 글쓰기"는 핀을 거치지 않고 바로 작성 모달을
      연다(기존 동작 그대로 유지, pinId 없이 openCreateModal 호출).
13. 지도 클릭 시 장소 미리보기(건물/장소 정보 + 커뮤니티 이동) — 완료 여부는
    src/components/PlacePreview.jsx 존재로 확인.
    - 지도 클릭/롱프레스는 더 이상 곧바로 핀을 만들지 않는다. 먼저
      PlacePreview.jsx 미리보기가 뜨고(카카오 Geocoder.coord2Address로
      건물명/주소, categorySearch('AT4')로 근처 관광명소/공원류
      이름을 함께 조회), 그 안의 "📌 이 위치에 핀 만들기" 버튼을 눌러야
      비로소 pins 테이블에 실제로 핀이 생성된다. 핀 시스템(12번)과는
      의도적으로 분리된 별개 단계다 — 정보만 보고 취소해도 서버에는
      아무것도 남지 않는다.
    - 핀 생성이 성공하면 미리보기는 닫히고 그 핀이 바로 선택되어
      PinMenu(글쓰기/질문 등록/핀 삭제)로 이어진다.
    - PlacePreview에는 "🏘 커뮤니티 보기" 버튼도 있다. 이건 클릭한 위치
      기준으로 새로 필터링하는 게 아니라 커뮤니티 탭(내 위치 1km 이내
      CommunityFeed)으로 전환하는 것뿐이다 — 위치별 반경 필터는 아직 없다.
      (14번 단계에서 바텀시트가 탭으로 바뀌면서 "하단시트 열기"에서
      "커뮤니티 탭으로 전환"으로 동작이 바뀌었다.)
    - placeholder 모드(카카오 키 없음)에서는 kakao.maps.services가 없어
      건물명/주소 조회를 못 하므로 "이 위치의 주소 정보를 찾을 수
      없어요"로 표시되지만, 핀 만들기/커뮤니티 보기 버튼은 그대로 동작한다.
    - 카카오맵 JS SDK의 실제 장소 카테고리 검색 메서드는 categorySearch다
      (categorySearchByRadius는 존재하지 않는 이름 — REST API 경로명과
      혼동해 잘못 호출하면 클릭할 때마다 앱이 크래시난다. 다시 틀리지 말 것).
14. 지도/커뮤니티/채팅 탭 분리 + 동네 실시간 채팅 — 완료 여부는
    src/App.jsx가 useState로 activeTab을 관리하는지, src/components/TabBar.jsx·
    ChatRoom.jsx 존재로 확인.
    - 커뮤니티(게시글 목록)는 더 이상 지도 위에 겹치는 바텀시트가 아니라
      완전히 분리된 탭/화면이다(하단 TabBar로 지도⇄커뮤니티⇄채팅 전환).
      BottomSheet.jsx는 삭제됨 — 다시 만들지 말 것.
    - 위치(useUserLocation.js)와 게시글 목록/실시간구독/카테고리필터
      (usePosts.js)는 App.jsx가 한 번만 구독해서 세 탭이 공유한다.
      MapView.jsx는 이제 이 값들을 props로만 받고, 자체적으로 posts를
      fetch/구독하지 않는다(핀은 예외 — 핀은 지도 전용 개념이라 여전히
      MapView.jsx 안에서 자체 관리). getElapsedRatio는 categories.js로
      옮겨서 MapView와 usePosts가 공유한다(중복 정의 금지).
    - 게시글 상세(PostDetail), 확인/추천/삭제 핸들러도 App.jsx로 옮겨서
      지도 탭이든 커뮤니티 탭이든 어디서 글을 선택해도 같은 오버레이가
      뜨게 했다.
    - 새 chat_messages 테이블 기반 "동네 채팅"은 특정 게시글에 딸린
      기존 댓글(comments 테이블)과 완전히 별개다 — 동네 전체가 함께
      보는 하나의 실시간 공용 채팅방이며, 내 위치 1km 이내 메시지만
      필터링해서 보여준다(반경 개념은 posts/pins와 동일). 채팅 메시지는
      수정/삭제 기능이 없다(요청받지 않음, 필요해지면 그때 추가).

새 요청을 받으면 위 단계 중 어디까지 되어 있는지 코드를 먼저 확인하고,
이미 된 부분은 건드리지 않고 다음 단계부터 이어서 작업한다.

## 하지 말 것
- .env 파일 내용을 출력하거나 커밋에 포함시키는 것
- 카카오맵/Supabase 키를 코드에 직접 문자열로 삽입하는 것
- 기존 파일 구조를 임의로 재구성하는 것 (제안은 가능, 실행은 확인 후)
- 새 라이브러리 추가 전 기존 스택으로 해결 가능한지 먼저 검토하는 것 생략
