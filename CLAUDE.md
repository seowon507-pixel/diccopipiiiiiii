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
- PWA: 적용됨 (vite-plugin-pwa, injectManifest 전략) — 26번 참고. 8번에서 한 번 뺐다가
  다시 붙인 것이니 "왜 또 있지" 하지 말 것

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
  favoriteLocations.js   "우리 아파트만" 같은 즐겨찾기 위치를 localStorage에 보관 — 23번 참고
  notifications.js       웹 푸시 구독/관심지역·키워드·조용한시간 + 이 브라우저의 device_secret
                         (24번부터 익명 소유권 복구 코드로도 재사용) — 문서에는 없었지만 이미 있던 파일
  sw.js                  서비스워커 원본 — 웹 푸시(push/notificationclick) + 오프라인 앱 셸
                         프리캐시(vite-plugin-pwa injectManifest). public/이 아니라 여기 있는
                         이유는 빌드 시 프리캐시 목록을 주입받아야 해서다 — 26번 참고
  components/
    TabBar.jsx             하단 탭바 (지도/커뮤니티/채팅 전환)
    CommunityPage.jsx      지도와 분리된 전체화면 커뮤니티 탭 — 건물 목록(BuildingList)을
                           먼저 보여주고, 건물을 선택해야 그 건물의 CommunityFeed가 뜬다
    BuildingList.jsx       좌표 클러스터(건물) 목록. 카카오맵 있으면 역지오코딩으로 건물명
                           표시, 없으면(placeholder) 순번만 — 18번 참고
    ChatRoom.jsx           내 위치 기준 반경(500m/1km/2km 조절 가능, 기본 1km) 동네 전체
                           공용 실시간 채팅방 — 25번 참고
    PostModal.jsx        게시글 작성/수정 모달 (제목+카테고리+내용+사진+아이콘)
    CategoryFilter.jsx    지도 위 카테고리 필터 칩
    PostDetail.jsx        마커/카드 클릭 시 상세 + 댓글(목록만, 렌더링은 Comment.jsx에 위임) +
                           확인/추천/삭제 버튼
    Comment.jsx            댓글 하나 + 답글(한 단계) + 이모지 반응 — 25번 참고
    CommunityFeed.jsx     검색/카테고리 필터/정렬(거리·인기·최신)/즐겨찾기 위치 필터 +
                           게시글 목록 (CommunityPage 등 여러 화면이 공유) — 23번 참고
    PostCard.jsx          피드의 게시글 카드 1개
    ReportButton.jsx       게시글/댓글 공용 신고 버튼 — 21번 참고
    QuickPostSheet.jsx     FAB → 카테고리 그리드 즉시 등록 시트 — 22번 참고
    Toast.jsx              짧게 떴다 사라지는 알림(현재는 빠른 등록 완료 알림 전용) — 22번 참고
    PlaceSearch.jsx        카카오맵 전용 장소/건물 검색 (kakao.maps.services)
    PinMenu.jsx            빈 핀 클릭 시 글쓰기/질문 등록/핀 삭제 메뉴
    PlacePreview.jsx       지도 클릭 시(핀 생성 전) 건물/장소 정보 + 핀 만들기/커뮤니티 보기
    PlaceCard.jsx          장소검색 결과 마커 클릭 시 뜨는 카드 — 이름/카테고리/주소/전화,
                           그 위치 반경 500m 글 중 사진, 카카오맵 상세보기 링크, 장소 커뮤니티 진입
    MenuPage.jsx           메뉴 탭 — 거리 제한 없는 전체 커뮤니티, 검색한 임의 장소 반경
                           커뮤니티(filterPostsWithinRadius/COMMUNITY_RADIUS_METERS 재사용)
    MapSheet.jsx           지도 탭 위에 겹치는 드래그형 시트(주변 글 목록). 평소 화면 중간,
                           위로 끝까지/아래로 끝까지(지도만 보이게) 드래그 가능 — 17번 참고
    RealtimeIssueCarousel.jsx  MapSheet 기본 화면의 실시간 이슈 가로 캐러셀(자유주제 글 안 섞임)
                           — 문서에는 없었지만 이미 있던 파일
    NotificationSettings.jsx  메뉴 탭 "알림 설정" — 관심 지역/키워드/조용한 시간(notifications.js)
                           — 문서에는 없었지만 이미 있던 파일
    RecoveryCode.jsx       메뉴 탭 "복구 코드" — 익명 소유권 복구(발급/다른 기기에서 입력) — 24번 참고
    WeeklyDigest.jsx       홈(지도 탭) 상단 "이번 주 우리 동네 소식" 자동 큐레이션 카드 — 27번 참고
dummy-data.json          Supabase 연결 실패 시 fallback 데이터
public/icons/            매니페스트·apple-touch-icon·favicon용 실제 PNG 바이너리 — 26번 참고
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
| report_count | int | default 0. 21번 참고 — report_post RPC가 누적 신고 수로 갱신 |
| hidden | boolean | default false. report_count가 5 이상이면 report_post RPC가 자동으로 true — 21번 참고 |
| last_confirmed_at | timestamptz | nullable. 마지막 "아직 그런가요?" 확인 시각 — 21번 참고(만료 계산 보정) |
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
| report_count | int | default 0. 21번 참고 |
| hidden | boolean | default false. 5회 이상 신고되면 report_comment RPC가 자동으로 true — 21번 참고 |
| parent_comment_id | uuid | nullable. comments(id) FK, on delete cascade. 있으면 그 댓글의 답글(한 단계만, 답글의
답글은 없음) — 25번 참고 |
| reactions | jsonb | default '{}'. {emoji: count} 집계 캐시. react_to_comment RPC가 갱신 — 25번 참고 |

