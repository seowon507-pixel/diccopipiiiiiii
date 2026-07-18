# 우리마동 알림

내 주변의 실시간 제보, 커뮤니티, 채팅을 지도와 함께 제공하는 React/Vite 애플리케이션입니다.

## 로컬 실행

Node.js 22.12 이상을 권장합니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local`에 다음 공개 클라이언트 설정을 입력합니다.

- `VITE_KAKAO_MAP_KEY`: 카카오 지도 JavaScript 키
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon 키

설정이 없거나 잘못된 경우 앱은 빈 화면 대신 연결 설정 오류를 표시합니다. 개발 중 샘플 게시글이 필요할 때만 `VITE_USE_DUMMY_DATA=true`를 명시적으로 설정할 수 있습니다. 실제 위치를 대신하는 개발 좌표도 `VITE_DEV_LOCATION_OVERRIDE=true`를 설정한 경우에만 사용됩니다.

## 데이터베이스 적용

앱을 배포하기 전에 `supabase/migrations/20260718_v1_security_hardening.sql`을 Supabase에 적용해야 합니다. 이 migration은 다음을 포함합니다.

- 게시글·핀·댓글·채팅의 직접 쓰기 차단
- 작성자 소유권을 확인하는 원자 RPC
- 좋아요/현황 확인의 중복 방지와 원자 카운터
- 쓰기 빈도 제한
- 서버 반경 필터를 거친 채팅 조회
- 입력값·좌표 제약과 이미지 정리 대기열

기존 운영 데이터가 제약 조건을 위반하면 migration 검증 단계가 실패할 수 있으므로, 적용 전 백업과 데이터 점검이 필요합니다. 브라우저에 저장되는 소유 토큰을 지우면 해당 브라우저에서 기존 글을 수정·삭제할 수 없습니다.

## 검증

```bash
npm run check
npm audit --audit-level=high
```

세부 결함, 사용자 시나리오, 우선순위와 재현 방법은 `TEST_REPORT.md`에 정리되어 있습니다. GitHub Actions도 push와 pull request에서 같은 테스트·빌드·보안 감사를 실행합니다.
