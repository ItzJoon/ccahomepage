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
    │   ├─ org-activities/          # 조직 활동 (안건함/조직 일정/활동기록 탭)
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
    │       ├─ badges/               # 연속 접속 뱃지 관리 (추가/수정/비활성화)
    │       ├─ pages/                # 페이지·메뉴 빌더 (신규 메뉴 추가)
    │       ├─ users/                # 회원 권한(role) 관리
    │       ├─ stats/                # 접속 통계
    │       └─ org-activities/       # 조직 활동 관리(안건함/조직 일정/활동기록, 독립 섹션)
    ├─ components/                 # Header, Badge, NotificationBanner, StreakBar, BadgeCelebration 등
    │   └─ admin/                  # FileUpload, AdminNav, PostManager
    │       └─ org-activities/     # ProposalsManager, OrgEventsManager, OrgRecordsManager
    ├─ hooks/
    │   ├─ useRealtimeList.ts      # 테이블 실시간 구독 공용 훅
    │   ├─ useAttendance.ts        # 연속 접속 체크 훅 (스트릭 프리즈 포함)
    │   ├─ useAutoCheckIn.ts       # 접속 시 버튼 없이 자동 체크인 + 토스트/뱃지 축하 훅
    │   └─ useBadges.ts            # 뱃지 정의/획득 조회 + 마일스톤 자동 지급 훅
    └─ lib/
        ├─ types.ts                 # 공용 타입
        └─ supabase/                # client.ts / server.ts / middleware.ts