### comment_reactions 테이블 (댓글 이모지 반응 집계 전용, post_reports와 동일한 패턴)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | pk |
| comment_id | uuid | comments(id) FK, on delete cascade |
| emoji | text | COMMENT_REACTION_EMOJIS(categories.js) 중 하나 |
| reactor_secret | text | notifications.js getOrCreateDeviceSecret 재사용(이 브라우저의 익명 정체성) |
| created_at | timestamptz | default now() |

unique(comment_id, emoji, reactor_secret)이 있어 같은 브라우저가 같은 댓글에 같은 이모지를
다시 누르면 행이 지워진다(토글). RLS는 켜져 있지만 정책이 없어 anon/authenticated는 절대
직접 접근 못 한다 — `react_to_comment` SECURITY DEFINER 함수로만 조작되고, 이 함수가
comments.reactions를 갱신한다(카운트가 0이 되면 그 이모지 키 자체를 지운다). **comment_reactions에
직접 삽입하는 코드를 새로 만들지 말고 반드시 이 RPC를 통해서만 반응을 남길 것.** 25번 참고.

### post_owners 테이블 (삭제 권한 확인 전용, 절대 직접 select/insert 만들지 말 것)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| post_id | uuid | pk, posts(id) FK, on delete cascade |
| owner_secret | text | 게시글 작성 시 클라이언트가 생성해 localStorage(myPosts.js)와 여기 동시에 저장 |
| device_secret | text | nullable. 24번 참고 — 이 값으로 restore_ownership을 호출하면 owner_secret을 복구할 수 있다 |

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
| device_secret | text | nullable. post_owners와 같은 용도 — 24번 참고 |

RLS는 켜져 있지만 정책이 없어 anon/authenticated는 절대 직접 접근 못 한다.

### post_reports / comment_reports 테이블 (신고 집계 전용, post_owners와 동일한 패턴)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | pk |
| post_id / comment_id | uuid | posts(id)/comments(id) FK, on delete cascade |
| reporter_secret | text | 이 브라우저 식별용(myPosts.js getReporterSecret, 신고 전용 — owner_secret과 다른 값) |
| created_at | timestamptz | default now() |

각각 unique(post_id/comment_id, reporter_secret) 제약이 있어 같은 브라우저가 같은 대상을
여러 번 신고해도 1회만 집계된다. RLS는 켜져 있지만 정책이 없어 anon/authenticated는
절대 직접 select/insert 못 한다 — `report_post`/`report_comment` SECURITY DEFINER
함수로만 기록되고, 이 함수들이 누적 신고 수를 세어 posts.report_count/comments.report_count에
반영하며 5회 이상이면 hidden도 자동으로 true로 바꾼다. **post_reports/comment_reports에
직접 삽입하는 코드를 새로 만들지 말고 반드시 이 두 RPC를 통해서만 신고할 것.** 21번 참고.

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
반경으로 필터링한다(ChatRoom.jsx, 기본 1km, 사용자가 500m/1km/2km 중 고를 수 있음 — 25번
참고). 서버 조회(getChatMessages)는 반경과 무관하게 최근 200개를 그대로 가져오고, 반경
선택은 클라이언트에서만 걸러서 반경을 바꿔도 재요청이 없다.

### push_subscriptions 테이블 (웹 푸시 구독 — 관심 지역/키워드/조용한 시간, 회원가입 없음)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | pk, default gen_random_uuid() |
| device_secret | text | unique. notifications.js getOrCreateDeviceSecret가 localStorage에 보관 — 24번 단계부터
는 post_owners/pin_owners에도 같은 값이 기록되는 "이 브라우저의 유일한 익명 정체성"이다 |
| endpoint | text | unique. 브라우저 푸시 구독 엔드포인트 |
| p256dh, auth | text | 푸시 암호화 키(Web Push 표준) |
| interest_areas | jsonb | default '[]'. [{lat, lng, radius_m}], 최대 MAX_INTEREST_AREAS(2)개 |
| keywords | jsonb | default '[]'. 관심 키워드 문자열 배열 |
| quiet_start, quiet_end | int2 | nullable. 조용한 시간(시 단위), 둘 다 없으면 항상 알림 |
| created_at, updated_at | timestamptz | default now() |

