# 우리동네알림 결함·실사용자 테스트 보고서

- 테스트 일자: 2026-07-18 (Asia/Seoul)
- 저장소: `seowon507-pixel/diccopipiiiiiii`
- 브랜치/커밋: `main` / `ba57e5a1f546eea052d8edc21982cc84bbc89d8e`
- 초기 판정: **NO-GO — 원본 main 상태로는 출시를 권장하지 않음**

> 아래 1~8장은 원본 `main` 커밋에서 재현한 결함 기록이다. `kimiv`의 최신 기능·보안 재검증 결과와 초기 v1 결과는 바로 아래에 별도로 정리했다.

## 0-A. kimiv 2026-07-19 업그레이드 결과

- 코드 준비도: **8.5/10 — staging migration·실제 푸시 worker 검증 전까지 CONDITIONAL GO**
- 자동 테스트: **16개 파일, 51개 테스트 통과**
- SQL 통합 테스트: PostgreSQL 17에서 v1/v4 migration을 각각 2회 적용 후 전체 검증 통과
- 해결: 화면과 DB 계약이 어긋났던 신고·답글·반응·복구·푸시 설정을 버전형 RPC로 통일
- 해결: owner/device/reporter/reactor secret의 서버 plaintext 저장 제거
- 해결: 5회 신고 숨김과 중복 방지를 원자화하고 hidden 콘텐츠를 RLS에서도 제외
- 해결: 답글 direct INSERT 제거, Supabase HMR client 중복 제거, 게시글 카드 중첩 인터랙션 제거
- 남은 배포 조건: 두 migration의 staging 적용, 실제 push/image worker 연결, 운영 키 기반 E2E·남용 방어

## 0. kimiv v1 수정·재검증 결과

- 수정 판정: **CONDITIONAL GO — migration 적용과 운영 준비를 완료한 뒤 제한된 베타 가능**
- 자동 테스트: **9개 파일, 19개 테스트 통과**
- production build: **Vite 8.1.5 빌드 성공**
- 의존성 감사: **알려진 취약점 0건**
- SQL 통합 테스트: PostgreSQL 17의 기존 스키마에 migration을 **2회 연속 적용 성공**
- 브라우저 회귀: 환경변수 누락, 위치 timeout, 320×568, 선택 위치 커뮤니티, 작성 dialog, Escape, 지도 시트 키보드, 탭 왕복 상태 보존 확인

### v1에서 해결한 주요 항목

- Supabase 환경변수 누락 시 빈 화면 대신 명확한 설정 오류와 재시도 제공
- 실제 기기 위치와 서울시청 표시용 fallback을 분리하고, 신뢰 위치가 없으면 글·핀·채팅 쓰기 차단
- 글 수정·삭제를 owner secret RPC로 제한하고 서버에는 SHA-256 hash만 저장
- 글·소유권·아이콘을 한 트랜잭션으로 생성하고 client request ID로 재시도 중복 방지
- 현황 확인·추천을 원자 증가로 변경하고 브라우저별 중복 반응 차단
- 채팅을 서버 1km 반경 RPC로 제한하고 전역 좌표 SELECT/Realtime 제거
- 댓글·채팅·핀·글 생성에 서버 입력검증과 쓰기 빈도 제한 추가
- snapshot과 Realtime 사이 경합을 보정하고 mutation 응답을 즉시 로컬 화면에 반영
- 카카오 SDK 실패 시 간단 지도 fallback, 핀/게시글 오류 상태와 재시도 UI 제공
- 선택한 지도 좌표를 커뮤니티 탭까지 전달하고 탭 왕복 후 지도/시트 상태 유지
- dialog 의미, 초기 포커스, Tab 순환, Escape, 포커스 복귀, 키보드 MapSheet, 모바일 확대 허용
- lockfile, Node 버전, 테스트 도구, CI, migration 재현 테스트 추가

### 출시 전 남은 조건

