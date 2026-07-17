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
    CommunityPage.jsx      지도와 분리된 전체화면 커뮤니티 탭 — 건물 목록(BuildingList)을
                           먼저 보여주고, 건물을 선택해야 그 건물의 CommunityFeed가 뜬다
    BuildingList.jsx       좌표 클러스터(건물) 목록. 카카오맵 있으면 역지오코딩으로 건물명
                           표시, 없으면(placeholder) 순번만 — 18번 참고
    ChatRoom.jsx           내 위치 1km 이내 동네 전체 공용 실시간 채팅방
    PostModal.jsx        게시글 작성/수정 모달 (제목+카테고리+내용+사진+아이콘)
    CategoryFilter.jsx    지도 위 카테고리 필터 칩
    PostDetail.jsx        마커/카드 클릭 시 상세 + 댓글 + 확인/추천/삭제 버튼
    CommunityFeed.jsx     검색/필터/정렬 + 게시글 목록 (CommunityPage 안에서 사용)
    PostCard.jsx          피드의 게시글 카드 1개
    PlaceSearch.jsx        카카오맵 전용 장소/건물 검색 (kakao.maps.services)
    PinMenu.jsx            빈 핀 클릭 시 글쓰기/질문 등록/핀 삭제 메뉴
    PlacePreview.jsx       지도 클릭 시(핀 생성 전) 건물/장소 정보 + 핀 만들기/커뮤니티 보기
    PlaceCard.jsx          장소검색 결과 마커 클릭 시 뜨는 카드 — 이름/카테고리/주소/전화,
                           그 위치 반경 500m 글 중 사진, 카카오맵 상세보기 링크, 장소 커뮤니티 진입
    MenuPage.jsx           메뉴 탭 — 거리 제한 없는 전체 커뮤니티, 검색한 임의 장소 반경
                           커뮤니티(filterPostsWithinRadius/COMMUNITY_RADIUS_METERS 재사용)
    MapSheet.jsx           지도 탭 위에 겹치는 드래그형 시트(주변 글 목록). 평소 화면 중간,
                           위로 끝까지/아래로 끝까지(지도만 보이게) 드래그 가능 — 17번 참고