RLS 활성화 + 정책 없음(anon/authenticated 직접 접근 불가) — `upsert_push_subscription`/
`delete_push_subscription` SECURITY DEFINER 함수로만 조작된다(post_owners와 동일한 패턴).
새 글이 등록되면(notify_new_post 트리거) 조건에 맞는 구독에 푸시를 보낸다.

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
   vite-plugin-pwa/manifest/아이콘 세트를 통째로 뺐다. **26번 단계에서
   다시 붙였다** — git 저장소로 정상 배포 중인 걸 확인하고, 아이콘도
   실제 PNG 바이너리로 커밋한 뒤 vite-plugin-pwa를 재설치했다(이 8번에
   적어둔 대로 그대로 진행함). vite.config.js에 VitePWA 플러그인이
   있으면 적용된 상태다.
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
21. 익명 글 시스템 신뢰 장치(신고/자동숨김/사건사고 강조/만료 로직 점검) — 완료
    여부는 src/components/ReportButton.jsx, posts/comments의 report_count·hidden
    컬럼, post_reports/comment_reports 테이블 존재로 확인.
    - 모든 게시글(PostCard, PostDetail)과 모든 댓글(PostDetail)에 🚩 신고
      버튼이 붙는다. 신고는 로그인 없이 report_post/report_comment RPC로
      기록되고(위 데이터 모델 섹션 참고), 같은 브라우저가 같은 대상을 여러
      번 눌러도 서버에서 1회만 집계된다(reporter_secret unique 제약). 신고
      버튼 자체는 myPosts.js의 isReported/markReported로 새로고침해도
      "신고됨" 상태가 유지되지만, 이건 순전히 UI 표시용이고 실제 중복
      방지는 서버 쪽 unique 제약이 한다 — 로컬 저장소를 지우면 다시
      신고할 수 있는 정도의 느슨한 보호다(로그인 없는 앱의 한계, 의도된
      트레이드오프).
    - 신고 누적 5회부터는 report_post/report_comment RPC가 관리자 개입 없이
      posts.hidden/comments.hidden을 자동으로 true로 바꾼다. hidden=true인
      글/댓글은 supabaseClient.js의 getPosts/getComments가 애초에 조회
      대상에서 제외하고(`.eq('hidden', false)`), 이미 화면에 떠 있던
      경우엔 realtime UPDATE로 hidden:true가 들어오는 순간 usePosts.js/
      PostDetail.jsx가 병합 대신 목록에서 바로 제거한다 — 두 경로 모두
      막아야 "숨겨졌는데도 이미 불러온 화면엔 남아있는" 틈이 없다. 숨겨진
      글을 되살리는 기능은 없다(20번 이전부터 이어온 패턴과 동일하게, 필요하면
      관리자가 Supabase MCP execute_sql로 hidden을 직접 되돌려야 한다).
      **post_reports/comment_reports에 직접 쓰는 코드나 hidden을 RPC 없이
      직접 UPDATE하는 코드를 새로 만들지 말 것.**
    - 사건사고 카테고리는 PostDetail.jsx와 PostCard.jsx에서 다른 실시간
      카테고리(웨이팅/혼잡/교통)보다 확인 UI를 시각적으로 강조한다 —
      index.css의 기존 --color-warning-tint/--color-warning-text 토큰을
      그대로 재사용한 배너/배지로 "🚨 확인 n명"을 먼저 보여준 뒤 확인
      버튼을 둔다(디자인 원칙상 새 컬러를 추가하지 않았다). 다른 실시간
      카테고리는 기존의 평범한 "아직 그런가요? (n)" 버튼 그대로 유지.
    - 만료 로직 점검(4단계 getElapsedRatio) 중 실제 문제를 하나 찾아
      고쳤다: 실시간 카테고리 글은 created_at 하나만 기준으로 경과율을
      계산해서, 사람들이 계속 "아직 그런가요?"를 눌러 확인해줘도 정확히
      원래 유효시간(예: 웨이팅 30분)이 지나면 그대로 만료되어 버렸다.
      posts.last_confirmed_at 컬럼을 추가해 incrementConfirmCount가 매번
      갱신하게 하고, categories.js의 getElapsedRatio는 이제
      max(updated_at ?? created_at, last_confirmed_at)을 경과 기준
      시작점으로 삼는다 — 수정 또는 확인 중 더 최근 시각부터 다시
      카운트한다. updated_at 자체는 건드리지 않아서 "(수정됨)" 배지
      표시(edit 여부 판정)에는 영향 없다.
22. FAB 빠른 등록(카테고리 1개 = 현재 위치에 즉시 등록) — 완료 여부는
    src/components/QuickPostSheet.jsx, src/components/Toast.jsx 존재,
    App.jsx의 handleQuickPost 존재로 확인.
    - 어느 탭에서나 항상 떠 있는 + 모양 FAB(App.jsx, .app-content 우하단,
      TabBar와 겹치지 않음)을 누르면 QuickPostSheet의 카테고리 그리드
      (아이콘+라벨, 2~4열 반응형, 칸당 48px 이상 터치 영역)가 뜬다.
      카테고리 하나를 고르면 그 자리에서 바로 createPost가 호출된다 —
      제목/사진 없이 "현재 위치(userLocation) + 카테고리"만으로 끝난다.
      본문은 categories.js의 QUICK_POST_MESSAGES에서 카테고리별 기본
      문장을 채운다(content가 NOT NULL이라 반드시 값이 필요함). 항상
      내 위치에서 바로 쓰는 글이라 post_type은 늘 'local'이고, 17번
      단계의 openCreateModal(위치를 먼저 고르고 제목/내용/사진까지
      채우는 전체 작성 모달)과는 별개의 새 경로다 — 기존 흐름은 전혀
      안 건드렸다.
    - 시트 하단의 "자세히 쓰기"는 카테고리를 아직 안 고른 상태에서
      누르는 작은 링크로, 시트를 닫고 openCreateModal(현재 위치)을
      그대로 열어 기존 PostModal 전체 작성 흐름(제목/카테고리/내용/
      사진/아이콘)으로 넘어간다 — 빠른 등록과 로직을 두 벌로 만들지
      않고 기존 모달을 그대로 재사용.
    - 빠른 등록도 성공 시 saveLastPost(abuseCheck.js)를 그대로 호출한다
      — 그래서 등록 직후 5분/50m 이내에 "자세히 쓰기"나 다른 글쓰기
      진입점으로 같은 자리에 다시 들어오면 findNearbyDuplicate가 이
      글을 찾아 새 글 대신 수정 모드로 열어준다(12번부터 이어지는 중복
      방지 로직을 그대로 재사용, 새 로직 안 만듦).
    - 등록 완료 시 Toast.jsx(새로 만든 범용 알림 컴포넌트, 지금은 이
      용도로만 쓰임)로 "등록됐어요!"를 짧게 띄우고, activeTab을
      'map'으로 바꾼 뒤 MapView에 새로 추가한 recenterTarget prop으로
      그 글 좌표를 넘겨 카카오맵 setCenter를 호출한다(placeholder
      모드는 애초에 항상 userLocation 중심이라 별도 처리 없음). 다른
      탭에서 FAB을 눌러도 등록 후 자동으로 지도 탭으로 전환된다.
    - MapView.jsx에 지도를 임의 좌표로 재중심시키는 범용 로직이 이전엔
      없었다(PlaceSearch.jsx의 검색 결과 선택 시 setCenter만 예외적으로
      존재) — 이번에 추가한 recenterTarget useEffect가 그 다음 두 번째
      사례다. 좌표가 같아도 재중심이 다시 일어나야 해서 App.jsx는
      매번 새 객체({lat, lng})를 만들어 넘긴다(참조가 달라야
      useEffect가 다시 실행됨, 기존 viewportTick/mapRetryToken과 같은
      "매번 새 값을 넘겨 재실행을 강제하는" 패턴).