1. `supabase/migrations/20260718_v1_security_hardening.sql`을 운영 전 staging에 먼저 적용하고 기존 데이터·정책과 충돌 여부를 확인해야 한다.
2. `storage_cleanup_queue`를 service-role로 처리하는 worker와 모니터링이 필요하다. 현재 migration은 정리 요청을 안전하게 큐에 넣지만 Storage 객체를 직접 지우지는 않는다.
3. 실제 카카오/Supabase staging 키로 지도 SDK, Realtime reconnect, 이미지 업로드/정리까지 포함한 E2E를 통과해야 한다.
4. 익명 actor token은 localStorage 삭제로 회전할 수 있으므로, 공개 베타 전 Edge Function의 IP 기반 제한·Turnstile 등 추가 남용 방어가 필요하다.
5. 신고·차단·관리자 삭제·콘텐츠 모더레이션 운영 흐름은 여전히 별도 구현이 필요하다.

### migration 미적용 로컬 DB 기능 복원 검증

- `VITE_ALLOW_LEGACY_BACKEND=true`인 개발 환경에서만 v2 RPC의 `PGRST202`를 기존 API로 전환하도록 호환 계층 추가
- 권한·입력검증·rate limit·네트워크·v2 내부 함수 오류는 legacy API로 전환하지 않도록 회귀 테스트 추가
- 자동 테스트: **10개 파일, 30개 테스트 통과**
- 실제 Supabase 브라우저 확인: 게시글 생성·수정·추천·댓글·삭제, 핀 생성·삭제, 채팅 조회 성공
- 검증용 게시글·댓글·핀은 테스트 직후 삭제했으며 채팅 메시지는 생성하지 않음
- 위치 권한이 사라져도 기존 글 수정은 허용하고, 채팅은 fallback 위치 기준 읽기만 허용
- localStorage가 차단되면 현재 탭 세션 메모리에 작성 소유권을 유지

## 1. 테스트 범위와 방법

### 로컬 검증

- GitHub 저장소를 새 작업공간에 clone
- Node 24.14.0 / npm 11.9.0에서 의존성 설치
- `npm run build` 반복 실행
- `npm audit --json` 실행
- 순수 함수 경계값 스모크 테스트
  - Haversine 거리
  - 카테고리 만료 비율
  - 5분/50m 중복 판정
  - localStorage 소유권 저장·삭제·손상 데이터
- 개발 서버와 production preview를 각각 실행
- 인앱 브라우저에서 데스크톱 및 320×568 모바일 뷰포트 사용자 여정 점검
  - 첫 진입
  - 지도/커뮤니티/채팅/메뉴 탭 이동
  - 지도 위치 선택과 장소 커뮤니티 이동
  - 오프라인 채팅 전송
  - 오프라인 핀 생성
  - 위치 권한 거부 후 커뮤니티·채팅 화면
  - 키보드 포커스 대상과 선택 상태

### 다중 패널 검증

20개의 독립 테스트 패널로 다음 영역을 나누어 검토했다.

1. 실행·아키텍처·테스트 기반
2. 백엔드/API/데이터
3. 프런트엔드/UX/접근성
4. 모바일 초보 사용자
5. 지도·장소검색 파워유저
6. 커뮤니티 피드·검색·정렬
7. 게시글 CRUD·사진
8. 핀 생명주기·소유권
9. 채팅·Realtime
10. 지리좌표·거리·경계값
11. Supabase RLS·RPC·일관성
12. 입력검증·스팸·콘텐츠 안전
13. 키보드·스크린리더·저시력
14. 성능·번들·대규모 데이터
15. 오프라인·오류 복구
16. 시간 만료·타임존·시계 왜곡
17. 의존성·빌드·배포·공급망
18. 위치 개인정보·위협모델
19. 한국어 카피·초보자 정보구조
20. 출시 전 E2E·수용성 판정

플랫폼의 완료 스레드 유지 한도로 인해 20개 패널은 10개의 고유 서브에이전트가 여러 독립 턴으로 수행했다. 따라서 “20개 독립 테스트 패스”이며 “20개의 고유 에이전트 ID”는 아니다.

## 2. 자동 검증 결과

### 빌드

```text
vite v5.4.21
✓ 97 modules transformed
dist/assets/index-*.js  400.79 kB │ gzip 114.43 kB
✓ built
```

빌드는 성공했지만 이는 런타임 성공을 보장하지 않는다. 환경변수가 없는 새 clone은 브라우저에서 즉시 실패했다.

### 자동 테스트·정적 검사

- `package.json`에는 `dev`, `build`, `preview`만 존재
- unit/component/E2E 테스트 없음
- lint/typecheck/coverage 없음
- GitHub Actions 없음
- Supabase migration/seed/RLS/RPC SQL 없음

### 의존성 감사