dummy-data.json          Supabase 연결 실패 시 fallback 데이터
.env                     실제 키 (git 추적 금지)
.env.example             키 이름만 적힌 템플릿
```
새 기능 추가 시 이 구조 안에서 배치할 위치를 먼저 판단하고,
애매하면 새 파일을 만들기보다 기존 파일에 함수를 추가하는 쪽을 우선한다.
BottomSheet.jsx(14번 단계에서 제거된 옛 파일)는 다시 만들지 말 것 — 단, 16번 단계에서
그 자리를 대신하는 새 드래그형 시트 MapSheet.jsx가 지도 탭 전용으로 추가되었다(아래 참고).
이건 BottomSheet.jsx를 되살린 게 아니라 별도 이름의 새 컴포넌트이니 헷갈리지 말 것.

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
동일한 패턴). realtime publication에도 추가되어 있다. 여기에 더해
`delete_expired_pins(p_older_than_minutes int default 60)` RPC가 있다 — 소유자
확인 없이 나이만 보고(now() - created_at > 기준) 지우는 SECURITY DEFINER 함수라
접속한 클라이언트 아무나 호출해도 안전하다(멱등). 20번 단계 참고.

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
      건물명/주소, categorySearchByRadius('AT4')로 근처 관광명소/공원류
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
14. 지도/커뮤니티/채팅 탭 분리 + 동네 실시간 채팅 — 완료 여부는
    src/App.jsx가 useState로 activeTab을 관리하는지, src/components/TabBar.jsx·
    ChatRoom.jsx 존재로 확인.
    - 커뮤니티(게시글 목록)는 더 이상 지도 위에 겹치는 바텀시트가 아니라
      완전히 분리된 탭/화면이다(하단 TabBar로 지도⇄커뮤니티⇄채팅 전환).
      BottomSheet.jsx는 이 단계에서 삭제됐다(다시 만들지 말 것) — 단,
      16번 단계에서 지도 탭 전용으로 별도 이름의 새 드래그형 시트
      MapSheet.jsx가 추가됐다. TabBar 탭 전환 구조 자체는 안 바뀜.
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
    - (문서에는 없었지만 코드에는 이미 있던 부분) 메뉴 탭(MenuPage.jsx)이
      TabBar에 네 번째 탭으로 추가되어 있다: "전체 커뮤니티"(거리 제한
      없이 모든 글) + "위치·건물별 커뮤니티"(장소검색으로 고른 임의
      좌표 반경 500m 글, usePosts.js의 filterPostsWithinRadius/
      COMMUNITY_RADIUS_METERS 재사용). 15번의 PlaceCard "이 장소 커뮤니티
      보기"와 16번의 MapSheet도 이 반경 필터 유틸을 그대로 재사용한다 —
      "위치 기반 커뮤니티 반경 필터"를 새로 만들지 말 것.
15. 장소검색 결과 = 위치 전용 마커 + 정보 카드 — 완료 여부는
    src/components/PlaceCard.jsx 존재로 확인.
    - PlaceSearch에서 검색 결과를 선택해도 pins 테이블에 실제 핀이
      생성되지 않는다(12번의 "빈 핀" 글쓰기 시스템과 완전히 무관). 대신
      MapView.jsx가 클라이언트 상태(searchedPlace)로만 들고 있는 큰
      물방울 모양 마커(🏢)가 그 좌표에 뜬다 — 서버에는 아무것도 안 남음.
    - 마커를 클릭해야만 PlaceCard가 열린다(선택 즉시 자동으로 뜨지
      않음). 카드에는 이름/카테고리/주소/전화(카카오 place 데이터),
      그 위치 반경 500m 안 게시글 중 사진이 있는 것들의 썸네일,
      카카오맵 공식 상세페이지 링크(place_url — 실제 건물 사진은 카카오
      지도 JS SDK/키워드검색 API 자체에는 없어서 링크로 대체함),
      "이 장소 커뮤니티 보기" 버튼이 있다.
    - 카드를 닫아도(X) 마커는 남아있고 다시 클릭하면 카드가 다시 열린다.
      다음 검색으로 다른 장소를 고르면 마커 위치만 옮겨진다(완전히
      지우는 액션은 없음, 요청받지 않음).
16. 지도 전용 1시간 노출 컷오프 + 드래그형 MapSheet + 모바일 UI 다듬기 —
    완료 여부는 src/usePosts.js의 filterMapVisiblePosts,
    src/components/MapSheet.jsx 존재로 확인.
    - usePosts.js의 nearbyPosts(지도 마커용)에만 filterMapVisiblePosts로
      "작성 후 60분 컷오프"를 추가로 적용한다. 자유주제(원래 유효시간
      없음, categories.js CATEGORY_VALID_MINUTES 없음)도 이 컷오프 대상
      — 지도에서는 1시간 뒤 사라진다. 단, communityPosts/activePosts
      (커뮤니티 탭·메뉴 탭 피드)는 이 필터의 영향을 받지 않는다 — 자유
      주제 글은 피드에서는 여전히 무기한 남는다(4번 단계의 카테고리별
      유효시간/만료 설계는 그대로 유지, 이건 "지도 마커 노출"만 별도로
      제한하는 것뿐). 카테고리 자체의 만료(getElapsedRatio)는 손대지
      않았다 — 중복 로직 만들지 말 것.
    - MapSheet.jsx: 지도 탭 위에 겹치는 드래그형 시트(주변 글 목록,
      CommunityFeed 재사용). 평소엔 화면 중간(45%)까지만 열려 지도와
      목록을 함께 보고, 핸들을 끝까지 위로 끌면 92%(거의 전체 목록),
      끝까지 아래로 끌면 64px 핸들만 남기고 접혀 지도만 보인다. 핸들을
      드래그 없이 살짝 탭하면 접힘⇄중간을 토글한다. 이건 14번에서
      "다시 만들지 말 것"이라 적어뒀던 BottomSheet.jsx를 되살린 게
      아니라 별도 이름의 새 컴포넌트다 — TabBar 탭 전환 구조는 그대로
      유지되고, MapSheet는 지도 탭 안에서만 쓰인다.
    - 모바일에서 하단이 잘리는 문제: .app의 height를 100vh 다음에
      100dvh로 한 번 더 선언해 모바일 브라우저 주소창 접힘/펼침에 따라
      실제 보이는 높이로 갱신되게 했다. TabBar/바텀시트류(post-detail,
      post-modal, pin-menu, place-preview, place-card, map-sheet)에는
      env(safe-area-inset-bottom)을, 지도 위 상단 요소(category-filter,
      place-search)에는 env(safe-area-inset-top)을 더해 노치/홈 인디케이터
      기기에서 잘리지 않게 했다. index.html의 viewport-fit=cover가 이미
      있어야 safe-area-inset이 동작한다(이미 있음, 다시 추가하지 말 것).
    - 전체 UI를 더 둥글고 부드럽게: border-radius를 전반적으로 한 단계씩
      키웠고(8→12/10→14/12→16/16→20/18→22px, pill/원형은 그대로), 모든
      button/a에 공용 transition + :active 시 scale(0.96) 눌림 효과를
      추가했다. 바텀시트류 5종(post-detail/post-modal/pin-menu/
      place-preview/place-card)에는 뜰 때 배경 페이드인 + 살짝 아래에서
      위로 슬라이드업(sheet-backdrop-in/sheet-slide-up 키프레임)을
      추가했다. 네온/그라데이션은 쓰지 않았다(디자인 원칙 유지).
17. 글쓰기 모달을 App.jsx로 이전 + 위치·건물별 커뮤니티에 글쓰기 추가 —
    완료 여부는 src/App.jsx에 openCreateModal/handleSubmitPost가 있고
    src/MapView.jsx에는 없는지로 확인.
    - PostModal 열기/제출(이미지 업로드, local/external 판정, createPost/
      updatePost RPC, owner_secret 저장, abuseCheck 5분/50m 중복→수정
      전환)은 원래 MapView.jsx 안에서만 동작했다. 이제 App.jsx가 소유하고
      `onOpenCreateModal(lat, lng, { presetCategory, onConvertPin })`
      prop으로 MapView/MenuPage 양쪽에 내려준다 — 글쓰기 진입점이 늘어날
      때마다 업로드/등록 로직을 복붙하지 않기 위함(15번의 PlaceCard
      "이 장소 커뮤니티 보기"에 이어 이번엔 MenuPage의 위치·건물별
      커뮤니티에서도 글을 쓸 수 있어야 했음).
    - 핀(pins 테이블)은 여전히 MapView.jsx 전용 개념이라, 핀에서 시작한
      글쓰기(PinMenu의 글쓰기/질문 등록)는 `onConvertPin` 콜백으로
      MapView의 `convertPinToPost`를 넘겨서 작성 성공 시 그 빈 핀을
      지우게 했다. **PinMenu에서 onOpenCreateModal을 부를 때 MapView가
      직접 setSelectedPinId(null)도 같이 호출해야 한다** — 예전엔
      openCreateModal 안에서 처리했지만 지금은 App 쪽 함수라 MapView의
      로컬 selectedPinId에 손댈 수 없다. 이거 빠뜨리면 PinMenu 백드롭이
      안 닫혀서 모달 위에 그대로 남는 버그가 남(실제로 한 번 겪음).
    - MenuPage.jsx "위치·건물별 커뮤니티"에서 장소를 고르면
      selectedPlace 옆에 "✏️ 글쓰기" 버튼이 뜨고, 누르면
      onOpenCreateModal(selectedPlace.lat, selectedPlace.lng)을 그대로
      호출한다. MapView.jsx의 place-community-overlay(15번, PlaceCard
      "이 장소 커뮤니티 보기"로 들어가는 화면)에도 동일한 패턴의
      글쓰기 버튼이 있다. local/external 판정은 항상 실제 내 GPS 위치
      (userLocation) 기준이라 — 검색한 장소가 멀면 "외부작성"으로
      등록된다(어디든 쓰는 것 자체는 막지 않음, 13번부터 이어지는 규칙).
    - EXTERNAL_DISTANCE_METERS 상수는 usePosts.js로 옮겨서 App.jsx(글쓰기
      판정)와 MapView.jsx(500m 원 표시)가 공유한다 — 두 곳에 따로
      정의하지 말 것.
    - 커뮤니티 탭(하단 TabBar의 "커뮤니티", 내 위치 500m)에는 아직
      글쓰기 버튼이 없다 — 요청받은 범위가 아니었음(위치·건물별
      커뮤니티, 장소 커뮤니티 두 곳만 해당). 필요해지면 그때 추가.
18. 커뮤니티 탭 = 건물 목록 → 선택해야 글 목록 — 완료 여부는
    src/components/BuildingList.jsx 존재, src/usePosts.js의
    groupPostsByBuilding 존재로 확인.
    - 이전엔 커뮤니티 탭(내 위치 500m)이 CommunityFeed(글 목록)를 바로
      보여줬다. 이제 CommunityPage.jsx가 그 500m 글들을 좌표 30m 이내로
      묶어(groupPostsByBuilding, 그리디 클러스터링) "건물" 목록을 먼저
      보여주고, 건물 카드를 눌러야 그 건물 글들만 모은 CommunityFeed가
      뜬다(‹ 건물 목록 버튼으로 돌아감). 500m 반경 필터 자체는 그대로다
      (usePosts.js의 COMMUNITY_RADIUS_METERS, App.jsx가 이미 필터링해서
      CommunityPage에 내려줌 — 여기서 다시 거리 필터링 안 함).
    - 건물 이름은 카카오 Geocoder.coord2Address로 역지오코딩한다
      (PlacePreview.jsx와 같은 패턴, 새로 만들지 말 것). 카카오 키 없는
      placeholder 모드에서는 이름을 못 가져오니 "장소 1", "장소 2"처럼
      순번으로만 구분한다.
    - BuildingList.jsx의 onSelect는 `(building, info)` 두 값을 넘긴다
      — building은 {id, lat, lng, posts}, info는 그 카드가 이미 조회해둔
      {name, address}(아직 못 받았으면 undefined). 선택한 쪽에서 또
      지오코딩하지 않고 이 info를 그대로 쓰기 위함 — CommunityPage.jsx는
      building 객체를 그대로 state로 들고(추가 조회 없이 posts 바로
      사용), MenuPage.jsx(아래 19번)는 info의 name/address만 꺼내 쓴다.
19. 메뉴 탭 위치·건물별 커뮤니티에도 "건물 먼저" 적용 — 완료 여부는
    src/components/MenuPage.jsx가 BuildingList를 쓰는지로 확인.
    - 18번 커뮤니티 탭에서 만든 "건물 먼저 → 선택해야 글/글쓰기" 패턴을
      메뉴 탭의 위치·건물별 커뮤니티에도 적용했다. 이제 그 화면에 들어가면
      (검색 없이도) 이미 글이 있는 건물 목록이 거리 제한 없이 먼저 뜨고,
      그 아래에 "다른 장소 찾기" 검색이 있다(기존 키워드 검색 기능은
      그대로 유지 — 아직 글이 없는 새 장소를 찾아 처음 글을 쓸 때 씀).
      건물 목록도, 검색 결과 선택도 결국 같은 selectedPlace 상태로
      합쳐져서 이후 로직(500m 반경 CommunityFeed + 글쓰기 버튼)은 완전히
      공유한다 — 두 진입 경로를 위해 로직을 두 벌 만들지 않았다.
    - 건물 목록에서 고른 경우와 검색에서 고른 경우 모두, 글쓰기 버튼은
      selectedPlace가 있을 때만 보인다 — "들어가야(선택해야) 작성창을
      열 수 있다"는 요구사항이 이미 이 gate로 충족된다(추가 잠금 로직
      필요 없었음).
    - 건물 목록 클릭 시 보여주는 글 목록은 그 건물의 클러스터(30m) 글만이
      아니라, 기존과 동일하게 그 좌표 기준 500m 반경 전체다
      (filterPostsWithinRadius + COMMUNITY_RADIUS_METERS, 검색으로 고른
      장소와 동일한 규칙). 건물 목록은 "어디를 고를지" 보여주는
      용도고, 고른 뒤 범위는 앱 전체에서 쓰는 500m 규칙을 그대로 따른다
      — 일부러 다른 반경을 새로 만들지 않았다.
20. 빈 핀 1시간 자동 삭제 — 완료 여부는 Supabase의 delete_expired_pins
    함수 존재, src/supabaseClient.js의 deleteExpiredPins 존재로 확인.
    - 핀 삭제 버튼(12번, PinMenu의 "핀 삭제")은 이미 있었다 — 이번에 추가된
      건 "작성자가 직접 안 지워도 시간이 지나면 저절로 지워지는" 자동
      삭제다. 16번에서 만든 게시글의 지도 전용 1시간 컷오프
      (MAP_VISIBLE_MINUTES, usePosts.js)를 핀에도 그대로 재사용한다 —
      숫자를 두 곳에 따로 두지 않으려고 usePosts.js에서 export했다.
    - 게시글은 1시간 지나도 지도에서만 안 보이고 커뮤니티/메뉴 탭 피드에는
      계속 남는다(16번에서 이미 그렇게 만듦, 이번에 변경 없음 — 자유주제
      글이 커뮤니티에서도 사라지는 걸로 착각하지 말 것). 반면 빈 핀은
      "커뮤니티"라는 개념 자체가 없는 지도 전용 존재라, 1시간 지나면
      MapView.jsx의 nearbyPins가 클라이언트에서 즉시 안 보이게 숨기는
      것에 더해(filterMapVisiblePosts 재사용) 실제로 서버 pins 테이블에서도
      지운다 — 두 겹으로 처리한 이유는 클라이언트 숨김은 즉각적이지만
      실제 삭제(아래)까지는 최대 30초(주기적 정리 호출 간격) 걸릴 수
      있어서다.
    - 서버 삭제는 `delete_expired_pins` RPC(SECURITY DEFINER, 소유자
      확인 없이 나이만 봄)를 호출해서 한다. `delete_own_pin`과 달리
      owner_secret이 필요 없다 — 이미 만료된 행만 지우는 멱등 연산이라
      아무 클라이언트가 호출해도 안전하기 때문. MapView.jsx가 마운트 시
      한 번 + 기존 30초 tick(now 갱신과 같은 인터벌)마다 한 번씩 호출한다.
      실제로 삭제되면 pins-realtime DELETE 이벤트로 다른 사용자 화면에서도
      바로 사라진다(기존 subscribeToPinChanges 그대로 재사용, 새 구독
      안 만듦).
    - **pins 테이블에 직접 삽입/삭제하는 코드를 새로 만들지 말 것**이라는
      12번의 규칙은 여전히 유효하다 — 이 자동 삭제도 반드시
      delete_expired_pins RPC를 통해서만 한다, 클라이언트에서 직접
      `DELETE FROM pins`를 하지 않는다.

새 요청을 받으면 위 단계 중 어디까지 되어 있는지 코드를 먼저 확인하고,
이미 된 부분은 건드리지 않고 다음 단계부터 이어서 작업한다.

## 하지 말 것
- .env 파일 내용을 출력하거나 커밋에 포함시키는 것
- 카카오맵/Supabase 키를 코드에 직접 문자열로 삽입하는 것
- 기존 파일 구조를 임의로 재구성하는 것 (제안은 가능, 실행은 확인 후)
- 새 라이브러리 추가 전 기존 스택으로 해결 가능한지 먼저 검토하는 것 생략