23. 커뮤니티 목록 정렬/검색/즐겨찾기 위치 + 카드 스캔형 레이아웃 — 완료 여부는
    src/favoriteLocations.js, src/categories.js의 getReactionCount/getFadeOpacity,
    src/components/PostCard.jsx의 post-card-icon 존재로 확인.
    - CommunityFeed.jsx 상단 칩이 세 줄로 늘었다: 카테고리 필터(기존) →
      정렬(방금 올라온 순/인기순/거리순, 거리순은 userLocation이 있을 때만
      노출) → 즐겨찾기 위치(전체/저장된 위치들/+ 즐겨찾기). 세 줄 모두
      기존 community-filter-row/community-sort-row 패턴 그대로 가로
      스크롤(overflow-x, 스크롤바 숨김)이다. 인기순은 카테고리마다
      다른 confirm_count/likes_count를 categories.js의 getReactionCount
      (둘을 그냥 더함 — 한 글에 둘 중 하나만 실제로 쌓이므로 안전)로
      통일해 정렬한다.
    - 즐겨찾기 위치("우리 아파트만" 같은 예)는 로그인 없이 이 브라우저에만
      저장된다(favoriteLocations.js, myPosts.js의 owner_secret과 같은
      localStorage 패턴, id 생성도 generateOwnerSecret 재사용). "+
      즐겨찾기"를 누르면 이름만 입력받아 **그 순간의 userLocation**을
      좌표로 저장한다(임의 장소 저장 기능은 아직 없음, 필요해지면 그때
      추가). 즐겨찾기 칩을 고르면 posts(이미 500m 반경 등으로 좁혀진
      경우가 많음) 대신 fallbackPosts(App의 activePosts, 위치 무관 전체
      활성 글)를 그 좌표 기준으로 filterPostsWithinRadius +
      COMMUNITY_RADIUS_METERS로 다시 필터링한다 — 그래야 내가 지금 있는
      곳과 다른 동네에 저장한 즐겨찾기도 그 자리로 "점프"해서 볼 수 있다.
      기존 posts 반경 필터를 건드리지 않고 fallbackPosts라는 이미 있던
      prop을 재사용했다(모든 CommunityFeed 호출부가 이미 넘기고 있었음).
    - PostCard.jsx를 [카테고리 아이콘] 제목 / 거리·시간 / 반응수 3줄
      스캔형으로 다시 짰다. 제목이 없으면(FAB 빠른 등록 글 등) content를
      그대로 제목 자리에 쓴다 — 예전처럼 제목+본문 미리보기 두 줄을 같이
      보여주지 않는다(요청대로 "스캔 가능하게" 정리, 사진만 오른쪽에
      작은 썸네일로 남겨둠). 실시간 이슈(웨이팅/혼잡/사건사고/교통)만
      카드 왼쪽에 카테고리 색 세로 바(post-card--realtime)가 붙어
      한눈에 구분된다. 유효시간의 70% 이상 지난 글은 옅게 표시되는데,
      이건 원래 MapView 마커 전용이던 NEAR_EXPIRY_RATIO/OPACITY 로직을
      categories.js의 getFadeOpacity로 옮겨 지도와 피드 카드가 공유하게
      만든 것이다(MapView.jsx의 getMarkerOpacity는 삭제, 중복 정의
      금지 원칙에 따름).
    - PostCard가 거리(distance)·시각(now)을 직접 계산하지 않고 항상
      props로 받는다 — CommunityFeed가 매 글마다 userLocation 기준
      getDistanceMeters(geo.js)로 계산해서 넘기고, MapView.jsx의 지도
      클러스터 팝오버도 같은 방식으로 직접 계산해 넘긴다. now는
      App.jsx가 usePosts()에서 꺼내 CommunityPage/MenuPage까지 내려주고
      (기존엔 App이 이 값을 안 쓰고 있었음), MapView.jsx는 이미 갖고
      있던 자체 now(빈 핀 정리용 타이머)를 그대로 재사용한다 — 세 번째
      타이머를 새로 만들지 않았다.
    - geo.js에 formatDistanceMeters(m 단위는 반올림, 1km 이상은
      소수점 1자리 km)를 추가했다 — 거리 계산(getDistanceMeters)과
      한 파일에 모아 흩어지지 않게 했다.