- high 1건: Vite 개발 서버 경로 우회 계열
- moderate 1건: esbuild 개발 서버 요청 노출 계열
- 감사 결과가 제시한 자동 수정은 Vite 8 major 업그레이드이므로 별도 호환성 검증이 필요
- 원본 저장소에 lockfile이 없어 설치 시점에 따라 실제 버전이 달라짐

관련 advisory:

- <https://github.com/advisories/GHSA-fx2h-pf6j-xcff>
- <https://github.com/advisories/GHSA-67mh-4wv8-2f99>

## 3. 실사용자 브라우저 재현 결과

### 재현 A — 새 clone이 빈 화면으로 시작

1. 실제 키가 없는 상태로 개발 서버 실행
2. 첫 화면 진입
3. `src/supabaseClient.js`의 module import 단계에서 `supabaseUrl is required` 발생
4. React root는 비어 있고 사용자에게 오류나 설정 안내가 표시되지 않음

문제: 준비된 dummy fallback은 `getPosts()` 내부에 있어 Supabase client 생성 예외보다 늦다. fallback에 도달할 수 없다.

### 재현 B — 백엔드 장애를 빈 데이터로 오인

테스트용 형식만 맞춘 로컬 URL을 사용해 앱을 실행했다.

- 앱은 열리지만 posts 조회 실패를 dummy 데이터로 바꿈
- dummy 데이터가 모두 만료형·오래된 데이터라 “표시할 게시글이 없어요”만 보임
- 채팅 전송 실패 시 입력은 남지만 오류는 콘솔에만 기록
- 핀 생성 실패 시 미리보기와 버튼이 그대로이며 오류는 콘솔에만 기록
- 사용자는 실제 빈 상태, 오프라인, 권한 오류를 구분할 수 없음

### 재현 C — 선택한 위치와 다른 커뮤니티

1. 지도 placeholder의 임의 지점 선택
2. “커뮤니티 보기” 클릭
3. 선택 좌표가 아닌 현재 사용자 위치 기준 “내 주변 500m” 커뮤니티가 열림

### 재현 D — 위치 권한 거부 후 잘못된 신뢰 표현

production preview에서 위치 요청을 허용하지 않고 timeout/거부 상태를 확인했다.

- 지도에는 “서울시청 기준 위치” 안내가 표시됨
- 커뮤니티 탭에서는 안내가 사라지고 “내 주변 500m”라고 표시
- 채팅 탭에서도 “내 위치 1km 이내”라고 표시
- 이 상태에서 쓰기 로직은 서울시청 좌표를 실제 위치처럼 사용

### 재현 E — 모바일·키보드

- 320×568에서 가로 overflow는 재현되지 않음
- 카테고리 메뉴를 열면 배경 피드 필터와 하단 탭까지 포함해 다수의 포커스 대상이 그대로 남음
- 모달/시트의 dialog semantics, focus trap, Escape 닫기, 포커스 복귀가 없음
- `maximum-scale=1.0`으로 모바일 확대가 제한됨

## 4. 출시 차단 결함

### P0-1. 환경변수 누락 시 전체 앱이 빈 화면

- 근거: `src/supabaseClient.js:4-7`
- 영향: README대로 설정할 기회조차 없이 앱이 죽음
- 개선: 시작 전 env preflight, 명확한 설정 오류 화면, 개발용 mock 명시 주입

### P0-2. 익명 사용자가 다른 사람 게시글 수정 가능

- 근거: `src/supabaseClient.js:142-159`, `CLAUDE.md:103-105`
- 영향: 제목·본문·이미지·아이콘·카운터 변조
- 개선: 일반 UPDATE 정책 제거, `update_own_post(post_id, owner_secret, ...)` 원자적 RPC

### P0-3. 정확한 위치 데이터가 전역 공개

- 근거: `src/supabaseClient.js:9-18,57-61,228-261`
- 영향: posts/pins/chat의 정확한 위·경도, 시각, 내용을 anon key로 전역 수집 가능
- 개선: 서버 반경 조회, 지역별 구독, 좌표 격자화, 공개 SELECT에서 정밀 좌표 제거

### P0-4. 백엔드 계약을 재현할 수 없음

- 저장소에 Supabase migration, RLS, RPC, Storage, Realtime publication 정의가 없음
- 영향: 문서와 실제 운영 권한이 같은지 감사 불가, CI 통합 테스트 불가
- 개선: 모든 SQL과 정책을 migration으로 버전 관리

