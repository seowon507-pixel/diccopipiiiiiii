# CLAUDE.md

이 파일은 프로젝트 루트에 두면 Claude(Cursor/Claude Code)가 매 요청마다
자동으로 참고한다. 목적: 반복 설명 제거, 불필요한 탐색 최소화, 일관된 결과물.

## 프로젝트 한 줄 요약
우리동네알림 — 실시간 동네 소통 지도 앱.
사용자가 지도에 웨이팅/혼잡/사건사고/교통 정보를 남기고
다른 사용자가 실시간으로 확인하는 서비스.

## 스택 (재확인 불필요, 항상 이 조합 사용)
- Vite + React (함수형 컴포넌트 + Hooks만, 클래스 컴포넌트 금지)
- 지도: 카카오맵 JS SDK
- DB/실시간: Supabase (Postgres + Realtime)
- PWA: 현재 미적용 (vite-plugin-pwa 제거됨, 아래 8번 참고)

## 파일 구조 (이 구조를 벗어나지 말 것)
```
src/
  MapView.jsx          지도 렌더링 전담, 카카오맵 SDK 관련 로직만
  supabaseClient.js     Supabase 연결 및 CRUD 함수, 다른 곳에서 직접 fetch 금지
  abuseCheck.js         중복 게시글 방지 로직
  components/
    PostModal.jsx        게시글 작성 모달
    CategoryFilter.jsx    카테고리 필터 칩
    PostDetail.jsx        마커 클릭 시 상세 카드
dummy-data.json          Supabase 연결 실패 시 fallback 데이터
.env                     실제 키 (git 추적 금지)
.env.example             키 이름만 적힌 템플릿
```
새 기능 추가 시 이 구조 안에서 배치할 위치를 먼저 판단하고,
애매하면 새 파일을 만들기보다 기존 파일에 함수를 추가하는 쪽을 우선한다.

## 데이터 모델 (posts 테이블) — 매번 다시 묻지 말 것
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | pk, default gen_random_uuid() |
| lat, lng | float8 | |
| category | text | 웨이팅/혼잡/사건사고/교통 |
| content | text | 최대 50자 |
| confirm_count | int | default 0 |
| created_at | timestamptz | default now() |

카테고리별 유효시간: 웨이팅 30분 · 혼잡 20분 · 사건사고 2시간 · 교통 1시간.

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
   불일치/서비스 비활성 에러가 남).

새 요청을 받으면 위 단계 중 어디까지 되어 있는지 코드를 먼저 확인하고,
이미 된 부분은 건드리지 않고 다음 단계부터 이어서 작업한다.

## 하지 말 것
- .env 파일 내용을 출력하거나 커밋에 포함시키는 것
- 카카오맵/Supabase 키를 코드에 직접 문자열로 삽입하는 것
- 기존 파일 구조를 임의로 재구성하는 것 (제안은 가능, 실행은 확인 후)
- 새 라이브러리 추가 전 기존 스택으로 해결 가능한지 먼저 검토하는 것 생략