24. 회원가입 없는 익명 소유권 복구(복구 코드) — 완료 여부는
    src/components/RecoveryCode.jsx, posts/pins의 device_secret 컬럼,
    restore_ownership RPC 존재로 확인.
    - 문제: myPosts.js가 post_owners/pin_owners와 매칭되는 owner_secret을
      오직 이 브라우저의 localStorage에만 들고 있어서, 폰을 바꾸거나
      브라우저 저장소를 지우면 그동안 쓴 글/핀을 다시는 수정/삭제할 수
      없었다(서버엔 owner_secret이 남아있지만 그걸 아는 쪽이 사라짐).
    - 검토한 대안과 선택 이유: (a) 이메일/비밀번호 회원가입 — 요청받은
      "회원가입 없이"에 정면으로 위배되어 제외. (b) 매 글/핀마다 새
      복구 코드를 발급 — 코드가 계속 늘어나 관리가 안 됨. (c) **이
      브라우저 전체에 코드 하나(=계정 없는 익명 정체성)를 두고, 그
      코드로 만든 모든 글/핀을 한 번에 복구** — 선택. 새 계정/새 코드
      체계를 만드는 대신, notifications.js가 이미 갖고 있던
      getOrCreateDeviceSecret()(웹 푸시 구독 식별용으로 14번 이후 단계에서
      추가된 이 브라우저의 유일한 익명 식별자, push_subscriptions.device_secret)를
      그대로 복구 코드로 재사용했다 — 별도의 코드 생성/표시 규칙을
      새로 만들지 않기 위해서다.
    - 게시글/핀을 만들 때(App.jsx의 handleSubmitPost/handleQuickPost,
      MapView.jsx의 createPinAt) owner_secret과 함께 이 device_secret도
      서버에 넘긴다 — create_post_with_owner/create_pin_with_owner RPC에
      p_device_secret 파라미터를 추가하고, post_owners/pin_owners
      테이블에 device_secret 컬럼을 추가해 받아 저장한다(nullable —
      이 단계 이전에 만들어진 글/핀은 값이 없어 복구 대상이 아니다,
      의도된 한계). **CREATE OR REPLACE로 파라미터를 늘리면 옛 시그니처
      함수가 지워지지 않고 오버로드로 남는다는 걸 이번에 실제로
      겪었다** — 반드시 옛 시그니처를 `drop function`으로 명시적으로
      지워야 한다(마이그레이션 작성 시 주의).
    - `restore_ownership(p_device_secret)` SECURITY DEFINER RPC가
      그 device_secret으로 만든 모든 글/핀의 {target_type, target_id,
      owner_secret}을 돌려준다(post_owners/pin_owners는 정책이 없어
      anon이 직접 못 읽으므로 이 RPC로만 조회 가능, post_owners/
      pin_owners와 동일한 잠금 패턴). **이 두 테이블에 직접
      select/insert하는 코드를 새로 만들지 말 것.**
    - 메뉴 탭에 "복구 코드" 카드를 추가했다(RecoveryCode.jsx). 내
      device_secret을 그대로 보여주고(복사 버튼), 다른 기기의 코드를
      입력하면 restoreOwnership으로 받아온 각 owner_secret을
      myPosts.js의 saveOwnership/savePinOwnership으로 로컬에 반영한
      뒤, notifications.js의 adoptDeviceSecret으로 **이 기기가 그
      코드의 정체성을 이어받게** 한다 — 그래야 복구 이후 이 기기에서
      쓰는 글/핀도 계속 같은 코드로 묶인다.
    - 한계(의도적으로 처리 안 함): 복구 코드를 입력하기 *전에* 이
      기기에서 이미 만든 글/핀은 그 시점의(다른) device_secret에
      묶여 있어 코드를 바꿔 받아도 그 글들의 향후-복구성은 유지되지
      않는다 — 다만 그 글들의 owner_secret 자체는 로컬에 그대로 남아
      있어 삭제 등 기존 기능엔 지장이 없다. 두 device_secret을
      병합하는 기능은 요청 범위 밖이라 만들지 않았다. 또한 마이그레이션
      이전에 만들어진 글/핀(device_secret이 null)은 이 기능으로 복구할
      수 없다 — 그 글을 만든 바로 그 브라우저에서만 여전히 관리 가능하다.
