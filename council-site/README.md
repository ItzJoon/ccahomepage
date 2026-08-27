# 학생자치회 웹사이트 (Next.js + Supabase)

Google Sites를 대체하는 학생자치회 공식 사이트입니다. 학생용 공개 사이트(`/`)와 관리자 전용 사이트(`/admin`)가
같은 Supabase 데이터베이스를 공유하며, 관리자가 콘텐츠를 등록·수정하면 Supabase Realtime을 통해 학생 화면에
**즉시** 반영됩니다.

> 이 프로젝트는 더미 로그인이나 임시 저장 기능이 없습니다. 모든 데이터는 Supabase Postgres에 저장되고,
> 모든 인증은 Supabase Auth(Google OAuth / 이메일 매직링크)를 통해 이루어집니다.

---

## 1. 폴더 구조

```
council-site/
├─ middleware.ts                  # /admin 접근 가드 (세션 확인 + role 확인)
├─ tailwind.config.ts             # 디자인 토큰 (navy/blue/red/gold/teal 등)
├─ supabase/
│   ├─ schema.sql                 # 테이블 + RLS 정책 (필수, 최초 1회 실행)
│   ├─ storage.sql                # Storage 버킷 + 정책 (필수, 최초 1회 실행)
│   └─ seed.sql                   # 데모 데이터 (선택)
└─ src/
    ├─ app/
    │   ├─ layout.tsx             # 학생용 공통 레이아웃 (헤더/알림배너/푸터)
    │   ├─ page.tsx                # 학생 홈
    │   ├─ notices/                # 공지사항 목록/상세
    │   ├─ organizations/          # 학생자치회 소개 (조직 목록/상세)
    │   ├─ members/                # 구성원 소개
    │   ├─ calendar/                # 일정 캘린더(월간/목록)
    │   ├─ events/[id]/             # 일정 상세
    │   ├─ news/                    # 뉴스 목록/상세
    │   ├─ rules/                   # 학생생활규정
    │   ├─ qna/                     # Q&A (질문 등록/열람)
    │   ├─ mypage/                  # 연속 접속·방문 기록
    │   ├─ pages/[slug]/            # 관리자가 추가한 커스텀 페이지
    │   ├─ login/                   # 로그인 (Google / 이메일)
    │   ├─ auth/callback/           # OAuth·매직링크 콜백
    │   └─ admin/                   # 관리자 전용 (레이아웃에서 role 이중 검사)
    │       ├─ layout.tsx           # 관리자 사이드바 + 접근 가드
    │       ├─ page.tsx              # 대시보드
    │       ├─ notices/, news/       # 게시물 관리(예약발행·고정·첨부파일)
    │       ├─ events/               # 일정 관리(첨부파일)
    │       ├─ organizations/        # 조직 관리(순서 변경)
    │       ├─ members/              # 구성원 관리
    │       ├─ rules/                # 규정 관리(첨부파일)
    │       ├─ qna/                  # Q&A 답변 작성
    │       ├─ notify/               # 실시간 알림 발송
    │       ├─ main-editor/          # 홈 화면 블록 노출/순서 편집
    │       ├─ pages/                # 페이지·메뉴 빌더 (신규 메뉴 추가)
    │       ├─ users/                # 회원 권한(role) 관리
    │       └─ stats/                # 접속 통계
    ├─ components/                 # Header, Badge, NotificationBanner, StreakBar 등
    │   └─ admin/                  # FileUpload, AdminNav, PostManager
    ├─ hooks/
    │   ├─ useRealtimeList.ts      # 테이블 실시간 구독 공용 훅
    │   └─ useAttendance.ts        # 연속 접속 체크 훅
    └─ lib/
        ├─ types.ts                 # 공용 타입
        └─ supabase/                # client.ts / server.ts / middleware.ts
```

---

## 2. 데이터베이스 스키마 요약

| 테이블 | 설명 |
|---|---|
| `profiles` | `auth.users` 확장. `role`(student/editor/admin/superadmin) 보유. 가입 시 트리거로 자동 생성(기본 student) |
| `organizations` | 학생자치회 조직 (임원회/대의원회/사법위원회/총회 등, 관리자가 자유 추가) |
| `members` | 조직별 구성원 프로필 |
| `posts` | 공지(`type=notice`)·뉴스(`type=news`) 공용. 고정/예약발행/상태 포함 |
| `attachments` | 공지·뉴스·일정·규정 공용 첨부파일 (post_id / event_id / rule_id 중 하나 연결) |
| `events` | 학사일정·학생자치회 일정 |
| `rules` | 학생생활규정 문서 |
| `questions` / `answers` | Q&A. `is_private`로 비공개 질문 구분 |
| `notifications` | 실시간 알림 발송 이력 |
| `user_attendance` | 사용자별 일일 접속 기록 + 연속 접속일수 |
| `pages` / `menus` / `blocks` | 관리자가 코딩 없이 추가하는 커스텀 페이지/메뉴 (확장용) |
| `main_blocks` | 홈 화면 블록(공지/일정/뉴스/빠른메뉴) 노출 여부·순서 |
| `audit_logs` | 관리자 작업 감사 로그 |

전체 컬럼 정의와 관계는 `supabase/schema.sql`을 참고하세요.

### 권한 체계 (RLS)