### P0-5. 자동 테스트와 CI 품질 게이트가 없음

- 근거: `package.json:6-9`
- 영향: 권한·Realtime·거리·만료·모바일 회귀를 PR에서 검출할 방법이 없음
- 개선: Vitest/Testing Library/Playwright + CI 필수 검사

### P0-6. 글 생성이 비원자적이며 소유권을 잃을 수 있음

- 근거: `src/supabaseClient.js:27-54`, `src/App.jsx:152-175`
- 재현: 생성 RPC 성공 후 icon UPDATE만 실패
- 영향: UI는 실패지만 글은 존재, 로컬 owner token 미저장, 재시도 중복
- 개선: icon까지 생성 RPC에 포함하고 idempotency key 사용

### P0-7. 위치 거부를 서울시청의 실제 사용자로 처리

- 근거: `src/useUserLocation.js:21-38`, `src/App.jsx:146-150`, `src/components/ChatRoom.jsx:46-54`
- 영향: 지역 데이터 오염, 잘못된 local/external 판정, 서울 채팅에 타지역 사용자 메시지 유입
- 개선: fallback 표시 좌표와 신뢰된 사용자 위치를 분리하고 위치 기반 쓰기 차단/수동 지역 선택

### P0-8. 서버 측 입력검증·rate limit·moderation이 없음

- 근거: `src/abuseCheck.js`, `src/components/PostModal.jsx`, `src/components/ChatRoom.jsx`, `src/components/PostDetail.jsx`
- 영향: direct API로 길이·카테고리·중복 제한 우회, 익명 도배, 유해 콘텐츠 지속 노출
- 개선: DB CHECK, RPC allowlist, rate limit, 신고·차단·관리자 큐

## 5. 높은 우선순위 결함

### 데이터·Realtime

- 전역 최신 채팅 200개를 먼저 자른 후 1km 필터하여 실제 주변 채팅이 누락됨
- 초기 조회와 Realtime 구독 경합으로 새 데이터가 사라지거나 삭제된 데이터가 되살아남
- 재연결 후 누락 구간 refetch/reconcile 없음
- 성공한 mutation 응답을 로컬 상태에 반영하지 않고 Realtime 이벤트에만 의존
- 추천/확인 카운터가 `currentCount + 1` UPDATE라 동시 클릭 시 유실
- 응답 유실 후 재시도하면 게시글·핀·댓글·채팅이 중복 생성됨

### 지도·핀·커뮤니티

- Kakao SDK 실패 시 빈 지도에서 영구 정지
- 지도에서 선택한 장소의 커뮤니티가 현재 GPS 커뮤니티로 열림
- 선택한 건물이 posts 스냅샷을 저장해 실시간 추가·삭제·필터·만료를 반영하지 않음
- 30m 그리디 건물 클러스터가 입력 순서에 따라 다른 결과 생성
- 타인 핀에도 삭제/글쓰기 액션이 보이지만 소유권이 없으면 무반응 또는 핀·글 중첩
- 1km 밖 핀은 생성 가능하지만 생성 직후 표시 필터 밖으로 사라져 다시 찾기 어려움

### 사진·개인정보

- 공개 Storage에 익명 업로드 가능
- 게시글 실패·교체·삭제 뒤 고아 사진을 정리하지 않음
- 원본 EXIF를 제거하지 않아 촬영 위치가 노출될 수 있음
- 자유주제 글과 채팅 정확 좌표에 retention/자동 삭제 정책이 없음
- localStorage 토큰 상실 시 사용자가 자기 위치 데이터를 삭제할 수 없음

### 의존성·배포

- lockfile, Node/npm 버전 고정 없음
- 새 설치에서 선언 버전과 실제 설치 버전이 크게 달라짐
- Vite/esbuild 알려진 취약점 2건
- Vite `base`가 없어 GitHub Pages 하위 경로 배포 시 asset 404 가능
- 외부 Kakao SDK에 명시적 HTTPS/CSP/무결성·준비 상태 검증 부족

## 6. UX·접근성·성능 개선 항목

### UX