25. 동네 채팅 반경 조절 + 댓글 이모지 반응/답글 — 완료 여부는
    src/components/Comment.jsx, comments의 parent_comment_id·reactions
    컬럼, comment_reactions 테이블 존재로 확인.
    - ChatRoom.jsx: 기존엔 NEARBY_RADIUS_METERS=1000 고정이었다. 이제
      500m/1km/2km 칩으로 고를 수 있다(기본 1km, 저장은 안 함 — 탭을
      다시 열면 1km로 리셋된다, 요청받은 범위가 "조절 옵션 추가"였지
      "기억하기"는 아니었음). getChatMessages는 여전히 반경과 무관하게
      최근 200개를 통째로 받아 rawMessages에 두고, 화면에 보일
      messages는 useMemo로 그때그때 radiusMeters만큼만 걸러낸다 — 이
      덕분에 반경 칩을 바꿔도 서버 재요청이 없다(이미 200개 안에 2km
      이내는 다 들어있으므로).
    - 댓글 답글: comments.parent_comment_id(자기 자신을 참조하는
      FK)로 한 단계 깊이만 지원한다(답글의 답글은 없음 — 요청받은 건
      "답글 기능"이었지 무한 스레드가 아니었다는 판단, 필요해지면 그때
      확장). PostDetail.jsx는 이제 댓글을 직접 그리지 않고 top-level
      댓글(parent_comment_id가 null)만 골라 각각 자기 답글 목록과 함께
      Comment.jsx에 넘긴다 — 실제 렌더링(본문/반응/답글쓰기/신고)은
      Comment.jsx가 전담한다. supabaseClient.js의 createComment는
      parentCommentId 인자를 추가로 받는다(기본 null=최상위 댓글).
    - 댓글 이모지 반응: categories.js의 COMMENT_REACTION_EMOJIS(5종
      고정 팔레트) 중 하나를 누르면 react_to_comment RPC가 토글한다
      (같은 브라우저가 같은 이모지를 다시 누르면 반응이 빠진다).
      집계는 posts.report_count 등과 같은 패턴으로 comments.reactions
      jsonb({emoji: count})에 캐시해뒀다 — 그 덕분에 반응이 바뀌어도
      **새 realtime 채널을 만들지 않고** 기존 subscribeToComments의
      UPDATE 구독을 그대로 재사용해 다른 사용자 화면에도 실시간
      반영된다. reactor_secret은 notifications.js의
      getOrCreateDeviceSecret(24번에서 이미 "이 브라우저의 유일한
      익명 정체성"으로 자리잡은 값)을 그대로 재사용했다 — 신고 전용인
      myPosts.js의 reporter_secret과는 다른 값이다(신고는 여전히
      reporter_secret 사용, 헷갈리지 말 것).
    - "내가 이 반응을 이미 눌렀는지" 하이라이트 표시는 Comment.jsx
      컴포넌트의 로컬 state(reactedKeys)로만 관리하고 localStorage에
      영속화하지 않는다 — 새로고침하면 하이라이트만 초기화되고(다시
      누르면 정상적으로 토글된다, 서버 쪽 중복 방지는 reactor_secret
      unique 제약이 항상 보장) 카운트 자체는 그대로다. 신고 버튼의
      "신고됨" 영속 상태(21번)와 달리 반응은 되돌릴 수 있는 가벼운
      행동이라 영속화까지는 하지 않기로 한 의도적 결정.
26. PWA 재적용(홈 화면 추가/오프라인 앱 셸 캐시/푸시) — 완료 여부는
    vite.config.js의 VitePWA 플러그인, public/icons/ 실제 PNG, src/sw.js
    존재로 확인.
    - 8번에서 제거했던 이유(직접 파일 업로드 배포에서 아이콘 바이너리가
      깨짐)는 이제 해당 안 됨을 먼저 확인했다 — .vercel/project.json과
      git remote가 있어 정상적으로 git 연동 배포 중이었다. 아이콘은
      Python Pillow로 실제 PNG 바이너리(icon-192/512, apple-touch-icon
      180, favicon 32)를 새로 만들어 public/icons/에 커밋했다(정확히
      8번이 안내한 순서 그대로).
    - vite-plugin-pwa를 strategies: 'injectManifest'로 붙였다(기본값인
      generateSW가 아님) — 14번 이후 이미 src/sw.js에 웹 푸시 커스텀
      로직(push/notificationclick)이 있어서, generateSW처럼 서비스워커
      전체를 자동생성해버리면 그 로직을 끼워 넣을 자리가 없기 때문.
      injectManifest는 내가 쓴 sw.js 소스에 `precacheAndRoute(self.__WB_MANIFEST)`
      한 줄만 추가하고, 빌드 시 그 자리에 오프라인 캐시할 파일 목록을
      주입해준다. **그래서 sw.js를 public/이 아니라 src/로 옮겼다**
      (public/의 파일은 그대로 복사만 될 뿐 이 주입을 받을 수 없음) —
      기존에 public/sw.js를 직접 서빙하던 방식과 다르다는 걸 헷갈리지
      말 것. 빌드 결과물은 dist/sw.js로 그대로 나온다(경로 `/sw.js`는
      안 바뀜, notifications.js의 register('/sw.js') 호출도 그대로).
    - manifest.icons에 `purpose: 'any maskable'`을 줬다 — 아이콘 디자인
      자체가 이미 안쪽 80% 세이프존에만 그려져 있어서(핀 모양이 캔버스
      전체를 안 채움) 마스커블 요구사항을 만족한다, 별도로 마스커블
      전용 이미지를 또 안 만들어도 된다. iOS는 web manifest의 icons를
      아예 안 읽어서 index.html에 `<link rel="apple-touch-icon">`을
      따로 추가했다(vite-plugin-pwa가 자동으로 넣어주는 건
      `<link rel="manifest">`뿐).
    - **오프라인 캐싱의 현실적인 범위**: 이 앱은 카카오맵 SDK를 외부
      `<script>`로 불러오고 Supabase 실시간 데이터에 강하게 의존하는
      구조라, "오프라인에서도 글 목록/지도가 보인다"는 애초에 불가능하다
      (둘 다 네트워크가 있어야만 의미 있음). 그래서 프리캐시 대상은
      빌드된 JS/CSS/HTML(앱 셸)과 아이콘뿐이다 — 목표는 "오프라인이면
      흰 화면 대신 앱은 일단 뜨고, MapView의 기존 에러/로딩 처리(지도
      로드 실패 시 '다시 시도' 등, 7번 단계)가 나머지를 감당한다"
      정도다. 이걸 넘어서는 오프라인 데이터 동기화는 만들지 않았다.
    - **개발 서버(npm run dev)에서는 서비스워커가 안 뜬다**
      (devOptions.enabled: false) — devOptions.enabled: true로도
      시도해봤지만 실제로 `/sw.js`를 등록하면 Vite dev의 SPA 폴백과
      섞여 MIME 타입이 깨지는 걸 확인했다(injectManifest+dev 조합의
      알려진 한계, vite-plugin-pwa 공식 문서도 오프라인 캐싱 검증은
      build+preview로 하라고 안내함). **PWA/오프라인/푸시 동작 확인은
      반드시 `npm run build && npm run preview`(또는 실제 배포)로 할
      것** — `npm run dev`로는 절대 검증되지 않는다. 이건 원래
      public/sw.js였을 때(dev에서도 되던 것)와 달라진 부분이니 헷갈리지
      말 것.
    - registerType: 'autoUpdate' + src/sw.js의 install(skipWaiting)/
      activate(clients.claim) 리스너를 짝지어, 새로 배포해도 열린 탭이
      다음 네비게이션부터 바로 새 버전을 쓰게 했다(오래된 캐시에 갇히는
      문제 방지). 서비스워커 등록 자체는 vite-plugin-pwa가 모든 방문마다
      자동으로 하고(injectRegister 기본값), notifications.js의 기존
      `navigator.serviceWorker.register('/sw.js')` 호출(알림 켤 때만
      실행)은 그대로 남겨뒀다 — 같은 스크립트/스코프라 두 번 등록해도
      안전하고(idempotent), 알림 흐름 코드를 안 건드리기 위해서다.
27. 홈(지도 탭) 상단 "이번 주 우리 동네 소식" 자동 큐레이션 카드 —
    완료 여부는 src/components/WeeklyDigest.jsx, usePosts.js의
    getWeeklyDigestPosts 존재로 확인.
    - usePosts.js에 getWeeklyDigestPosts(posts, referenceTime, limit=3)를
      추가했다 — getTopWaitingSpots/getTopLikedPosts(10번)와 같은 자리에
      있는 "자동 큐레이션" 계열 함수다. 최근 7일(WEEKLY_DIGEST_DAYS) +
      반응(확인/추천 합산, categories.js getReactionCount 재사용)이
      1 이상인 글만 인기순으로 상위 몇 개 뽑는다 — 완전히 무반응인
      글로 채워진 "소식"은 의미가 없다고 판단해 제외했다.
    - 대상 글 범위는 커뮤니티 탭과 동일한 "내 위치 500m"다
      (COMMUNITY_RADIUS_METERS 재사용). 실시간 카테고리는 유효시간이
      짧아(최장 2시간) 활성 상태로 일주일을 버틸 수 없으므로, 결과는
      실질적으로 자유주제 글 위주가 된다 — "소식 요약"이라는 취지에
      자연스럽게 맞아떨어지는 결과라 별도 카테고리 필터를 추가하지
      않았다.
    - MapView.jsx의 map-header(위치명+장소검색이 있던 자리) 맨 아래에
      WeeklyDigest.jsx를 얹었다 — 지도 탭이 곧 "홈 화면"이라는 판단
      (TabBar 기본 탭이 지도). 반응이 있는 글이 하나도 없으면(조용한
      주) 카드 자체가 안 뜬다(TrendingFallback과 같은 "없으면 null"
      패턴). ×로 닫으면 그 지도 화면이 mount돼 있는 동안만 숨겨진다
      (탭을 나갔다 오면 다시 보임 — "닫음"을 영속화할 만큼 중요한
      설정은 아니라고 판단, 요청받은 건 "카드 추가"였지 "닫힘 기억"은
      아니었음).
28. 모바일 UX 감사(엄지 영역 배치/터치 타겟 44px/WCAG AA 대비/모션) —
    완료 여부는 index.css :root의 --color-gray-300~450·--color-cat-*
    hex 값(어두워졌는지), .map-side-rail의 bottom 배치, `prefers-reduced-motion`
    미디어 쿼리 존재로 확인. 새 컴포넌트는 없고 전부 기존 파일 수정.
    - **엄지 영역(하단 1/3) 배치**: 카테고리 필터·핀 표시 토글(.map-side-rail)이
      원래 화면 상단(top:88px)에 있었다 — FAB 바로 위, 화면 하단으로
      옮기고 z-index를 30(quick-post-fab과 동일, map-sheet의 15보다 위)으로
      올렸다. 그 결과 MapSheet가 어느 높이로 펼쳐져 있어도(접힘/중간/전체)
      이 버튼들이 항상 그 위에 떠서 눌린다 — FAB이 이미 쓰던 것과 같은
      원리. category-filter-menu(필터 펼침 목록)는 이제 토글이 하단에
      있으므로 위로 펼치도록 top:0→bottom:0으로 바꿨다.
    - **"현재 위치" 버튼 신설**: 지도를 드래그해서 벗어나도 되돌아올
      방법이 아예 없었다(최초 진입 시 한 번만 내 위치로 중심 잡음).
      MapView.jsx에 handleRecenterToMyLocation을 추가하고 map-side-rail
      세 번째 버튼(🎯)으로 넣었다 — App.jsx의 recenterTarget(24번, FAB
      빠른등록 전용) prop을 거치지 않고 MapView가 이미 갖고 있는
      kakaoMapRef로 직접 setCenter한다(더 간단하고, FAB 흐름과 무관한
      독립된 액션이라 섞지 않았다). 카카오 모드 전용(placeholder는
      뷰포트가 항상 userLocation 중심이라 버튼 자체가 의미 없음).
    - **터치 타겟 44px**: 지도 옆 버튼 3개(이미 44px), FAB(이미 48px+)는
      기존에도 통과였다. 미달이었던 것들을 min-width/min-height:44px +
      flex 중앙정렬로 올렸다 — 각종 닫기 버튼(quick-post/post-detail/
      place-card/map-cluster-popover/weekly-digest), 장소검색 전송
      버튼(32→44px), 알림설정 관심지역·키워드 칩의 × 제거 버튼(20→44px),
      즐겨찾기 × 제거 버튼, 카테고리 필터 메뉴 행(min-height 추가),
      메뉴 뒤로가기 버튼, 핀메뉴/장소미리보기/장소카드의 전체너비
      액션 버튼들(42px→44px 미세 조정), 각종 가로 스크롤 칩(카테고리/
      정렬/즐겨찾기/채팅반경/카테고리작성모달/댓글반응 이모지, 아이콘
      선택 칩 36→44px).
      **의도적으로 44px 미만으로 남긴 것**: 댓글 하나의 시각·답글·신고
      버튼 3개(.post-detail-comment-footer 안). 서로 바로 붙어 있어서
      3개 다 44px 히트박스로 채우면(특히 보이지 않는 확장 영역까지
      쓰면) 서로 겹쳐 오탭을 유발한다고 판단해, 세로 패딩만 넉넉히
      키워 36~40px 선에서 타협했다(코드 주석에 이유 남겨둠). 지도
      마커(.map-marker--small 28px 등)도 의도적 예외다 — 지도 위에서
      점들이 다닥다닥 붙는 게 정상이라 모든 마커를 44px로 키우면 클러스터링
      설계(MapView.jsx clusterByScreenPosition) 자체와 충돌한다.
    - **WCAG AA 대비 4.5:1**: 실제로 Python으로 상대휘도/대비비를 계산해
      점검했다(감·눈대중 아님). 미달이었던 것:
      - `--color-gray-300`(#aaaaaa, 2.32:1) / `--color-gray-350`(#999999,
        2.5~2.85:1, 이 앱에서 "보조 텍스트"로 가장 많이 쓰이던 색이라
        영향 범위가 제일 컸음) / `--color-gray-400`(#888888, 2.7~3.5:1)
        / `--color-gray-450`(#777777, 3.9~4.5:1) — 전부 실제 쓰이는
        배경(흰색뿐 아니라 gray-100, surface-placeholder, surface-muted,
        accent-tint 등) 중 가장 어두운 경우를 기준으로 최소한만
        어둡게 보정했다. gray-500(#666666) 이상은 이미 통과라 안 건드림.
      - 카테고리 색 5개(혼잡/교통/동네소식/맛집/일상 — 흰 배경 텍스트
        대비 3.6~4.0:1)도 어둡게 보정했다. **categories.js
        CATEGORY_COLORS도 반드시 같이 고쳤다**(index.css 주석에 있는
        "반드시 같은 값으로 유지" 규칙). 나머지 4개(웨이팅/사건사고/
        동네질문/취미)는 이미 통과라 안 건드림.
      - `--color-accent-tint`(#eef5f2)도 그 위에 놓이는 accent 텍스트와
        4.45:1로 근소하게 미달이라 아주 살짝(#f2f7f5로) 더 밝게
        보정했다 — accent 자체(흰 배경 4.93:1)는 건드리지 않았다(앱
        전역 핵심 색이라 블라스트 반경이 훨씬 큼).
      - `--color-danger-muted`/`--color-accent-muted`는 대비가 낮지만
        고치지 않았다 — 둘 다 `:disabled` 상태 전용 색이라 WCAG상
        비활성 컨트롤은 대비 요구사항 예외다.
      - 카카오 SVG 마커 글자(.map-marker--large/small, .map-pin)의
        px 고정값은 rem으로 안 바꿨다 — MapView.jsx가 JS 상수로 그리는
        SVG data URI 글자 크기와 픽셀 단위로 정확히 맞춰야 placeholder
        모드와 kakao 모드 마커 글씨 크기가 어긋나지 않는다(코드 주석에
        이유 남김, 다른 rem 전환 원칙의 의도적 예외).
    - **본문 14px/보조 12px, rem 단위**: 이미 전부 rem이었다(위 마커
      예외 3곳 빼고). 12px(0.75rem) 미만이던 11개(tab-bar-label,
      chat-message-time, weekly-digest-item-meta, category-filter-group-label,
      map-infowindow-edited-badge, post-inquiry-badge, realtime-carousel-meta,
      report-button/--tiny, post-detail-comment-time/reply-toggle)를
      전부 0.75rem으로 올렸다. "본문"으로 판단한 것(실제 읽는 내용/
      입력창) 중 14px 미만이던 8개(realtime-carousel-content,
      recovery-code-text, recovery-restore-input, community-favorite-input,
      post-detail-comment-input, place-preview-address, place-card-address/
      phone)는 0.875rem으로 올렸다. 나머지 0.76~0.85rem 텍스트(버튼
      라벨/칩/힌트/빈 상태 안내 등)는 "본문"이 아니라 UI 보조 문구로
      판단해 그대로 뒀다(이미 12px 넘음).
    - **모션**: 버튼 눌림 효과를 scale(0.96)→scale(0.97), 0.15s→0.1s
      ease-out으로 바꿨다(색/배경 전환은 0.15s 유지 — 눌림만 짧게 끊어야
      "바로 반응한다"는 느낌이 남). 바텀시트 진입 애니메이션
      (sheet-slide-up)은 0.25s cubic-bezier(...)였던 걸 전부 0.2s
      ease-out으로(파일 전체에서 8곳), sheet-backdrop-in은 지속시간은
      이미 0.2s였어서 이징만 ease-out으로 맞췄다. 드래그형 시트(MapSheet/
      PostDetail)가 손을 뗀 뒤 스냅되는 height 트랜지션도 0.3s→0.2s
      ease-out으로 줄였다. `prefers-reduced-motion: reduce`를 새로
      추가했다(전역 * 셀렉터로 모든 transition-duration/animation-duration을
      0.01ms로, iteration은 1회로 강제) — 지도 로딩 스피너(무한 회전)를
      포함해 이 앱의 모든 애니메이션이 이 미디어 쿼리 하나로 한꺼번에
      꺼진다.

새 요청을 받으면 위 단계 중 어디까지 되어 있는지 코드를 먼저 확인하고,
이미 된 부분은 건드리지 않고 다음 단계부터 이어서 작업한다.

## 하지 말 것
- .env 파일 내용을 출력하거나 커밋에 포함시키는 것
- 카카오맵/Supabase 키를 코드에 직접 문자열로 삽입하는 것
- 기존 파일 구조를 임의로 재구성하는 것 (제안은 가능, 실행은 확인 후)
- 새 라이브러리 추가 전 기존 스택으로 해결 가능한지 먼저 검토하는 것 생략
