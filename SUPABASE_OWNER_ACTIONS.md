# Supabase 제작자 적용 요청서

이 문서는 앱 제작자/프로젝트 소유자만 수행해야 하는 Supabase 작업입니다. 프런트엔드용 `anon` 키로는 적용할 수 없습니다. `service_role`, Secret key, DB 비밀번호를 다른 사람에게 전달하지 말고 제작자 계정에서 직접 실행해주세요.

## 적용 대상

- 마이그레이션: `supabase/migrations/20260720024147_v6_auth_moderation_admin_security.sql`
- 목적: 로그인 프로필 계약을 코드화하고, 로그인 계정 기반 신고 중복 방지와 관리자 검토·조치·감사 기록을 추가합니다.

## 현재 확인된 아이디 저장 오류

2026-07-20 원격 프로젝트 점검에서 기존 `set_username(text)` 함수는 응답했지만, v6 확인용 `current_app_role_v1()` 호출은 `PGRST202`(함수 없음)를 반환했습니다. 이는 이 문서의 v6 마이그레이션이 원격 프로젝트에 아직 적용되지 않았다는 뜻입니다. 로그인 직후 `아이디를 저장하지 못했어요`가 표시되면 프런트 키를 바꾸거나 `service_role` 키를 전달하지 말고, 먼저 아래 마이그레이션 전체를 적용하세요.

적용 후 아래 확인 쿼리가 모두 `true`여야 합니다.

```sql
select
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regprocedure('public.set_username(text)') is not null as set_username_ready,
  to_regprocedure('public.current_app_role_v1()') is not null as role_rpc_ready;
```

그다음 해당 사용자는 앱에서 `로그아웃하고 다시 로그인하기`를 눌러 새 세션으로 아이디 저장을 다시 시도해야 합니다.

## 적용 전 확인

1. Supabase Dashboard에서 데이터베이스 백업 또는 PITR 가능 여부를 확인합니다.
2. 가능하면 Supabase 개발 브랜치에서 먼저 마이그레이션과 앱을 검증합니다.
3. 기존 `profiles`, `post_reports`, `comment_reports` 데이터에 중복 사용자명이 없는지 확인합니다.

## 마이그레이션 적용

Supabase CLI가 프로젝트에 연결되어 있다면 저장소 루트에서 다음을 실행합니다.

```bash
supabase db push
supabase migration list
supabase db advisors
```

CLI를 사용하지 않는다면 Dashboard SQL Editor에서 마이그레이션 파일 전체를 한 트랜잭션으로 실행합니다. 일부 구문만 골라 실행하지 마세요.

마이그레이션이 수행하는 작업:

- `profiles` 테이블과 본인 조회 RLS, `is_username_available`, `set_username` RPC 정의
- `private.user_roles` 관리자 역할 저장소 추가
- 관리자 역할을 `user_metadata`가 아닌 서버 관리 테이블에서 검증
- 로그인한 `auth.uid()` 기준 `report_post_v3`, `report_comment_v3` 신고 중복 방지
- 기존 임의 브라우저 키 방식의 `report_*_v2` 실행 권한 회수
- `moderation_cases`, `moderation_audit_log`와 신고 동기화 트리거 추가
- 신고자 식별정보를 반환하지 않는 관리자 큐 RPC 추가
- 숨김·복구·기각만 허용하는 원자적 관리자 조치 RPC 추가
- `post-images` 객체명/메타데이터의 익명 목록 열람 차단

## 첫 관리자 지정

관리자도 일반 사용자와 동일하게 앱에서 회원가입하고 이메일 인증을 완료해야 합니다.

1. Dashboard → Authentication → Users에서 관리자 계정의 UUID를 복사합니다.
2. SQL Editor에서 아래 `<ADMIN_USER_UUID>`만 실제 UUID로 바꿔 실행합니다.

```sql
insert into private.user_roles(user_id, role)
values ('<ADMIN_USER_UUID>', 'admin')
on conflict (user_id) do update
set role = excluded.role;
```

신고 검토만 담당하고 관리자 권한을 최소화하려면 `admin` 대신 `moderator`를 사용합니다.

역할 회수:

```sql
delete from private.user_roles
where user_id = '<ADMIN_USER_UUID>';
```

클라이언트에서 관리자를 지정하거나 사용자의 `user_metadata`에 역할을 넣지 마세요. 사용자가 직접 변경 가능한 메타데이터는 권한 판단에 사용할 수 없습니다.

## 인증 URL 설정

Dashboard → Authentication → URL Configuration에서 다음을 확인합니다.

- Site URL: 실제 운영 앱 주소
- Redirect URLs:
  - `http://localhost:5174/**`
  - 실제 운영 앱 주소
  - 사용하는 미리보기 도메인 패턴

회원가입 인증 메일과 로그인 링크가 허용 목록에 없는 주소로 요청되면 기본 Site URL로 이동할 수 있습니다.

## 앱 환경 전환

마이그레이션과 아래 검증이 끝나면 앱의 개발·미리보기 환경에서도 `VITE_ALLOW_LEGACY_BACKEND=false`로 바꾸고 개발 서버를 다시 시작합니다. 이 값을 `true`로 유지하면 개발 환경에서 v3 RPC가 없을 때 보안이 약한 구형 신고 API로 전환될 수 있습니다. production build에서는 코드상 항상 비활성화되지만, 모든 환경에서 새 로그인 계정 기반 신고 경로만 검증하려면 명시적으로 꺼두는 것이 안전합니다.

## 적용 후 검증 SQL

아래 검사는 사용자 데이터 내용을 출력하지 않습니다.

```sql
select
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regclass('private.user_roles') is not null as roles_ready,
  to_regclass('public.moderation_cases') is not null as moderation_ready,
  to_regprocedure('public.report_post_v3(uuid)') is not null as report_v3_ready,
  to_regprocedure('public.list_moderation_queue_v1(text,integer,integer)') is not null as queue_ready;

select
  has_function_privilege('anon', 'public.report_post_v3(uuid)', 'EXECUTE') as anon_can_report,
  has_function_privilege('authenticated', 'public.report_post_v3(uuid)', 'EXECUTE') as user_can_report,
  has_function_privilege('authenticated', 'public.report_post_v2(uuid,text)', 'EXECUTE') as user_can_spoof_reporter;
```

정상 기대값:

- 모든 `*_ready`: `true`
- `anon_can_report`: `false`
- `user_can_report`: `true`
- `user_can_spoof_reporter`: `false`

마지막으로 Dashboard의 Security Advisor와 Performance Advisor를 실행하고, 앱에서 다음을 검증합니다.

1. 일반 계정에는 `신고 관리` 메뉴가 보이지 않음
2. 지정된 관리자/운영자에게만 메뉴가 보임
3. 같은 계정의 동일 콘텐츠 재신고가 한 번만 집계됨
4. 관리자가 숨김·복구·기각을 수행할 수 있음
5. `moderation_audit_log`에 관리자 UUID와 조치가 기록됨
6. 익명 사용자가 `post-images` 버킷 목록을 열람할 수 없음

## 주의

- 관리자 웹 화면에는 `service_role` 키가 필요하지 않으며 넣어서도 안 됩니다.
- 관리자 메뉴 숨김은 편의 기능일 뿐이고, 실제 보안 경계는 DB의 RLS와 RPC 권한 검사입니다.
- 자동 신고 5회 숨김은 유지되지만 관리자가 복구하거나 신고를 기각할 수 있습니다.