- **읽기**: 공개 콘텐츠(조직/구성원/일정/규정/발행된 게시물)는 로그인 여부와 무관하게 누구나 열람.
  Q&A 비공개 질문은 작성자 본인과 `admin` 이상만 조회 가능(행 단위로 DB가 강제).
- **쓰기**: `editor` 이상만 콘텐츠 생성/수정/삭제, `admin` 이상만 회원 role 변경.
- 모든 정책은 Postgres RLS로 강제되므로, 프론트엔드 코드를 우회해도 DB 레벨에서 차단됩니다.
- `/admin` 경로는 `middleware.ts`(1차) + `admin/layout.tsx`(2차)에서 이중으로 role을 확인합니다.

---

## 3. 로컬 실행 방법

### 3-1. Supabase 프로젝트 준비

1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성
2. **SQL Editor** 에서 아래 순서로 실행
   ```sql
   -- 1) supabase/schema.sql 전체 실행
   -- 2) supabase/storage.sql 전체 실행
   -- 3) (선택) supabase/seed.sql 실행 — 데모 데이터
   ```
3. **Authentication > Providers > Google** 활성화 후 Google Cloud Console에서 발급한 Client ID/Secret 입력
   (학교 이메일만 허용하려면 Google Cloud OAuth 동의 화면에서 도메인을 제한하거나,
   Supabase Auth Hook으로 이메일 도메인을 검증하는 로직을 추가하세요.)
4. **Authentication > URL Configuration** 에 아래 Redirect URL 등록
   - 로컬: `http://localhost:3000/auth/callback`
   - 배포 후: `https://YOUR_DOMAIN/auth/callback`
5. **Settings > API** 에서 `Project URL`, `anon public key` 확인

### 3-2. 프로젝트 설정

```bash
npm install
cp .env.local.example .env.local
# .env.local 에 Supabase URL / anon key 입력
npm run dev
```

`http://localhost:3000` 접속.

### 3-3. 최초 관리자 지정

관리자 UI에서 스스로 admin이 될 수는 없으므로(권한 상승 방지), **최초 1명은 SQL로 직접 지정**해야 합니다.

1. 사이트에서 로그인(Google 또는 이메일)하여 `profiles` 테이블에 본인 row가 생성되도록 합니다.
2. Supabase SQL Editor에서 실행:
   ```sql
   update profiles set role = 'superadmin' where email = '본인 이메일@school.ac.kr';
   ```
3. 이후부터는 `/admin/users` 화면에서 다른 구성원의 role을 UI로 변경할 수 있습니다.

---

## 4. Vercel 배포 방법

1. GitHub 저장소에 push
2. [vercel.com](https://vercel.com) 에서 New Project → 저장소 선택
3. Environment Variables에 `.env.local`과 동일한 값 입력
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = 배포될 실제 도메인 (예: `https://council.school.ac.kr`)
4. Deploy
5. 배포 완료 후, Supabase **Authentication > URL Configuration** 의 Redirect URL에
   `https://YOUR_VERCEL_DOMAIN/auth/callback` 을 반드시 추가해야 로그인이 정상 동작합니다.
6. Google Cloud Console OAuth 클라이언트의 **승인된 리디렉션 URI**에도 Supabase 프로젝트의
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` 이 등록되어 있는지 확인하세요
   (Supabase 대시보드의 Google Provider 설정 화면에 정확한 값이 안내되어 있습니다).

---

## 5. 실시간 반영이 동작하는 원리

- `src/hooks/useRealtimeList.ts` 가 Supabase Realtime(`postgres_changes`)을 구독해서,
  관리자가 어떤 테이블에 INSERT/UPDATE/DELETE 를 하든 그 테이블을 보고 있는 모든 학생 화면이 즉시 다시 불러옵니다.
- 알림 배너(`NotificationBanner.tsx`)는 `notifications` 테이블 INSERT만 구독하여,
  관리자가 알림을 발송하는 순간 접속 중인 학생 화면 상단에 바로 표시됩니다.
- 이 전략은 학생회 규모(수백~수천 명, 소규모 트래픽)에 적합합니다. 트래픽이 커지면
  구독 시 변경분(payload)만 반영하도록 `useRealtimeList`를 최적화할 수 있습니다.

---

## 6. 보안 참고사항

- `npm run build` 로 전체 타입 체크와 프로덕션 빌드가 통과하는 것을 확인했습니다.
- 이 프로젝트는 안정적인 Next.js 14 라인을 사용합니다. `npm audit` 실행 시 Next.js 14.x 자체에
  존재하는 일부 취약점(대부분 Next 15로 올려야 해결됨)이 표시될 수 있습니다. 실제 배포 전
  `npm audit`로 최신 상태를 확인하고, 필요하면 Next 15(App Router 비동기 API 변경 등 마이그레이션
  필요)로 업그레이드를 검토하세요.

## 7. 향후 확장

`pages` / `menus` / `blocks` 테이블과 관리자의 **페이지/메뉴 빌더** 화면을 이용하면,
설문조사·투표·행사 신청·동아리 페이지·학생회비 안내 같은 기능도 코드 배포 없이
새 페이지 형태로 우선 추가할 수 있습니다. 전용 상호작용(예: 투표 집계)이 필요해지면
해당 기능만 별도 테이블 + 컴포넌트로 확장하면 됩니다.