```

---

## 2. 데이터베이스 스키마 요약

| 테이블 | 설명 |
|---|---|
| `profiles` | `auth.users` 확장. `role`(student/teacher/sub_editor/editor/admin/superadmin) 보유. 가입 시 트리거로 자동 생성(기본 student) |
| `organizations` | 학생자치회 조직 (임원회/대의원회/사법위원회/총회 등, 관리자가 자유 추가) |
| `members` | 조직별 구성원 프로필 |
| `posts` | 공지(`type=notice`)·뉴스(`type=news`) 공용. 고정/예약발행/상태 포함 |
| `attachments` | 공지·뉴스·일정·규정 공용 첨부파일 (post_id / event_id / rule_id 중 하나 연결) |
| `events` | 학사일정·학생자치회 일정 |
| `rules` | 학생생활규정 문서 |
| `questions` / `answers` | Q&A. `is_private`로 비공개 질문 구분. `author_display_name`으로 학생 목록에 작성자 이름 공개 여부 결정 |
| `notifications` | 실시간 알림 발송 이력 |
| `user_attendance` | 사용자별 일일 접속 기록 + 연속 접속일수 |
| `pages` / `menus` / `blocks` | 관리자가 코딩 없이 추가하는 커스텀 페이지/메뉴 (확장용) |
| `main_blocks` | 홈 화면 블록(공지/일정/뉴스/빠른메뉴) 노출 여부·순서 |
| `audit_logs` | 관리자 작업 감사 로그 |
| `badges` | 연속 접속 뱃지 정의 (코드/조건일수/아이콘, 관리자가 추가) |
| `user_badges` | 사용자별 뱃지 획득 기록 |
| `proposals` | 조직 활동 안건함. `organizations.id`로 소속 조직 연결, 상태(검토중/승인/반려/완료) |
| `proposal_votes` | 안건 찬반 투표. `(proposal_id, user_id)` 유니크로 중복 투표 방지 |
| `org_events` | 조직별 내부 일정(회의/행사/마감/일반). 학사일정 `events`와는 별개 |
| `org_records` | 조직별 활동기록(공지/활동/회의록). 게시물 `posts`와는 별개 |

`profiles`에는 마이페이지 프로필 설정용 `nickname`, `bio` 컬럼과 스트릭 프리즈 개수 `freeze_credits` 컬럼이 추가되었고,
`user_attendance`에는 프리즈로 채워진 날짜인지 표시하는 `is_freeze` 컬럼과 실제 체크인 시각 `created_at`
컬럼이 추가되었습니다(`visit_date`는 날짜만 저장해서 같은 날 여러 명이 체크인하면 순서를 알 수 없어,
`/admin/stats`의 "전체 접속 기록"은 `created_at` 기준 최신순으로 정렬됩니다). `user_attendance_with_name`
뷰는 `user_attendance`에 `profiles`를 조인해 이름/이메일이 함께 보이도록 만든 것으로, Supabase
테이블 편집기나 SQL Editor에서 직접 조회할 때도 유용합니다.

전체 컬럼 정의와 관계는 `supabase/schema.sql`을 참고하세요.

### 권한 체계 (RLS)

- **읽기**: 공개 콘텐츠(조직/구성원/일정/규정/발행된 게시물)는 로그인 여부와 무관하게 누구나 열람.
  Q&A 비공개 질문은 작성자 본인과 `admin` 이상만 조회 가능(행 단위로 DB가 강제).
- **Q&A 작성자 공개 범위**: `/qna`에서 질문을 등록할 때 "질문 목록에 제 이름 공개하기"를 선택할 수
  있습니다. 선택하면 등록 시점의 표시 이름이 `author_display_name`에 저장되어 학생 목록에도 그대로
  보이고, 선택하지 않으면 학생 목록에는 "익명"으로 표시됩니다(작성자 자신도 목록에서는 익명으로 보임).
  관리자(`admin`/`editor`, `/admin/qna`)는 이 설정과 무관하게 `profiles`를 조인해 실제 작성자를
  항상 볼 수 있습니다. 비공개 질문은 이 선택과 상관없이 트리거가 `author_display_name`을 강제로
  비워서, 무조건 관리자에게만 작성자가 공개됩니다.
- **쓰기**: `editor` 이상만 콘텐츠 생성/수정, `admin` 이상만 회원 role 변경.
- **Q&A 답변은 `editor` 이상 누구나** 작성·수정할 수 있습니다. 단 비공개 질문은
  `questions_read` 정책상 작성자 본인과 `admin` 이상에게만 보이므로, `editor`는 애초에 그
  내용을 볼 수 없어 공개 질문만 답변하게 됩니다.
- **Q&A 질문 삭제**는 작성자 본인 또는 `admin` 이상만 가능합니다(`editor`는 답변은 되지만
  삭제는 안 됨). `/qna`에서 본인 질문에는 "내 질문 삭제" 버튼이 보이고, `/admin/qna`에서는
  `admin` 이상에게만 삭제 버튼이 보입니다(`editor`에게는 🔒). 질문을 삭제하면 연결된 답변도
  `on delete cascade`로 함께 삭제됩니다.
- **삭제 권한 강화**: 공지/뉴스(`posts`)와 알림 발송 기록(`notifications`)을 실제로 지우는 건
  `admin` 이상만 가능합니다. `editor`는 계속 작성/수정할 수 있고, "사라지게" 하는 것도 가능합니다
  (공지/뉴스는 발행 상태를 "임시저장"으로 바꾸면 공개 화면에서 숨겨지고, 알림 팝업은 "팝업 중지"로
  기록은 남긴 채 더 이상 뜨지 않게 할 수 있습니다). `/admin/notices`, `/admin/news`, `/admin/notify`
  화면에서 `editor`로 보면 삭제 버튼 대신 🔒가 표시됩니다.
- **작성자/발송자 기록**: 공지·뉴스는 `posts.author_id`, 알림은 `notifications.sent_by`에 작성자가
  자동 기록되고, 각 관리 화면 목록에 이름이 함께 표시됩니다.
- **`teacher` 역할**: 현재는 권한이 `student`와 완전히 동일합니다(`is_admin()`/`is_editor_or_above()`
  둘 다 `teacher`를 포함하지 않음). 나중에 선생님 전용 기능을 추가할 때 구분하려고 미리 만들어둔
  역할이며, `/admin/users`에서 학생 계정을 `teacher`로 바꿔줄 수 있습니다.
- **`editor` / `sub_editor` 역할**: `editor`는 부장(부서장)용, `sub_editor`는 부원 전용으로 구분해서
  만든 역할입니다. `sub_editor`는 아직 `is_admin()`/`is_editor_or_above()` 어디에도 포함되지 않아
  `student`/`teacher`와 권한이 동일합니다(`/admin` 접근 불가). 부원에게 어떤 권한까지 줄지는
  나중에 `is_editor_or_above()` 등에 `sub_editor`를 포함시키는 식으로 정할 수 있습니다.
- **role 승격 제한**: `admin`은 다른 사용자를 `editor`/`student`로 조정할 수 있지만, 자기 자신을 포함해
  누구도 `admin`/`superadmin`으로 승격시킬 수 없고, 이미 `admin`/`superadmin`인 계정은 아예 수정할 수
  없습니다(`superadmin`만 가능). `profiles_update_self` 정책만으로는 본인 row의 role 변경을 막을 수
  없어서, `protect_profile_fields` 트리거가 실제 방어선 역할을 합니다.
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

## 7. 역할별 권한 정리

`role`은 낮은 순서대로 `student` < `teacher`/`sub_editor`(student와 동일, 확장용 자리) <
`editor` < `admin` < `superadmin` 입니다. 아래는 실제 RLS 정책 기준으로 각 역할이 **위 단계에
추가로** 할 수 있는 일만 적었습니다(위 단계 권한은 전부 포함).

### student (기본, 로그인 시)
- 공개 콘텐츠 열람: 조직/구성원/일정/규정/발행된 공지·뉴스/커스텀 페이지 (비로그인도 열람 가능)
- 배너·팝업 알림 확인
- Q&A: 질문 작성, 공개 질문 열람, 본인 비공개 질문 열람, **본인 질문 삭제**
- 조직 활동: 안건 제안, 안건 찬반 투표(중복 불가, 본인 투표 취소/변경 가능)
- 마이페이지: 닉네임·자기소개·프로필 사진 수정 (`email`/`role`은 트리거로 변경 차단)
- 접속 시 자동 체크인 → 연속 접속일수 적립, 자동/수동/시크릿 뱃지 획득
- `/admin` 진입 불가 (middleware 차단)

### teacher / sub_editor
- 현재는 **student와 완전히 동일**합니다. `is_admin()`/`is_editor_or_above()` 어디에도
  포함되지 않은, 나중에 각각 선생님·부원 전용 기능을 추가할 때 쓸 자리입니다.

### editor (`/admin` 접근이 열리는 최소 등급, 부장급)
- 콘텐츠 생성·수정: 조직·구성원·일정·규정·공지/뉴스·커스텀 페이지·메뉴·메인화면 블록·뱃지 정의
- 조직·구성원은 **삭제까지 가능**
- 공지·뉴스는 작성·수정만 가능, **삭제는 불가**(임시저장으로 바꿔 숨기는 것은 가능)
- 알림 발송·수정("팝업 중지" 포함)은 가능, **발송 기록 삭제는 불가**
- 학생 계정을 검색해 구성원에 연결, 학생에게 뱃지 직접 부여
- **Q&A 답변 작성/수정 가능**(공개 질문만 — 비공개 질문은 애초에 안 보임), **질문 삭제는 불가**
- 조직 활동: 조직 일정·활동기록 작성/수정/삭제, 안건 상태 변경(검토중/승인/반려/완료).
  **안건 자체 삭제는 불가**
- 첨부파일 업로드/삭제
- 다른 사용자의 role은 열람만 가능, 변경 불가

### admin
- 공지·뉴스, 알림 발송 기록 **삭제 가능**
- Q&A **질문 삭제 가능**
- 조직 활동 **안건 삭제 가능**
- 다른 사용자 role 변경 가능 — 단 `student`/`teacher`/`sub_editor`/`editor`로만.
  **`admin`/`superadmin`으로 승격 불가**(자기 자신 포함), 이미 admin/superadmin인 계정은 수정 불가
- 학생이 획득한 뱃지 삭제(회수) 가능
- 감사 로그 열람, 전체 학생 접속 기록/통계 열람, 비공개 Q&A 질문 전체 열람
- **사이트 잠금(점검 모드)이 켜져 있으면 `/admin`을 포함해 아무 페이지도 이용할 수 없음**
  (admin/superadmin만 예외)

### superadmin
- **모든 계정의 role을 자유롭게 변경**(admin/superadmin 승격 포함, admin/superadmin 계정도 수정 가능)
- 그 외 권한은 admin과 동일
- **사이트 잠금(점검 모드) 켜고 끄기** — 켜져 있는 동안에도 admin/superadmin은 사이트를
  평소처럼 이용 가능(잠금의 영향을 받지 않음)

> 이 섹션은 역할/권한이 바뀔 때마다 함께 업데이트합니다.

## 8. 마이페이지 프로필 설정

- `/mypage`에서 학생이 직접 표시 이름(닉네임), 자기소개 한 줄, 프로필 사진을 수정할 수 있습니다.
- 프로필 사진은 `profile-photos` Storage 버킷의 `{내 user_id}/파일명` 경로에 업로드되고,
  `profiles.profile_image`에 공개 URL이 저장됩니다. 구성원 소개(`/members`)에서 학생회 구성원으로
  등록된 계정은 이 사진이 자동으로 카드에 표시됩니다(별도로 등록한 `members.photo_url`이 있으면 그게 우선).
- `email`, `role`은 이 화면에서 수정할 수 없고, DB 트리거(`protect_profile_fields`)로 학생이 직접
  API를 호출해도 절대 바뀌지 않도록 서버 단에서 막아둡니다. 관리자는 기존처럼 `/admin/users`에서 role을 변경합니다.
- 기존 DB에 반영하려면 `supabase/schema.sql` 하단의 "기능 2. 마이페이지 프로필 설정" 블록과
  `supabase/storage.sql`의 `profile-photos` 정책 부분을 다시 실행하세요.
- `/admin/members`(구성원 관리)에서 구성원을 추가/수정할 때 "계정 연결"로 로그인된 사용자를
  이름·이메일로 검색해 연결할 수 있습니다. 연결하면 이름이 자동으로 채워지고, 그 계정의 마이페이지
  프로필 사진이 구성원 카드에 함께 표시됩니다(소개글은 계정과 무관하게 계속 직접 입력). editor 이상만
  계정 목록을 검색할 수 있도록 `profiles_select_editor_or_above` 정책이 추가되었습니다.
- `/admin/organizations`(조직 관리)에서 조직을 선택하면 그 조직의 소속 구성원 목록과
  "+ 구성원 추가"가 바로 보여서, `/admin/members`로 이동하지 않고도 구성원을 추가/삭제할 수
  있습니다(계정 연결 방식은 동일). 소개글 등 세부 항목은 여전히 `/admin/members`에서 편집합니다.

## 9. 연속 접속일수 보상(뱃지) 시스템

- 로그인한 학생이 사이트 아무 페이지에나 접속하면(모든 학생 화면에 공통으로 뜨는 `Header`에서
  처리), 버튼을 누르지 않아도 그날 첫 방문 시 자동으로 체크인되고 화면 정중앙에 "오늘 접속 체크
  완료! 연속 N일째" 팝업이 잠깐 떴다 사라집니다(`useAutoCheckIn`). 연속 접속일수가 뱃지 조건
  (기본 3/7/30/100일)에 도달하면 그 순간 자동으로
  뱃지가 함께 지급되고 축하 모달이 뜹니다.
- 획득한 뱃지는 마이페이지 "획득한 뱃지" 영역에서 항상 확인할 수 있고(아직 못 받은 뱃지는 흐리게 표시),
  Supabase Realtime으로 관리자가 뱃지를 추가/수정하면 화면에 바로 반영됩니다.
- 관리자는 `/admin/badges`에서 뱃지를 자유롭게 추가/수정/비활성화/삭제할 수 있습니다. 코드값(`code`)은
  고유해야 하고, 비활성화(`is_active`)하면 학생 화면 노출과 자동 지급만 멈춥니다 — "뱃지 직접 부여"로는
  비활성 뱃지도 계속 줄 수 있고, 이미 받은 학생의 뱃지는 항상 그대로 유지됩니다.
- **시크릿 뱃지(`is_secret`)**: 켜두면 학생이 그 뱃지를 획득하기 전까지 마이페이지 "획득한 뱃지"
  목록에 아예 표시되지 않습니다. 지급받는 순간(자동이든 "뱃지 직접 부여"든) 정상적으로 나타납니다.
  숨겨진 이벤트/깜짝 뱃지를 만들 때 사용하세요.
- **지급 방식(`award_type`)**: 뱃지마다 "자동"(연속 접속일수 조건 도달 시 자동 지급), "날짜 조건"
  (특정 날짜 이전/이후/당일에 로그인 시 자동 지급), "수동"(관리자가 달성을 직접 확인하고 부여) 중
  하나를 선택할 수 있습니다.
  - **날짜 조건(`date`)**: `date_condition`(`before`/`after`/`on`)과 `date_condition_value`(날짜)로
    구성됩니다. 학생이 체크인(접속)하는 시점의 날짜가 조건을 만족하면(예: 2026-09-01 이전에 로그인)
    그 즉시 자동 지급됩니다. 조건을 만족하는 날짜에 접속하지 않고 지나가면 이후에는 지급되지 않습니다
    (연속 접속 뱃지와 동일하게 체크인 시점에만 평가).
  - **수동(`manual`)**: `streak_threshold`가 없고 조건을 설명란에 자유롭게 적을 수 있어(예: "○○
    선생님과 진로 상담 완료하기"), `/admin/badges` 하단의 "뱃지 직접 부여"에서 학생을 검색해 원하는
    뱃지를 즉시 지급합니다(자동/날짜 조건 뱃지도 예외적으로 직접 줄 수 있음). 이미 지급된 뱃지를
    다시 주려 하면 안내 메시지만 뜨고 중복 지급되지 않습니다.
- **스트릭 프리즈**: 각 학생에게 기본 1개(`profiles.freeze_credits`)가 주어지며, 하루를 건너뛰어도
  프리즈가 남아있으면 그 하루를 자동으로 채워 연속 기록이 끊기지 않습니다(1회 소모). 추가 지급은 아직
  전용 관리 화면이 없어 필요 시 SQL로 `update profiles set freeze_credits = n where id = '...'` 형태로 조정하세요.
- 기존 DB에 반영하려면 `supabase/schema.sql` 하단의 "기능 4. 연속 접속일수 보상(뱃지) 시스템" 및
  "21. 뱃지 날짜 조건" 블록을 실행하세요.

## 10. 알림 발송

- `/admin/notify`에서 발송할 때 **노출 방식**을 고를 수 있습니다(`notifications.display_type`):
  - **배너**: 기존처럼 화면 상단에 작게 표시되고, 학생이 언제든 ✕로 닫을 수 있습니다.
  - **팝업**: 페이지 진입 시 화면 가운데 모달로 뜨고, "확인" 또는 "오늘 하루 안 보기"를 눌러야
    사라집니다. "오늘 하루 안 보기"는 그 브라우저(localStorage)에만 저장되어, 같은 학생이라도
    다른 기기·브라우저에서는 다시 뜹니다.
- 배너에는 **표시 시간**을 고를 수 있습니다: "계속 표시"(기본값, 학생이 직접 닫기 전까지 유지)
  또는 10분/30분/1시간/3시간/24시간. 시간이 지나면 배너가 자동으로 사라집니다
  (`notifications.duration_minutes`). 팝업은 확인 전까지 계속 뜨는 게 목적이라 표시 시간 설정이 없습니다.
- 발송 이력의 팝업 항목에는 **"팝업 중지"**와 **"삭제"**가 따로 있습니다(`notifications.popup_active`).
  - **팝업 중지**: 발송 기록은 그대로 남기고, 지금 떠 있는 팝업만 즉시 닫고 앞으로 새로 뜨지 않게 합니다.
  - **삭제**: 기록 자체를 지우면서, 지금 떠 있는 팝업도 동시에 닫습니다.
  - 둘 다 Supabase Realtime으로 즉시 반영되어, 이미 팝업을 보고 있는 학생 화면에서도 바로 닫힙니다.
  - 배너 항목에는 "삭제"만 있습니다(배너는 이미 자유롭게 닫을 수 있어 별도 중지가 필요 없음).
- **이메일 발송은 지원하지 않습니다.** 알림/공지는 Supabase Realtime으로 접속 중인 학생 화면에만
  즉시 반영되는 구조라, 접속하지 않은 학생에게 이메일로 알리려면 별도로 이메일 발송 파이프라인
  (Supabase Edge Function + Resend/SendGrid 같은 이메일 API, 또는 DB 트리거 + webhook)을 추가로
  구축해야 합니다. 필요하면 별도 기능으로 요청하세요.

## 11. 조직 활동 (안건함 / 조직 일정 / 활동기록)

학생용 `/org-activities`(헤더 메뉴 "조직 활동")에서 기존 `organizations`(임원회/대의원회/
사법위원회/총회 등)를 그대로 활용해 조직별로 아래 3가지를 제공합니다.

- **안건함**: 로그인한 학생 누구나 조직을 골라 안건을 등록할 수 있고, 역시 로그인한 학생
  누구나 찬성/반대에 투표할 수 있습니다. `proposal_votes`가 `(proposal_id, user_id)` 유니크
  제약이라 같은 안건에 중복 투표가 DB 단에서 막힙니다. 이미 투표한 버튼을 다시 누르면 투표
  취소, 반대쪽 버튼을 누르면 투표가 바뀝니다. 상태(검토중/승인/반려/완료)는 관리자만
  `/admin/org-activities/proposals`에서 바꿀 수 있고, 안건 삭제는 `admin` 이상만 가능합니다.
- **조직 일정**: 기존 학사일정(`events`, `/calendar`)과는 별개로, 조직 내부 회의·행사용
  일정(`org_events`)입니다. 학생 화면에서는 조직을 필터링해 열람만 하고, 작성/수정/삭제는
  `editor` 이상만 `/admin/org-activities/events`에서 할 수 있습니다.
- **활동기록**: 기존 공지/뉴스(`posts`)와는 별개로, 조직 단위 기록(`org_records`)을
  공지/활동/회의록 세 분류로 남깁니다. 마찬가지로 작성/수정/삭제는 `editor` 이상만
  `/admin/org-activities/records`에서 할 수 있습니다.

관리자 화면은 기존 공지/뉴스/일정 관리 메뉴와 섞이지 않도록 `/admin/org-activities/*`
독립 경로로 분리했고, `AdminNav`에서도 구분선 아래 "조직 활동 관리" 그룹으로 따로 묶었습니다.
전용 컴포넌트(`ProposalsManager`/`OrgEventsManager`/`OrgRecordsManager`)를 새로 만들어서
기존 `PostManager` 등 범용 CRUD 컴포넌트와는 재사용 관계가 없습니다.

기존 DB에 반영하려면 `supabase/schema.sql` 하단의 "기능: 조직 활동" 블록을 실행하세요
(전체 재실행도 안전합니다).

## 12. 사이트 잠금(점검) 모드

`/admin/maintenance`에서 admin 이상이 사이트 전체를 잠글 수 있습니다(`site_settings.maintenance_mode`).

- **켜면**: admin/superadmin을 제외한 모든 사용자(비로그인 포함, `editor`도 포함)가 어떤
  경로로 들어와도(`/admin` 하위 포함) `/maintenance` 안내 화면으로 리다이렉트됩니다.
  `/login`, `/auth/callback`, `/maintenance` 자체만 예외입니다. `middleware.ts`에서
  요청마다 `site_settings`를 확인해서 처리하며, 조회 자체가 실패하거나 테이블이 없으면
  안전하게 잠그지 않는 쪽으로(fail-open) 동작합니다.
- **안내 화면(`/maintenance`)**: 로그아웃 상태면 가운데 정렬된 "로그인" 버튼을, 이미 로그인한
  비관리자 상태면 "로그아웃" 버튼을 보여줍니다. `site_settings.maintenance_message`(안내 문구)와
  `maintenance_until`(예정 종료일, 예: `2026.09.01`)을 그대로 화면에 표시합니다.
- **날짜를 하드코딩하지 않고 토글로 설계**했습니다 — 특정 날짜가 지나면 코드를 지우는 대신,
  `/admin/maintenance`에서 언제든 켜고 끌 수 있고 문구·날짜도 그때그때 바꿀 수 있습니다.
- 잠금 설정 변경은 `admin` 이상만 가능합니다(`editor`가 `/admin/maintenance`에 들어가면
  읽기 전용으로만 보이고 🔒 안내가 뜹니다).
- 기존 DB에 반영하려면 `supabase/schema.sql` 하단의 "사이트 잠금(점검) 모드" 블록을
  실행하세요.

## 13. 향후 확장

`pages` / `menus` / `blocks` 테이블과 관리자의 **페이지/메뉴 빌더** 화면을 이용하면,
설문조사·투표·행사 신청·동아리 페이지·학생회비 안내 같은 기능도 코드 배포 없이
새 페이지 형태로 우선 추가할 수 있습니다. 전용 상호작용(예: 투표 집계)이 필요해지면
해당 기능만 별도 테이블 + 컴포넌트로 확장하면 됩니다.