- 모든 빈 상태가 데이터 없음·검색 0건·필터 0건·오프라인을 같은 문구로 표시
- 글쓰기 진입이 모바일 롱프레스에 숨겨져 발견하기 어려움
- 지도 탭을 나갔다 돌아오면 중심·줌·검색·시트·핀 표시 상태가 초기화
- 저장 중 모달을 닫고 새 초안을 열면 이전 요청 완료가 새 모달까지 닫을 수 있음
- 자동 중복 감지가 새 글 작성 의도를 예고 없이 기존 글 수정으로 바꿈
- “주변/커뮤니티” 범위가 화면마다 500m·1km·전체로 달라 이해하기 어려움

### 접근성

- 모달/바텀시트에 `role=dialog`, `aria-modal`, focus trap, Escape, 포커스 복귀 없음
- Kakao 마커와 지도 위치 선택은 키보드 대체 경로 없음
- MapSheet 핸들이 포인터 전용
- 일부 입력은 placeholder만 있고 영구 label 없음
- 탭·필터·정렬 선택 상태 전달 부족
- `#999` 작은 텍스트 대비 부족, focus outline 제거
- `index.html`의 `maximum-scale=1.0`으로 저시력 확대 제한

### 성능

- posts/pins를 전량 `select('*')` 후 브라우저에서 거리·시간 필터
- 30초 tick마다 다수 마커 재생성
- 빈 핀 마커도 무관한 상태 변화에 전량 재생성
- 건물 클러스터 최악 O(N²), posts 갱신마다 역지오코딩 반복
- 피드 검색 입력마다 전체 filter/sort/DOM 렌더

### 시간·경계

- 만료가 사용자 기기 시계에 종속
- 미래 `created_at` 데이터가 장기간 활성
- `updated_at`을 클라이언트 시계로 저장
- GPS `accuracy`를 무시한 500m/1km 하드 컷오프
- 수정 시각을 최신처럼 표시하지만 만료는 최초 작성 시각 기준

## 7. 권장 수정 순서

1. **백엔드 보안 경계**
   - migrations/RLS/RPC 커밋
   - 타인 UPDATE 차단
   - 서버 반경 조회와 위치 최소화
   - 입력검증/rate limit/moderation

2. **원자성·멱등성**
   - post+owner+icon 단일 RPC
   - count 증가 원자적 RPC
   - idempotency key
   - Storage 보상 삭제

3. **시작·오류·연결 상태**
   - env preflight
   - loading/error/offline/stale 분리
   - SDK/Realtime ready·error·reconnecting 상태
   - reconnect refetch+merge

4. **위치 신뢰 모델**
   - trusted location과 fallback center 분리
   - 위치 거부 시 지역성 쓰기 차단
   - accuracy 반영
   - 서버 시계 기준 expires_at

5. **테스트 기반**
   - lockfile/Node 고정
   - Vitest 단위·컴포넌트 테스트
   - 로컬 Supabase 통합 테스트
   - Playwright 두 브라우저 Realtime E2E
   - CI 필수 게이트

6. **사용성·접근성·성능**
   - dialog/focus/키보드
   - 모바일 글쓰기 CTA
   - 오류별 빈 상태와 복구 CTA
   - 서버 페이지네이션·공간 필터·마커 diff

## 8. 최소 출시 회귀 테스트

- 깨끗한 clone → `npm ci` → migration → seed → build
- 환경변수 누락/잘못된 Kakao key/Supabase 장애
- owner/non-owner 생성·수정·삭제 권한
- 위치 허용·거부·timeout·이동·낮은 정확도
- 499/500/501m, 999/1000/1001m 경계
- 20/30/60/120분 만료 직전·정확히 경계·직후
- 두 브라우저 동시 추천·댓글·채팅·핀 변환
- Realtime 단절 중 변경 → 재연결 후 재동기화
- 응답 유실 후 같은 idempotency key 재시도
- 모바일 320/360/390px, 회전, 가상 키보드
- 키보드 전용, 스크린리더 dialog, 확대 200%
- 사진 MIME 위장, 5MB 경계, EXIF 제거, 실패 후 Storage 정리

## 9. 결론

프로젝트는 production build에는 성공하지만, 보안 경계·위치 개인정보·실시간 일관성·오류 복구·테스트 재현성에서 출시 차단 결함이 있다. 특히 타인 게시글 수정, 정확 좌표 전역 공개, 서울시청 fallback 데이터 오염, 백엔드 migration 부재를 먼저 해결해야 한다.
