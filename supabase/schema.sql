-- ============================================================
-- 학생자치회 웹사이트 데이터베이스 스키마
-- Supabase(PostgreSQL) 기준. Supabase 대시보드 SQL Editor에서 실행하세요.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 1. 사용자 프로필 (auth.users 확장)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  role text not null default 'student' check (role in ('student','teacher','sub_editor','editor','admin','superadmin')),
  profile_image text,
  created_at timestamptz not null default now()
);

-- 신규 가입 시 profiles 자동 생성 (기본 role = student)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, profile_image)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ------------------------------------------------------------
-- 2. 조직 & 구성원
-- ------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  color text not null default 'navy',
  description text,
  role_description text,
  order_index int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  position text,
  photo_url text,
  bio text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. 게시물 (공지 / 뉴스 공용)
-- ------------------------------------------------------------
create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('notice','news')),
  title text not null,
  content text not null,
  category text default '일반',
  is_pinned boolean not null default false,
  status text not null default 'published' check (status in ('draft','scheduled','published')),
  publish_at date not null default current_date,
  author_id uuid references profiles(id),
  view_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references posts(id) on delete cascade,
  rule_id uuid,
  event_id uuid,
  file_url text not null,
  file_name text not null,
  file_path text,
  size int,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. 일정
-- ------------------------------------------------------------
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  start_at date not null,
  end_at date,
  location text,
  category text default '행사',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. 학생생활규정
-- ------------------------------------------------------------
create table if not exists rules (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text default '공통',
  content text not null,
  file_url text,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'attachments_rule_fk'
  ) then
    alter table attachments
      add constraint attachments_rule_fk foreign key (rule_id) references rules(id) on delete cascade;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'attachments_event_fk'
  ) then
    alter table attachments
      add constraint attachments_event_fk foreign key (event_id) references events(id) on delete cascade;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6. Q&A
-- ------------------------------------------------------------
create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  title text not null,
  content text not null,
  is_private boolean not null default false,
  status text not null default 'pending' check (status in ('pending','answered')),
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid references questions(id) on delete cascade,
  content text not null,
  answered_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. 실시간 알림
-- ------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  message text not null,
  level text not null default 'info' check (level in ('info','urgent')),
  sent_by uuid references profiles(id),
  sent_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. 접속/방문 기록 (연속 접속 체크)
-- ------------------------------------------------------------
create table if not exists user_attendance (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  visit_date date not null,
  streak_count int not null default 1,
  unique (user_id, visit_date)
);

-- ------------------------------------------------------------
-- 9. 페이지 빌더 (확장용: 새 메뉴/페이지/블록)
-- ------------------------------------------------------------
create table if not exists pages (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  content text,
  is_published boolean not null default true,
  menu_visible boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists menus (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  path text not null,
  parent_id uuid references menus(id),
  order_index int not null default 0,
  is_visible boolean not null default true
);

create table if not exists blocks (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid references pages(id) on delete cascade,
  type text not null,
  config jsonb not null default '{}',
  order_index int not null default 0
);

-- 메인 화면 블록(공지/일정/뉴스/빠른메뉴) 노출·순서 관리
create table if not exists main_blocks (
  id text primary key,
  label text not null,
  is_visible boolean not null default true,
  order_index int not null default 0
);

insert into main_blocks (id, label, is_visible, order_index) values
  ('notice','최신 공지', true, 1),
  ('event','다가오는 일정', true, 2),
  ('news','학생자치회 뉴스', true, 3),
  ('quick','빠른 메뉴', true, 4)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 10. 감사 로그
-- ------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  action text not null,
  target_table text,
  target_id text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table members enable row level security;
alter table posts enable row level security;
alter table attachments enable row level security;
alter table events enable row level security;
alter table rules enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table notifications enable row level security;
alter table user_attendance enable row level security;
alter table pages enable row level security;
alter table menus enable row level security;
alter table blocks enable row level security;
alter table main_blocks enable row level security;
alter table audit_logs enable row level security;

-- 관리자 판별 헬퍼
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin','superadmin')
  );
$$ language sql stable security definer;

create or replace function is_editor_or_above()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('editor','admin','superadmin')
  );
$$ language sql stable security definer;

create or replace function is_superadmin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$ language sql stable security definer;

-- profiles: 본인 열람/수정, 관리자는 전체 열람, superadmin만 role 변경(앱 로직에서 별도 제한 권장)
drop policy if exists "profiles_select_self_or_admin" on profiles;
create policy "profiles_select_self_or_admin" on profiles for select
  using (auth.uid() = id or is_admin());
drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update
  using (auth.uid() = id);
-- admin/superadmin은 다른 사용자의 role을 변경할 수 있음 (회원·권한 관리 화면에서 사용).
-- 단, admin(슈퍼어드민 아님)은 이미 admin/superadmin인 계정은 아예 건드릴 수 없음
-- (권한 상승/탈취를 막기 위해 최상위 계정은 superadmin만 관리)
drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update
  using (is_admin() and (is_superadmin() or role not in ('admin', 'superadmin')));

-- 공개 콘텐츠(조직/구성원/일정/규정/발행된 게시물): 누구나 열람, 관리자만 쓰기
drop policy if exists "organizations_read_all" on organizations;
create policy "organizations_read_all" on organizations for select using (true);
drop policy if exists "organizations_write_admin" on organizations;
create policy "organizations_write_admin" on organizations for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "members_read_all" on members;
create policy "members_read_all" on members for select using (true);
drop policy if exists "members_write_admin" on members;
create policy "members_write_admin" on members for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "posts_read_published" on posts;
create policy "posts_read_published" on posts for select
  using (status = 'published' or is_editor_or_above());
drop policy if exists "posts_write_admin" on posts;
create policy "posts_write_admin" on posts for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "attachments_read_all" on attachments;
create policy "attachments_read_all" on attachments for select using (true);
drop policy if exists "attachments_write_admin" on attachments;
create policy "attachments_write_admin" on attachments for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "events_read_all" on events;
create policy "events_read_all" on events for select using (true);
drop policy if exists "events_write_admin" on events;
create policy "events_write_admin" on events for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "rules_read_all" on rules;
create policy "rules_read_all" on rules for select using (true);
drop policy if exists "rules_write_admin" on rules;
create policy "rules_write_admin" on rules for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "pages_read_published" on pages;
create policy "pages_read_published" on pages for select using (is_published or is_editor_or_above());
drop policy if exists "pages_write_admin" on pages;
create policy "pages_write_admin" on pages for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "menus_read_all" on menus;
create policy "menus_read_all" on menus for select using (true);
drop policy if exists "menus_write_admin" on menus;
create policy "menus_write_admin" on menus for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "blocks_read_all" on blocks;
create policy "blocks_read_all" on blocks for select using (true);
drop policy if exists "blocks_write_admin" on blocks;
create policy "blocks_write_admin" on blocks for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "main_blocks_read_all" on main_blocks;
create policy "main_blocks_read_all" on main_blocks for select using (true);
drop policy if exists "main_blocks_write_admin" on main_blocks;
create policy "main_blocks_write_admin" on main_blocks for all using (is_editor_or_above()) with check (is_editor_or_above());

-- 알림: 누구나 열람, 관리자만 발송
drop policy if exists "notifications_read_all" on notifications;
create policy "notifications_read_all" on notifications for select using (true);
drop policy if exists "notifications_write_admin" on notifications;
create policy "notifications_write_admin" on notifications for insert with check (is_editor_or_above());

-- Q&A: 공개 질문은 누구나, 비공개 질문은 작성자 본인 + 관리자만. 로그인 사용자는 질문 작성 가능
drop policy if exists "questions_read" on questions;
create policy "questions_read" on questions for select
  using (is_private = false or auth.uid() = user_id or is_admin());
drop policy if exists "questions_insert_own" on questions;
create policy "questions_insert_own" on questions for insert
  with check (auth.uid() = user_id);
drop policy if exists "questions_update_admin" on questions;
create policy "questions_update_admin" on questions for update
  using (is_admin());

drop policy if exists "answers_read" on answers;
create policy "answers_read" on answers for select
  using (
    exists (
      select 1 from questions q
      where q.id = question_id
      and (q.is_private = false or q.user_id = auth.uid() or is_admin())
    )
  );
drop policy if exists "answers_write_admin" on answers;
create policy "answers_write_admin" on answers for insert with check (is_admin());

-- 접속 기록: 본인 것만 읽기/쓰기, 관리자는 전체 열람(집계용)
drop policy if exists "attendance_select_self_or_admin" on user_attendance;
create policy "attendance_select_self_or_admin" on user_attendance for select
  using (auth.uid() = user_id or is_admin());
drop policy if exists "attendance_upsert_self" on user_attendance;
create policy "attendance_upsert_self" on user_attendance for insert
  with check (auth.uid() = user_id);
drop policy if exists "attendance_update_self" on user_attendance;
create policy "attendance_update_self" on user_attendance for update
  using (auth.uid() = user_id);

-- 감사 로그: 관리자만 열람, 시스템(서버)에서 기록
drop policy if exists "audit_logs_admin_read" on audit_logs;
create policy "audit_logs_admin_read" on audit_logs for select using (is_admin());
drop policy if exists "audit_logs_insert_admin" on audit_logs;
create policy "audit_logs_insert_admin" on audit_logs for insert with check (is_editor_or_above());

-- ============================================================
-- Realtime 발행 (관리자 변경 → 학생 화면 즉시 반영에 사용)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'posts','events','notifications','questions','answers','organizations',
    'members','rules','pages','main_blocks','attachments','profiles'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 기능 추가분 (기존 DB에 반영하려면 이 블록만 실행해도 됩니다. 전체 재실행도 안전합니다)
-- ============================================================

-- ------------------------------------------------------------
-- 기능 2. 마이페이지 프로필 설정
-- ------------------------------------------------------------
alter table profiles add column if not exists nickname text;
alter table profiles add column if not exists bio text;

-- 학생/편집자가 본인 profiles row를 수정할 때 email/role은 절대 바뀌지 않도록,
-- 그리고 admin(슈퍼어드민 아님)이 자기 자신을 포함해 누구든 admin/superadmin으로
-- 승격시키지 못하도록 트리거로 강제한다.
-- (RLS의 USING 절만으로는 UPDATE 시 "새 값"을 막지 못하므로 이중 방어 차원의 트리거.
--  profiles_update_self 정책은 본인 row를 auth.uid()=id 조건만으로 수정 허용하므로,
--  admin이 본인 row의 role을 바로 'superadmin'으로 바꿔도 RLS만으로는 막을 수 없다.)
create or replace function protect_profile_fields()
returns trigger as $$
begin
  if not is_admin() then
    -- student/editor: email, role 변경 불가
    new.email := old.email;
    new.role := old.role;
  elsif not is_superadmin() and new.role in ('admin', 'superadmin') and new.role <> old.role then
    -- admin(슈퍼어드민 아님)은 자기 자신을 포함해 누구도 admin/superadmin으로 승격시킬 수 없음
    -- (admin -> editor/student로 강등시키는 것은 계속 허용)
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists before_profile_update on profiles;
create trigger before_profile_update
  before update on profiles
  for each row execute procedure protect_profile_fields();

-- ------------------------------------------------------------
-- 기능 4. 연속 접속일수 보상(뱃지) 시스템
-- ------------------------------------------------------------
-- 스트릭 프리즈: 하루 결석해도 1회는 연속 기록을 지켜주는 지급 개수
alter table profiles add column if not exists freeze_credits int not null default 1;
-- 스트릭 프리즈 사용으로 채워진 날짜인지 표시 (연속 접속 유지용, 실제 방문은 아님)
alter table user_attendance add column if not exists is_freeze boolean not null default false;

-- 뱃지 정의: 관리자가 나중에 추가/수정할 수 있도록 데이터로 관리
create table if not exists badges (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  label text not null,
  description text,
  icon text not null default '🏅',
  streak_threshold int not null,
  order_index int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into badges (code, label, description, icon, streak_threshold, order_index) values
  ('streak_3', '첫 발걸음', '3일 연속 접속 달성', '🔥', 3, 1),
  ('streak_7', '일주일 개근', '7일 연속 접속 달성', '⭐', 7, 2),
  ('streak_30', '한 달의 약속', '30일 연속 접속 달성', '🏆', 30, 3),
  ('streak_100', '백일의 기적', '100일 연속 접속 달성', '👑', 100, 4)
on conflict (code) do nothing;

-- 사용자별 뱃지 획득 기록
create table if not exists user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  badge_id uuid references badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

alter table badges enable row level security;
alter table user_badges enable row level security;

drop policy if exists "badges_read_all" on badges;
create policy "badges_read_all" on badges for select using (true);
drop policy if exists "badges_write_admin" on badges;
create policy "badges_write_admin" on badges for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "user_badges_select_self_or_admin" on user_badges;
create policy "user_badges_select_self_or_admin" on user_badges for select
  using (auth.uid() = user_id or is_admin());
drop policy if exists "user_badges_insert_self" on user_badges;
create policy "user_badges_insert_self" on user_badges for insert
  with check (auth.uid() = user_id);
drop policy if exists "user_badges_delete_admin" on user_badges;
create policy "user_badges_delete_admin" on user_badges for delete using (is_admin());

do $$
declare
  t text;
begin
  foreach t in array array['badges','user_badges'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 기능: 구성원 관리에서 로그인 계정 선택(연동)
-- ------------------------------------------------------------
-- 구성원 관리(/admin/members)에서 조직 구성원을 실제 로그인 계정과 연결할 때
-- 계정 목록(이름/이메일)을 검색할 수 있어야 하는데, 기존 profiles select 정책은
-- 본인 또는 admin/superadmin만 전체 열람이 가능해 editor는 자기 자신만 보였다.
-- editor 이상도 계정을 검색/연동할 수 있도록 select 정책을 하나 추가한다.
drop policy if exists "profiles_select_editor_or_above" on profiles;
create policy "profiles_select_editor_or_above" on profiles for select
  using (is_editor_or_above());

-- ------------------------------------------------------------
-- 기능: 뱃지 수동 부여
-- ------------------------------------------------------------
-- 지금까지 뱃지는 연속 접속일수(streak_threshold)를 넘기면 자동으로만 지급됐다.
-- award_type을 추가해 '자동(연속 접속)' 외에 '수동(관리자가 달성을 직접 확인하고 부여)'
-- 조건도 관리자가 선택할 수 있게 한다. 수동 뱃지는 streak_threshold가 필요 없으므로
-- not null 제약을 풀어준다.
alter table badges add column if not exists award_type text not null default 'auto' check (award_type in ('auto','manual'));
alter table badges alter column streak_threshold drop not null;

-- 관리자가 특정 학생에게 뱃지를 직접 부여할 때 사용 (user_badges_insert_self는
-- 본인 것만 insert 가능해서, 다른 사람에게 부여하려면 editor 이상 전용 정책이 필요함)
drop policy if exists "user_badges_insert_staff" on user_badges;
create policy "user_badges_insert_staff" on user_badges for insert
  with check (is_editor_or_above());

-- ------------------------------------------------------------
-- 기능: 알림 표시 시간 선택 + 발송 이력 삭제
-- ------------------------------------------------------------
-- null이면 기존과 동일하게 학생이 직접 닫기 전까지 계속 표시.
alter table notifications add column if not exists duration_minutes int;

-- 지금까지 notifications는 insert 정책만 있어서 관리자가 발송 이력을 지울 수 없었다.
drop policy if exists "notifications_delete_admin" on notifications;
create policy "notifications_delete_admin" on notifications for delete using (is_editor_or_above());

-- ------------------------------------------------------------
-- 기능: 접속 기록에 이름 표시용 뷰
-- ------------------------------------------------------------
-- user_attendance에는 user_id(uuid)만 있어서 Supabase 테이블 편집기에서 보면 누구 기록인지
-- 알 수 없다. profiles와 조인한 뷰를 만들어 이름/이메일이 함께 보이게 한다.
-- security_invoker = true로 만들어서, 뷰를 조회하는 사람의 RLS가 그대로 적용된다
-- (학생 본인은 자기 기록만, admin/superadmin은 전체가 보임 — 원본 테이블의 RLS와 동일).
--
-- visit_date는 날짜만 저장해서(시간 없음) 같은 날 여러 명이 체크인하면 정렬 순서가
-- 보장되지 않는다. 실제 체크인 시각(created_at)을 남겨서 최신순 정렬에 쓴다.
-- (기존 행은 이 컬럼을 추가하는 시점의 now()로 채워져 정확한 과거 시각은 아니다)
alter table user_attendance add column if not exists created_at timestamptz not null default now();

create or replace view user_attendance_with_name
with (security_invoker = true) as
select
  ua.id,
  ua.user_id,
  p.name,
  p.nickname,
  p.email,
  ua.visit_date,
  ua.streak_count,
  ua.is_freeze,
  ua.created_at
from user_attendance ua
join profiles p on p.id = ua.user_id
order by ua.created_at desc;

-- ------------------------------------------------------------
-- 기능: 시크릿 뱃지
-- ------------------------------------------------------------
-- is_active(지급 가능 여부)와는 별개로, is_secret은 "학생이 획득하기 전까지
-- 뱃지 목록에 아예 안 보이는지"만 제어한다. 획득하는 순간 정상적으로 드러난다.
alter table badges add column if not exists is_secret boolean not null default false;

-- ------------------------------------------------------------
-- 기능: teacher 역할 추가
-- ------------------------------------------------------------
-- 지금은 student와 권한이 완전히 동일하다(is_admin/is_editor_or_above 둘 다
-- teacher를 포함하지 않음). 나중에 선생님 전용 기능을 추가할 때 구분하기 위한
-- 역할이다. role 컬럼의 CHECK 제약에 'teacher'를 추가하는 부분은 바로 아래
-- "기능: sub_editor 역할 추가" 블록에서 한 번에 처리한다(둘을 따로 나누면, 전체
-- 파일을 처음부터 재실행할 때 이미 sub_editor role을 가진 행이 있는 상태에서
-- 'teacher'만 포함하고 'sub_editor'는 빠진 제약이 일시적으로 걸려 실패한다).

-- ------------------------------------------------------------
-- 기능 5. 공지사항 노출 방식 선택 (배너 / 팝업)
-- ------------------------------------------------------------
-- banner: 기존처럼 상단에 작게 표시(닫기 전까지 유지, duration_minutes로 자동 만료 가능).
-- popup: 페이지 진입 시 모달로 표시되어 학생이 확인/닫기(또는 "오늘 하루 안 보기")를
-- 눌러야 사라진다. duration_minutes는 popup에는 적용하지 않는다(관리자 화면에서 숨김).
alter table notifications add column if not exists display_type text not null default 'banner'
  check (display_type in ('banner','popup'));

-- 팝업 "중지": 발송 기록(감사용)은 남기고 더 이상 뜨지 않게만 막는다.
-- (기록 자체를 지우고 싶으면 기존 delete 정책으로 행을 삭제하면 된다)
alter table notifications add column if not exists popup_active boolean not null default true;

-- 지금까지 notifications는 update 정책이 없어서 "팝업 중지"를 저장할 수 없었다.
drop policy if exists "notifications_update_admin" on notifications;
create policy "notifications_update_admin" on notifications for update using (is_editor_or_above());

-- ------------------------------------------------------------
-- 기능: 알림/공지사항 삭제 권한을 admin 이상으로 강화
-- ------------------------------------------------------------
-- 발송 기록(누가 언제 보냈는지) 자체를 지우는 건 감사 목적상 admin 이상만 하도록 한다.
-- "사라지게" 하는 동작(알림은 팝업 중지, 공지/뉴스는 임시저장으로 전환)은 계속 editor도 가능.
-- 정책 이름은 그대로 두되(이미 "_admin"이라는 이름이었음) 실제로 is_admin()만 통과하게 좁힌다.
drop policy if exists "notifications_delete_admin" on notifications;
create policy "notifications_delete_admin" on notifications for delete using (is_admin());

drop policy if exists "posts_write_admin" on posts;
drop policy if exists "posts_insert_editor" on posts;
create policy "posts_insert_editor" on posts for insert with check (is_editor_or_above());
drop policy if exists "posts_update_editor" on posts;
create policy "posts_update_editor" on posts for update using (is_editor_or_above()) with check (is_editor_or_above());
drop policy if exists "posts_delete_admin" on posts;
create policy "posts_delete_admin" on posts for delete using (is_admin());

-- ------------------------------------------------------------
-- 기능: sub_editor 역할 추가
-- ------------------------------------------------------------
-- editor는 부장(동아리/학생회 부서장)용, sub_editor는 부원 전용 역할로 구분해서 만든다.
-- 지금은 is_admin()/is_editor_or_above() 둘 다 sub_editor를 포함하지 않아 student/teacher와
-- 권한이 동일하다(즉 /admin 접근 불가). 어떤 권한을 줄지는 나중에 정해서 반영한다.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('student','teacher','sub_editor','editor','admin','superadmin'));

-- ------------------------------------------------------------
-- 기능: Q&A 작성자 공개 범위 선택
-- ------------------------------------------------------------
-- 질문 등록 시 작성자가 "모두에게 공개"를 선택하면 그 시점의 표시 이름을
-- author_display_name에 저장해서 공개 목록에 그대로 보여준다(null이면 "익명").
-- 관리자(admin 이상)는 이 값과 무관하게 profiles를 조인해 실제 작성자를 항상 볼 수 있다.
alter table questions add column if not exists author_display_name text;

-- 비공개 질문은 무조건 작성자 이름이 공개되지 않도록(=admin만 열람) DB 단에서 강제한다.
-- (클라이언트가 실수로/의도적으로 author_display_name을 채워 보내도 무시됨)
create or replace function enforce_qna_author_visibility()
returns trigger as $$
begin
  if new.is_private then
    new.author_display_name := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists before_question_write on questions;
create trigger before_question_write
  before insert or update on questions
  for each row execute procedure enforce_qna_author_visibility();

-- ------------------------------------------------------------
-- 기능: Q&A 답변을 editor 이상도 가능하게 확대
-- ------------------------------------------------------------
-- 원래 답변 작성/질문 상태 변경(답변완료 처리)이 admin 전용이었는데 editor도 가능하게 넓힌다.
-- (비공개 질문은 questions_read 정책상 editor에게 애초에 안 보이므로, 자연히 공개 질문만 답변 가능)
drop policy if exists "answers_write_admin" on answers;
create policy "answers_write_admin" on answers for insert with check (is_editor_or_above());

-- answers는 지금까지 update 정책 자체가 없어서, 이미 등록한 답변을 수정하는 게 admin조차
-- 불가능했다(신규 insert만 가능). update 정책을 추가해서 답변 수정도 가능하게 한다.
drop policy if exists "answers_update_editor" on answers;
create policy "answers_update_editor" on answers for update using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "questions_update_admin" on questions;
create policy "questions_update_admin" on questions for update using (is_editor_or_above());

-- ------------------------------------------------------------
-- 기능: Q&A 질문 삭제 (작성자 본인 + admin 이상)
-- ------------------------------------------------------------
-- 지금까지 questions에 delete 정책이 아예 없어서 아무도 질문을 지울 수 없었다.
-- 답변(answers)은 question_id에 on delete cascade가 걸려 있어 질문 삭제 시 같이 지워진다.
drop policy if exists "questions_delete_own" on questions;
create policy "questions_delete_own" on questions for delete using (auth.uid() = user_id);
drop policy if exists "questions_delete_admin" on questions;
create policy "questions_delete_admin" on questions for delete using (is_admin());

-- ------------------------------------------------------------
-- 기능: 조직 활동 (안건함 / 조직별 일정 / 조직별 활동기록)
-- ------------------------------------------------------------
-- reference-source/(Netlify+Drizzle 학생회 툴)의 기능만 참고해서 이 프로젝트 컨벤션대로
-- 새로 설계했다. departmentId 대신 기존 organizations.id를 그대로 쓴다.

-- 안건함: 학생 누구나 제안, 로그인한 학생 누구나 찬반 투표(중복 불가), 상태는 editor 이상이 변경.
create table if not exists proposals (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  summary text not null,
  author_id uuid references profiles(id) on delete set null,
  status text not null default 'review' check (status in ('review','approved','rejected','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 찬반 투표 기록: user_id + proposal_id 유니크로 중복 투표를 DB 단에서 막는다.
-- 찬성/반대 집계는 별도 카운터 컬럼 없이 이 테이블을 그때그때 집계해서 보여준다.
create table if not exists proposal_votes (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  vote text not null check (vote in ('yes','no')),
  created_at timestamptz not null default now(),
  unique (proposal_id, user_id)
);

-- 조직별 일정: 기존 학사일정(events)과는 별개로 부서 내부 회의/행사용.
create table if not exists org_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  location text,
  category text not null default 'meeting' check (category in ('meeting','event','deadline','general')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 조직별 활동기록: 기존 posts(공지/뉴스)와는 별개로 조직 단위 공지/활동/회의록 기록용.
create table if not exists org_records (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  category text not null check (category in ('notice','activity','minutes')),
  title text not null,
  content text not null,
  author_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table proposals enable row level security;
alter table proposal_votes enable row level security;
alter table org_events enable row level security;
alter table org_records enable row level security;

-- 안건함: 전체 공개 열람(사이트 전반의 공개 콘텐츠 톤과 통일), 로그인 학생 누구나 제안 가능,
-- 상태 변경은 editor 이상, 삭제는 admin 이상(다른 콘텐츠 삭제 권한 강화 정책과 통일).
drop policy if exists "proposals_read_all" on proposals;
create policy "proposals_read_all" on proposals for select using (true);
drop policy if exists "proposals_insert_own" on proposals;
create policy "proposals_insert_own" on proposals for insert with check (auth.uid() = author_id);
drop policy if exists "proposals_update_editor" on proposals;
create policy "proposals_update_editor" on proposals for update using (is_editor_or_above());
drop policy if exists "proposals_delete_admin" on proposals;
create policy "proposals_delete_admin" on proposals for delete using (is_admin());

-- 투표: 집계를 위해 전체 공개 열람, 투표/취소/변경은 본인 것만.
drop policy if exists "proposal_votes_read_all" on proposal_votes;
create policy "proposal_votes_read_all" on proposal_votes for select using (true);
drop policy if exists "proposal_votes_insert_own" on proposal_votes;
create policy "proposal_votes_insert_own" on proposal_votes for insert with check (auth.uid() = user_id);
drop policy if exists "proposal_votes_update_own" on proposal_votes;
create policy "proposal_votes_update_own" on proposal_votes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "proposal_votes_delete_own" on proposal_votes;
create policy "proposal_votes_delete_own" on proposal_votes for delete using (auth.uid() = user_id);

-- 조직별 일정/활동기록: 전체 공개 열람(다른 콘텐츠와 동일), 작성/수정/삭제는 editor 이상.
drop policy if exists "org_events_read_all" on org_events;
create policy "org_events_read_all" on org_events for select using (true);
drop policy if exists "org_events_write_editor" on org_events;
create policy "org_events_write_editor" on org_events for all using (is_editor_or_above()) with check (is_editor_or_above());

drop policy if exists "org_records_read_all" on org_records;
create policy "org_records_read_all" on org_records for select using (true);
drop policy if exists "org_records_write_editor" on org_records;
create policy "org_records_write_editor" on org_records for all using (is_editor_or_above()) with check (is_editor_or_above());

do $$
declare
  t text;
begin
  foreach t in array array['proposals','proposal_votes','org_events','org_records'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 20. 사이트 잠금(점검) 모드
-- ------------------------------------------------------------
-- 켜져 있으면 admin/superadmin을 제외한 모든 사용자(비로그인 포함)가 /maintenance로
-- 리다이렉트된다. 날짜 하드코딩 대신 admin이 언제든 껐다 켤 수 있는 설정 값으로 만들었다.
create table if not exists site_settings (
  id text primary key default 'default',
  maintenance_mode boolean not null default false,
  maintenance_message text not null default '현재 사이트를 점검 중입니다. 관리자 계정으로만 이용할 수 있습니다.',
  maintenance_until date,
  updated_at timestamptz not null default now()
);

insert into site_settings (id, maintenance_until) values ('default', '2026-09-01')
on conflict (id) do nothing;

alter table site_settings enable row level security;

-- 잠금 여부는 미들웨어가 비로그인 사용자로도 확인해야 하므로 전체 공개 열람.
drop policy if exists "site_settings_read_all" on site_settings;
create policy "site_settings_read_all" on site_settings for select using (true);
drop policy if exists "site_settings_update_admin" on site_settings;
create policy "site_settings_update_admin" on site_settings for update using (is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_settings'
  ) then
    alter publication supabase_realtime add table public.site_settings;
  end if;
end $$;

-- ------------------------------------------------------------
-- 21. 뱃지 날짜 조건 (특정 날짜 이전/이후/당일 로그인)
-- ------------------------------------------------------------
-- 기존에는 뱃지 지급 방식이 '자동(연속 접속일수)'과 '수동' 두 가지였다. 여기에 '날짜 조건'을
-- 추가해서, 특정 날짜를 기준으로 그 이전/이후/당일에 로그인(체크인)하면 자동 지급되는 뱃지를
-- 만들 수 있게 한다. date_condition/date_condition_value는 award_type='date'일 때만 쓰인다.
alter table badges add column if not exists date_condition text check (date_condition in ('before','after','on'));
alter table badges add column if not exists date_condition_value date;

alter table badges drop constraint if exists badges_award_type_check;
alter table badges add constraint badges_award_type_check check (award_type in ('auto','manual','date'));

-- ------------------------------------------------------------
-- 22. 뱃지 날짜 조건 - 기간(between) 추가
-- ------------------------------------------------------------
-- '이전/이후/당일'에 더해 '두 날짜 사이(양끝 포함)'에 로그인하면 지급되는 조건을 추가한다.
-- date_condition_value를 시작일로, date_condition_value_end를 종료일로 사용한다.
alter table badges add column if not exists date_condition_value_end date;

alter table badges drop constraint if exists badges_date_condition_check;
alter table badges add constraint badges_date_condition_check check (date_condition in ('before','after','on','between'));

-- ------------------------------------------------------------
-- 23. 뱃지 회수 실시간 반영을 위한 replica identity 설정
-- ------------------------------------------------------------
-- 기본 설정(replica identity default)에서는 realtime DELETE 이벤트의 old 레코드에
-- 기본키(id)만 담겨서 user_id/badge_id로 필터링하거나 어떤 뱃지가 회수됐는지 알 수 없다.
-- full로 바꿔서 삭제된 행 전체가 old 레코드에 담기게 한다.
alter table user_badges replica identity full;

-- ------------------------------------------------------------
-- 24. 놓친 뱃지 축하 팝업을 다음 접속 때 띄우기 위한 celebrated 플래그
-- ------------------------------------------------------------
-- 관리자가 뱃지를 부여한 순간 학생이 접속 중이 아니면 실시간 팝업을 받을 대상이 없어서
-- 그냥 조용히 지급되고 끝났다. celebrated=false인 뱃지는 다음에 학생이 접속할 때 발견해서
-- 축하 팝업을 띄우고 true로 바꾼다. 기본값은 false(신규 지급은 축하 대상)로 두되, 이 컬럼을
-- 처음 추가하는 시점에 이미 있던 행들은 소급 팝업이 뜨지 않도록 한 번만 true로 채운다
-- (재실행 시에는 컬럼이 이미 있어서 이 백필이 다시 실행되지 않는다).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'user_badges' and column_name = 'celebrated'
  ) then
    alter table user_badges add column celebrated boolean not null default false;
    update user_badges set celebrated = true;
  end if;
end $$;

-- ------------------------------------------------------------
-- 25. 학생 스스로 뱃지 축하 확인 처리(celebrated) 가능하게
-- ------------------------------------------------------------
-- user_badges에는 update 정책이 전혀 없어서, 학생이 축하 팝업을 확인해도 celebrated를
-- true로 바꾸는 요청이 RLS에 조용히 막혀 새로고침할 때마다 팝업이 계속 다시 떴다.
-- update 정책을 여는 대신, 본인 행의 celebrated만 true로 바꿀 수 있는 함수를 만들어
-- badge_id/earned_at 등 다른 값은 절대 못 바꾸게 한다.
create or replace function mark_badges_celebrated(target_badge_ids uuid[])
returns void as $$
begin
  update user_badges set celebrated = true
  where user_id = auth.uid() and badge_id = any(target_badge_ids);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function mark_badges_celebrated(uuid[]) to authenticated;

-- ------------------------------------------------------------
-- 26. 학교 구성원 명단(directory_members) + 로그인 제한
-- ------------------------------------------------------------
-- 실제 재학생/교사 명단을 DB에 두고, 이 명단(+is_allowed)에 없는 이메일은 로그인은 되어도
-- 사이트를 이용할 수 없게 만든다(미들웨어에서 검사). admin/superadmin은 명단과 무관하게
-- 항상 접근 가능해야 하므로(관리자가 스스로를 잠그는 걸 방지), 이 테이블만으로는 관리자를
-- 막을 수 없고 미들웨어 쪽에서 role을 먼저 확인해 우회시킨다.
-- member_type='other'는 명단에는 없지만 관리자가 "외부 계정 관리"에서 개별 승인한 계정용이다
-- (학생/교사 탭에는 노출되지 않도록 구성원 조회 페이지에서 student/teacher만 조회한다).
create table if not exists directory_members (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  member_type text not null check (member_type in ('student','teacher','other')),
  display_name text not null,
  grade text check (grade in ('10','11','12')),
  homeroom int check (homeroom in (1,2,3)),
  homeroom_label text,
  subject text,
  leadership_role text,
  is_allowed boolean not null default true,
  created_at timestamptz not null default now()
);

alter table directory_members enable row level security;

-- 구성원 조회 페이지(학생/교사 누구나)에서 쓰므로 로그인한 사용자면 전체 열람 가능.
drop policy if exists "directory_members_read_authenticated" on directory_members;
create policy "directory_members_read_authenticated" on directory_members for select
  using (auth.uid() is not null);
drop policy if exists "directory_members_write_admin" on directory_members;
create policy "directory_members_write_admin" on directory_members for all
  using (is_admin()) with check (is_admin());

-- 명단에 없는 이메일의 로그인 시도 기록. 같은 이메일이 pending 상태에서 여러 번 시도해도
-- row를 계속 쌓지 않고 attempted_at만 갱신하고, 이미 blocked/approved로 결정된 이메일은
-- 재시도해도 다시 pending으로 되돌리지 않는다(차단은 계속 차단 유지).
create table if not exists login_access_requests (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  attempted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','blocked')),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table login_access_requests enable row level security;

drop policy if exists "login_access_requests_read_admin" on login_access_requests;
create policy "login_access_requests_read_admin" on login_access_requests for select using (is_admin());
drop policy if exists "login_access_requests_update_admin" on login_access_requests;
create policy "login_access_requests_update_admin" on login_access_requests for update using (is_admin());

-- 명단에 없는 사용자가 로그인할 때마다 미들웨어가 이 함수를 호출해 시도를 기록한다.
-- RLS를 여는 대신 함수 안에서 auth.jwt()의 이메일만 사용해서 본인 이메일 row만 건드리게 한다
-- (mark_badges_celebrated와 동일한 패턴).
create or replace function record_login_access_attempt()
returns void as $$
declare
  my_email text := auth.jwt() ->> 'email';
begin
  if my_email is null then
    return;
  end if;
  update login_access_requests
    set attempted_at = now()
    where email = my_email and status = 'pending';
  if not found then
    insert into login_access_requests (email, status)
    select my_email, 'pending'
    where not exists (
      select 1 from login_access_requests where email = my_email and status in ('blocked','approved')
    );
  end if;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function record_login_access_attempt() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['directory_members','login_access_requests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 27. 외부 계정 체크인 제한 켜고 끄기
-- ------------------------------------------------------------
-- member_type='other'(명단 밖에서 개별 승인된 외부 계정)에게 연속 접속 체크인/뱃지 팝업을
-- 막는 기능을 관리자가 "외부 계정 관리" 화면에서 껐다 켤 수 있게 하는 설정값.
-- 기본값 true(제한함)로 두어 기존 동작을 그대로 유지한다.
alter table site_settings add column if not exists restrict_external_checkin boolean not null default true;

-- ------------------------------------------------------------
-- 28. 구성원 조회 - 다른 학생/교사 프로필 보기 (읽기 전용)
-- ------------------------------------------------------------
-- 구성원 조회(/members)에서 학생/교사를 클릭하면 그 사람의 마이페이지를 읽기 전용으로 볼 수
-- 있게 한다. profiles 테이블의 select 정책은 본인/관리자/editor 이상만 허용하므로(개인정보
-- 보호), 다른 사람이 서로의 이름/닉네임/사진/소개만 볼 수 있도록 별도 뷰를 만든다. 이 뷰는
-- security_invoker를 켜지 않아(기본값) profiles의 RLS를 우회하고, 뷰 자체에서 노출 컬럼과
-- 대상(학생/교사 명단에 있는 사람만)을 제한한다 — 이메일 외 role/freeze_credits 같은 민감한
-- 값은 아예 select 목록에 넣지 않아 API로 직접 조회해도 새어나가지 않는다.
create or replace view directory_profile_view as
select
  p.id,
  p.name,
  p.nickname,
  p.bio,
  p.profile_image,
  dm.email,
  dm.member_type,
  dm.display_name,
  dm.grade,
  dm.homeroom,
  dm.homeroom_label,
  dm.subject
from profiles p
join directory_members dm on dm.email = p.email
where dm.member_type in ('student','teacher');

grant select on directory_profile_view to authenticated;

-- 다른 사람의 뱃지도 함께 보여주기 위해, 조회 대상이 명단상 학생/교사면 그 사람의 user_badges를
-- 누구나(로그인 사용자) 볼 수 있게 select 정책을 하나 더 추가한다(비밀 뱃지도 "이미 획득한"
-- 상태로만 보여주는 것이라 노출에 문제 없음 — 아직 못 받은 시크릿 뱃지는 애초에 이 목록에 없음).
drop policy if exists "user_badges_select_public_directory" on user_badges;
create policy "user_badges_select_public_directory" on user_badges for select
  using (
    exists (
      select 1 from profiles p
      join directory_members dm on dm.email = p.email
      where p.id = user_badges.user_id and dm.member_type in ('student','teacher')
    )
  );

-- ------------------------------------------------------------
-- 29. 홈 화면/헤더/푸터 디자인 테마 (관리자 화면에서 superadmin만 전환)
-- ------------------------------------------------------------
-- 헤더/푸터/홈 화면의 색상·테두리·폰트 값(src/lib/homeTheme.ts의 homeThemeStyles 키)을
-- DB에 저장해두고, /admin/theme에서 superadmin이 바꾸면 모든 방문자 화면에 실시간 반영된다.
-- 별도 테이블로 둔 이유: site_settings는 이미 admin 이상 누구나 수정 가능한 정책이 걸려있어서,
-- 같은 테이블에 넣으면 그 정책 때문에 superadmin 전용으로 좁힐 수 없다(RLS 정책은 OR로
-- 합쳐지므로 컬럼 단위로 쓰기 권한을 나눌 수 없음).
create table if not exists site_theme (
  id text primary key default 'default',
  theme text not null default 'classic',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

insert into site_theme (id) values ('default') on conflict (id) do nothing;

alter table site_theme enable row level security;

-- 잠금 여부(site_settings)와 마찬가지로, 비로그인 사용자도 화면을 그려야 하므로 전체 공개 열람.
drop policy if exists "site_theme_read_all" on site_theme;
create policy "site_theme_read_all" on site_theme for select using (true);
drop policy if exists "site_theme_update_superadmin" on site_theme;
create policy "site_theme_update_superadmin" on site_theme for update using (is_superadmin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_theme'
  ) then
    alter publication supabase_realtime add table public.site_theme;
  end if;
end $$;

-- ------------------------------------------------------------
-- 30. 뉴스 회의록 동영상 첨부 (Google Drive 링크 / 직접 업로드)
-- ------------------------------------------------------------
-- posts(type='news') 작성 시 동영상을 하나 붙일 수 있게 한다. video_source로 두 가지 중
-- 하나를 고른다: 'drive'(구글 드라이브 공유 링크, 상세 페이지에서 iframe으로 임베드) 또는
-- 'upload'(Storage에 올린 파일, <video> 태그로 재생). video_path는 'upload'일 때만 채워지고
-- 나중에 교체/삭제 시 storage.objects에서 지우는 용도다. 공지(notice)에는 UI를 안 띄우므로
-- 항상 null로 남는다. 별도 not null 제약 없이 두 컬럼 다 nullable로 둬서(동영상 없음 = 둘 다
-- null) 기존 posts 데이터와 호환된다.
alter table posts add column if not exists video_source text check (video_source in ('drive','upload'));
alter table posts add column if not exists video_url text;
alter table posts add column if not exists video_path text;

-- ------------------------------------------------------------
-- 31. 접속 통계 화면 실시간 반영
-- ------------------------------------------------------------
-- /admin/stats의 "전체 접속 기록"은 지금까지 서버 컴포넌트에서 페이지 진입 시 한 번만
-- 조회했다(다른 관리 화면들과 달리 useRealtimeList를 쓰지 않음) — 그래서 관리자가 화면을
-- 열어둔 채로 있으면 그 이후에 생긴 체크인은 새로고침 전까지 전혀 보이지 않았다("특정 시각
-- 이후 일부 계정이 안 보인다"는 문의의 원인). user_attendance를 Realtime 발행 목록에
-- 추가해서 다른 관리 화면들과 동일하게 즉시 반영되도록 한다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_attendance'
  ) then
    alter publication supabase_realtime add table public.user_attendance;
  end if;
end $$;

-- ------------------------------------------------------------
-- 32. 연속 접속 상위 목록 중복 표시 수정
-- ------------------------------------------------------------
-- "연속 접속일수 상위 학생" 목록이 user_attendance 원본 테이블(날짜별로 행이 하나씩 쌓임)을
-- 그룹 없이 그대로 정렬해서, 같은 학생이 접속한 날짜 수만큼 서로 다른 streak_count 값으로
-- 여러 번 나타났다(예: 1일째 행과 2일째 행이 각각 "다른 사람"처럼 목록에 표시). 사용자별로
-- 가장 최근 접속일(=현재 연속 기록)의 streak_count만 남기는 뷰를 만들어 대체한다.
create or replace view user_latest_attendance
with (security_invoker = true) as
select distinct on (ua.user_id)
  ua.user_id, ua.streak_count, ua.visit_date, p.name, p.email
from user_attendance ua
join profiles p on p.id = ua.user_id
order by ua.user_id, ua.visit_date desc;

-- ------------------------------------------------------------
-- 33. 일정 등록자 이름 표시
-- ------------------------------------------------------------
-- profiles의 select RLS는 본인 것만 볼 수 있게 되어 있어서(profiles_select_self_or_admin),
-- 학생 화면(/calendar, /events/[id])에서 events.created_by를 profiles와 그대로 조인하면
-- 다른 사람이 등록한 일정은 이름이 보이지 않는다(RLS가 그 프로필 행을 가려버림). 그렇다고
-- profiles RLS를 통째로 완화하면 이메일 등 다른 개인정보까지 노출 범위가 넓어지므로,
-- "이름만" 안전하게 공개하는 뷰를 별도로 둔다. security_invoker를 지정하지 않으면(기본값
-- false) 뷰가 소유자 권한으로 실행되어 조회자의 profiles RLS와 무관하게 이름을 보여준다
-- (일정 등록자 이름은 공개돼도 괜찮은 정보라 이 방식을 의도적으로 선택함 — 반대로
-- user_attendance_with_name/user_latest_attendance는 개인별 접속 기록이라 security_invoker
-- = true로 반대 방향을 택했다).
create or replace view events_with_creator as
select e.*, coalesce(p.nickname, p.name) as creator_name
from events e
left join profiles p on p.id = e.created_by;

-- ------------------------------------------------------------
-- 34. 임원회/사법위원회 플래그
-- ------------------------------------------------------------
-- "학생회 임원회"·"사법위원회"는 아직 role/조직 체계에 정식으로 없어서(이슈 #21,
-- 9/1 회의에서 확정 예정), role 값에 끼워 넣는 대신(끼워 넣으면 코드 곳곳의
-- role.includes(...) 체크를 전부 다시 검토해야 함) role과 독립적인 boolean 플래그로
-- 둔다. admin/superadmin이 /admin/users에서 개별적으로 켜고 끌 수 있다.
alter table profiles add column if not exists is_council boolean not null default false;
alter table profiles add column if not exists is_judiciary boolean not null default false;

-- ------------------------------------------------------------
-- 35. sub_editor에게 "조직 활동 관리"(안건함/조직 일정/활동기록)만 권한 부여
-- ------------------------------------------------------------
-- sub_editor 역할은 처음 만들 때 권한을 아무것도 안 준 상태였다(이슈 #15). 이번에
-- "조직 활동 관리" 3개 화면(/admin/org-activities/*)만 sub_editor 이상이 쓸 수 있게
-- 범위를 좁혀서 처음으로 권한을 부여한다. is_editor_or_above()를 그대로 넓히면 이
-- 함수를 쓰는 다른 모든 테이블(posts/events/rules/notifications 등)까지 sub_editor에게
-- 열리므로, 이 3개 테이블 전용 함수를 따로 둔다.
create or replace function is_org_activities_manager()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('sub_editor','editor','admin','superadmin')
  );
$$ language sql stable security definer;

drop policy if exists "org_events_write_editor" on org_events;
create policy "org_events_write_editor" on org_events for all using (is_org_activities_manager()) with check (is_org_activities_manager());

drop policy if exists "org_records_write_editor" on org_records;
create policy "org_records_write_editor" on org_records for all using (is_org_activities_manager()) with check (is_org_activities_manager());

-- 안건 상태 변경(검토중/승인/반려/완료)만 sub_editor에게 열어준다. 삭제(admin 이상)와
-- 등록(로그인한 학생 본인)은 기존 정책 그대로 유지.
drop policy if exists "proposals_update_editor" on proposals;
create policy "proposals_update_editor" on proposals for update using (is_org_activities_manager());

-- ------------------------------------------------------------
-- 36. 관리자 활동 로그 (audit_logs) 자동 기록
-- ------------------------------------------------------------
-- audit_logs 테이블은 이미 있었지만(user_id/action/target_table/target_id/created_at)
-- 실제로 기록하는 곳이 어디에도 없어서 항상 비어 있었다. 클라이언트 코드 곳곳(관리자
-- 페이지마다 흩어진 수십 개의 supabase.insert/update/delete 호출)에 일일이 로그
-- 기록을 끼워 넣는 대신, DB 트리거로 주요 테이블에 자동 기록되게 한다 — 나중에 새로운
-- 저장 경로가 추가돼도(예: 새 관리 화면) 빠짐없이 기록되고, 클라이언트 코드를 신뢰하지
-- 않아도 된다(우회 불가능).
alter table audit_logs add column if not exists before_data jsonb;
alter table audit_logs add column if not exists after_data jsonb;

create index if not exists audit_logs_user_id_idx on audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);
create index if not exists audit_logs_target_table_idx on audit_logs(target_table);

create or replace function log_audit_event()
returns trigger as $$
begin
  insert into audit_logs (user_id, action, target_table, target_id, before_data, after_data)
  values (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    (case when TG_OP = 'DELETE' then old.id else new.id end)::text,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- 공지/뉴스, 일정, 조직, 구성원, 규정, Q&A 답변은 작성/수정/삭제를 전부 기록한다.
drop trigger if exists audit_posts on posts;
create trigger audit_posts after insert or update or delete on posts
  for each row execute function log_audit_event();

drop trigger if exists audit_events on events;
create trigger audit_events after insert or update or delete on events
  for each row execute function log_audit_event();

drop trigger if exists audit_organizations on organizations;
create trigger audit_organizations after insert or update or delete on organizations
  for each row execute function log_audit_event();

drop trigger if exists audit_members on members;
create trigger audit_members after insert or update or delete on members
  for each row execute function log_audit_event();

drop trigger if exists audit_rules on rules;
create trigger audit_rules after insert or update or delete on rules
  for each row execute function log_audit_event();

drop trigger if exists audit_answers on answers;
create trigger audit_answers after insert or update or delete on answers
  for each row execute function log_audit_event();

-- profiles는 닉네임/소개 등 학생 본인이 수시로 바꾸는 필드가 많아서 전체를 다 기록하면
-- 로그가 그 잡음으로 뒤덮인다. role(권한) 변경만 기록한다.
drop trigger if exists audit_profiles_role on profiles;
create trigger audit_profiles_role after update on profiles
  for each row
  when (old.role is distinct from new.role)
  execute function log_audit_event();

-- 외부 계정 관리: 명단 등록/허용 상태 변경, 요청 승인·차단 처리(pending↔approved/blocked).
drop trigger if exists audit_directory_members on directory_members;
create trigger audit_directory_members after insert or update on directory_members
  for each row execute function log_audit_event();

-- insert(최초 차단 시도 기록)는 시스템이 자동으로 남기는 것이라 "관리자 행위"가
-- 아니므로 제외하고, update(관리자의 승인/차단/되돌리기 결정)만 기록한다.
drop trigger if exists audit_login_access_requests on login_access_requests;
create trigger audit_login_access_requests after update on login_access_requests
  for each row execute function log_audit_event();

-- 뱃지 지급(insert)/회수(delete).
drop trigger if exists audit_user_badges on user_badges;
create trigger audit_user_badges after insert or delete on user_badges
  for each row execute function log_audit_event();

-- 안건 상태 변경(검토중/승인/반려/완료)만 기록.
drop trigger if exists audit_proposals_status on proposals;
create trigger audit_proposals_status after update on proposals
  for each row
  when (old.status is distinct from new.status)
  execute function log_audit_event();

drop trigger if exists audit_org_events on org_events;
create trigger audit_org_events after insert or update or delete on org_events
  for each row execute function log_audit_event();

drop trigger if exists audit_org_records on org_records;
create trigger audit_org_records after insert or update or delete on org_records
  for each row execute function log_audit_event();

-- 사이트 잠금(점검 모드) on/off만 기록.
drop trigger if exists audit_site_settings_maintenance on site_settings;
create trigger audit_site_settings_maintenance after update on site_settings
  for each row
  when (old.maintenance_mode is distinct from new.maintenance_mode)
  execute function log_audit_event();

-- 조회는 superadmin만(기존엔 admin도 가능했음 — 이 로그는 /admin/activity-logs 전용이라
-- superadmin 전용으로 좁힌다). 쓰기는 log_audit_event()가 SECURITY DEFINER로 RLS를
-- 우회해서 넣는 것 외에는 막는다(클라이언트가 직접 가짜 로그를 끼워넣지 못하게).
drop policy if exists "audit_logs_admin_read" on audit_logs;
create policy "audit_logs_superadmin_read" on audit_logs for select using (is_superadmin());
drop policy if exists "audit_logs_insert_admin" on audit_logs;

-- ------------------------------------------------------------
-- 37. 선생님 공지사항 (교과 공지 / 학급 공지)
-- ------------------------------------------------------------
-- "교과" 공지 대상 판단에 필요한 학생별 수강 과목 데이터는 아직 없다. 나중에 실제
-- 데이터를 채워 넣을 예정이라 지금은 구조만 만들어두고 비워둔다 — 데이터가 없으면
-- 자연히 아무 학생에게도 교과 공지가 안 보이는 상태가 되는 것도 의도된 정상 동작이다.
create table if not exists student_subjects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  created_at timestamptz not null default now(),
  unique (user_id, subject)
);
alter table student_subjects enable row level security;

drop policy if exists "student_subjects_read_own_or_staff" on student_subjects;
create policy "student_subjects_read_own_or_staff" on student_subjects for select
  using (auth.uid() = user_id or is_editor_or_above());
drop policy if exists "student_subjects_write_staff" on student_subjects;
create policy "student_subjects_write_staff" on student_subjects for all
  using (is_editor_or_above()) with check (is_editor_or_above());

-- "학급" 공지는 이미 있는 directory_members.homeroom(담임 학급)으로 바로 판단 가능해서
-- 완전히 구현한다 — 교사 본인의 homeroom과 일치하는 학생만 대상이 된다. 다만 지금
-- directory_members에는 어떤 teacher 행에도 homeroom이 채워져 있지 않아서(담임 배정
-- 데이터 자체가 아직 없음), student_subjects와 마찬가지로 데이터가 채워지기 전까지는
-- 학급 공지도 실제로 노출되는 대상이 없는 상태다 — 이 역시 정상이다.
alter table posts drop constraint if exists posts_type_check;
alter table posts add constraint posts_type_check
  check (type in ('notice','news','subject_notice','homeroom_notice'));

alter table posts add column if not exists target_subject text;
alter table posts add column if not exists target_homeroom int;

-- teacher 및 그 이상 역할(관리 목적 열람용)
create or replace function is_teacher_or_editor_above()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('teacher','editor','admin','superadmin')
  );
$$ language sql stable security definer;

-- teacher 본인이 directory_members에 등록된 담당 과목 중 하나인지(콤마로 여러 개 저장돼
-- 있을 수 있어 분리해서 비교), 담당 학급(homeroom)과 일치하는지 확인하는 헬퍼. 클라이언트
-- UI에서 본인 담당 과목/학급만 고르게 하는 것과 별개로, 서버(RLS)에서도 위조를 막는다.
create or replace function teacher_owns_subject(p_user_id uuid, p_subject text)
returns boolean as $$
  select exists (
    select 1
    from directory_members dm
    join profiles p on p.email = dm.email
    where p.id = p_user_id
      and dm.member_type = 'teacher'
      and p_subject = any (
        select trim(s) from unnest(string_to_array(coalesce(dm.subject, ''), ',')) as s
      )
  );
$$ language sql stable security definer;

create or replace function teacher_owns_homeroom(p_user_id uuid, p_homeroom int)
returns boolean as $$
  select exists (
    select 1
    from directory_members dm
    join profiles p on p.email = dm.email
    where p.id = p_user_id
      and dm.member_type = 'teacher'
      and dm.homeroom = p_homeroom
  );
$$ language sql stable security definer;

-- 일반 공지/뉴스는 기존처럼 공개 열람(교과/학급 공지는 이 정책에서 제외하고 아래
-- 전용 정책으로 대상만 볼 수 있게 분리한다).
drop policy if exists "posts_read_published" on posts;
create policy "posts_read_published" on posts for select
  using (
    type in ('notice','news')
    and (status = 'published' or is_editor_or_above())
  );

-- 교과 공지: student_subjects에 해당 과목이 있는 학생만(또는 teacher 이상은 관리 목적으로 전부)
drop policy if exists "posts_read_subject_notice" on posts;
create policy "posts_read_subject_notice" on posts for select
  using (
    type = 'subject_notice'
    and (
      is_teacher_or_editor_above()
      or (
        status = 'published'
        and exists (
          select 1 from student_subjects ss
          where ss.user_id = auth.uid() and ss.subject = posts.target_subject
        )
      )
    )
  );

-- 학급 공지: 본인 homeroom이 일치하는 학생만(또는 teacher 이상은 관리 목적으로 전부)
drop policy if exists "posts_read_homeroom_notice" on posts;
create policy "posts_read_homeroom_notice" on posts for select
  using (
    type = 'homeroom_notice'
    and (
      is_teacher_or_editor_above()
      or (
        status = 'published'
        and exists (
          select 1 from directory_members dm
          join profiles p on p.email = dm.email
          where p.id = auth.uid() and dm.homeroom = posts.target_homeroom
        )
      )
    )
  );

-- 일반 공지/뉴스는 기존처럼 editor 이상만(교과/학급 공지는 이 정책에서 제외). 이렇게
-- 완전히 분리해야 일반 공지 작성 권한이 있는 사람이 교과/학급 공지를 쓰거나, 반대로
-- teacher가 일반 공지를 쓰는 일이 없다.
drop policy if exists "posts_insert_editor" on posts;
create policy "posts_insert_editor" on posts for insert
  with check (type in ('notice','news') and is_editor_or_above());

-- 교과/학급 공지는 teacher 전용, 그리고 본인이 실제로 담당하는 과목/학급인지 서버에서도 검증.
drop policy if exists "posts_insert_teacher_notice" on posts;
create policy "posts_insert_teacher_notice" on posts for insert
  with check (
    author_id = auth.uid()
    and (
      (type = 'subject_notice' and teacher_owns_subject(auth.uid(), target_subject))
      or (type = 'homeroom_notice' and teacher_owns_homeroom(auth.uid(), target_homeroom))
    )
  );

-- teacher는 본인이 작성한 교과/학급 공지만 수정 가능(editor 이상은 기존 posts_update_editor로
-- 모든 글을 계속 수정 가능, 삭제는 기존처럼 admin 이상만 — posts_delete_admin 그대로 유지).
drop policy if exists "posts_update_teacher_own" on posts;
create policy "posts_update_teacher_own" on posts for update
  using (author_id = auth.uid() and type in ('subject_notice','homeroom_notice'))
  with check (author_id = auth.uid() and type in ('subject_notice','homeroom_notice'));

-- ------------------------------------------------------------
-- 38. 공지 조회수 중복 증가 방지
-- ------------------------------------------------------------
-- 공지 상세 페이지가 새로고침할 때마다 조회수를 무조건 1씩 올리고 있었다(중복 방지 없음).
-- posts UPDATE는 RLS상 editor 이상(또는 작성자 teacher)만 가능해서 실제로는 admin/editor가
-- 자기 화면을 새로고침할 때만 반영됐고, 정작 학생·익명 방문자의 조회는 RLS에 막혀 애초에
-- 반영되지 않고 있었다(관리자가 본인 글을 확인할 때마다 카운트가 눈에 띄게 튀어 보인 이유).
-- 조회수만 안전하게 올릴 수 있는 전용 RPC를 만들어 누구나(익명 포함) 호출 가능하게 하고,
-- 클라이언트에서 쿠키로 중복 호출을 막는다(같은 브라우저로 하루 안에 새로고침해도 한 번만 카운트).
create or replace function increment_post_view_count(target_id uuid)
returns void as $$
  update posts set view_count = view_count + 1 where id = target_id;
$$ language sql security definer;

-- ------------------------------------------------------------
-- 39. 활동 로그: 조회수 갱신을 "수정"으로 잘못 기록하던 버그 수정
-- ------------------------------------------------------------
-- audit_posts 트리거가 insert/update/delete를 전부 감시하는데, view_count만 바뀐 UPDATE
-- (=누군가 글을 조회만 한 것)도 "수정" 행위로 기록되고 있었다. INSERT 트리거의 WHEN
-- 절에서는 OLD를 참조할 수 없어(Postgres 제약) insert/update/delete를 별도 트리거로
-- 분리하고, update 트리거에만 view_count를 제외한 나머지 컬럼이 실제로 달라졌을 때만
-- 기록하는 조건을 건다.
drop trigger if exists audit_posts on posts;
create trigger audit_posts_insert after insert on posts
  for each row execute function log_audit_event();
create trigger audit_posts_update after update on posts
  for each row
  when ((to_jsonb(OLD) - 'view_count') is distinct from (to_jsonb(NEW) - 'view_count'))
  execute function log_audit_event();
create trigger audit_posts_delete after delete on posts
  for each row execute function log_audit_event();

-- ------------------------------------------------------------
-- 40. 기능 단위 활성화 스위치 (feature flags)
-- ------------------------------------------------------------
-- Q&A/게시판처럼 메뉴 전체를 통째로 켜고 끄는 스위치. site_settings에 넣지 않는 이유는
-- site_theme과 동일하다 — site_settings는 이미 admin 이상 누구나 수정 가능한 정책이
-- 걸려있어서, 같은 테이블에 넣으면 그 정책 때문에 superadmin 전용으로 좁힐 수 없다
-- (RLS 정책은 OR로 합쳐지므로 컬럼 단위로 쓰기 권한을 나눌 수 없음).
create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

insert into feature_flags (key) values ('qna') on conflict (key) do nothing;
insert into feature_flags (key) values ('board') on conflict (key) do nothing;

alter table feature_flags enable row level security;

-- 학생 화면에서 메뉴 노출 여부를 판단해야 하므로 비로그인 포함 전체 공개 열람.
drop policy if exists "feature_flags_read_all" on feature_flags;
create policy "feature_flags_read_all" on feature_flags for select using (true);
drop policy if exists "feature_flags_write_superadmin" on feature_flags;
create policy "feature_flags_write_superadmin" on feature_flags for update using (is_superadmin());

-- ------------------------------------------------------------
-- 41. 게시판 (댓글/대댓글)
-- ------------------------------------------------------------
-- Q&A(questions/answers)는 이미 운영 중인 별도 테이블이라 마이그레이션하지 않고 그대로
-- 둔다(사용자 결정: 테이블은 분리 유지, 검색/알림/숨김 등 기능적 통합만 진행). 게시판은
-- 완전히 새 기능이라 새 테이블로 만든다.
create table if not exists board_posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  content text not null,
  view_count int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- parent_id가 있으면 대댓글(다른 댓글에 대한 답글), 없으면 게시글에 바로 달린 최상위 댓글.
create table if not exists board_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references board_posts(id) on delete cascade,
  parent_id uuid references board_comments(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists board_comments_post_id_idx on board_comments(post_id);

alter table board_posts enable row level security;
alter table board_comments enable row level security;

-- 숨김 처리된 글은 작성자 본인과 editor 이상에게만 보인다(관리자 화면에서는 계속 확인 가능).
drop policy if exists "board_posts_read" on board_posts;
create policy "board_posts_read" on board_posts for select
  using (not is_hidden or is_editor_or_above() or auth.uid() = author_id);

drop policy if exists "board_posts_insert_own" on board_posts;
create policy "board_posts_insert_own" on board_posts for insert with check (auth.uid() = author_id);

-- 본인은 내용 수정, editor 이상은 숨김 처리 등 관리 목적으로 수정 가능.
drop policy if exists "board_posts_update_own_or_staff" on board_posts;
create policy "board_posts_update_own_or_staff" on board_posts for update
  using (auth.uid() = author_id or is_editor_or_above());

-- 삭제는 본인 또는 admin 이상만(다른 콘텐츠 타입과 동일한 기준).
drop policy if exists "board_posts_delete_own_or_admin" on board_posts;
create policy "board_posts_delete_own_or_admin" on board_posts for delete
  using (auth.uid() = author_id or is_admin());

-- 댓글은 자기 글 자체의 RLS가 없으므로, 소속된 게시글이 숨김 상태인지를 그대로 따른다
-- (게시글이 숨겨지면 댓글도 함께 안 보여야 자연스럽다).
drop policy if exists "board_comments_read" on board_comments;
create policy "board_comments_read" on board_comments for select
  using (
    exists (
      select 1 from board_posts bp
      where bp.id = board_comments.post_id
        and (not bp.is_hidden or is_editor_or_above() or auth.uid() = bp.author_id)
    )
  );

drop policy if exists "board_comments_insert_own" on board_comments;
create policy "board_comments_insert_own" on board_comments for insert with check (auth.uid() = author_id);

drop policy if exists "board_comments_delete_own_or_admin" on board_comments;
create policy "board_comments_delete_own_or_admin" on board_comments for delete
  using (auth.uid() = author_id or is_admin());

-- 조회수는 공지사항과 동일한 방식(RPC + 클라이언트 쿠키 중복 방지)을 우선 적용한다.
-- 이후 이슈([6] 조회수 시스템 배치 집계 통일)에서 공지사항과 함께 공용 방식으로 교체될 예정.
create or replace function increment_board_view_count(target_id uuid)
returns void as $$
  update board_posts set view_count = view_count + 1 where id = target_id;
$$ language sql security definer;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_posts'
  ) then
    alter publication supabase_realtime add table public.board_posts;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_comments'
  ) then
    alter publication supabase_realtime add table public.board_comments;
  end if;
end $$;

-- 활동 로그: posts와 동일하게 view_count만 바뀐 update는 기록하지 않는다.
drop trigger if exists audit_board_posts_insert on board_posts;
create trigger audit_board_posts_insert after insert on board_posts
  for each row execute function log_audit_event();
drop trigger if exists audit_board_posts_update on board_posts;
create trigger audit_board_posts_update after update on board_posts
  for each row
  when ((to_jsonb(OLD) - 'view_count') is distinct from (to_jsonb(NEW) - 'view_count'))
  execute function log_audit_event();
drop trigger if exists audit_board_posts_delete on board_posts;
create trigger audit_board_posts_delete after delete on board_posts
  for each row execute function log_audit_event();

-- ------------------------------------------------------------
-- 42. 게시글/댓글 도배 방지
-- ------------------------------------------------------------
-- 시간당 최대 작성 수 + 연속 작성 쿨다운을 트리거로 강제한다(클라이언트 검증만으로는
-- API를 직접 호출해 우회할 수 있어서 서버 단에서 막는다). 제한값은 트리거를 붙일 때
-- 인자로 넘겨서(TG_ARGV) 테이블마다 다르게 두고, 나중에 값만 바꾸고 싶으면 아래
-- create trigger 문의 숫자만 고쳐서 다시 실행하면 된다 — 함수 자체는 건드릴 필요 없음.
-- 작성자 컬럼명이 테이블마다 다르므로(board는 author_id, questions는 user_id) 세 번째
-- 인자로 받아 동적으로 처리한다.
create or replace function enforce_rate_limit()
returns trigger as $$
declare
  v_cooldown_seconds int := TG_ARGV[0]::int;
  v_max_per_hour int := TG_ARGV[1]::int;
  v_author_col text := TG_ARGV[2];
  v_last_at timestamptz;
  v_count_last_hour int;
  v_author uuid;
begin
  execute format('select ($1).%I', v_author_col) using NEW into v_author;
  if v_author is null then
    return NEW;
  end if;

  execute format('select max(created_at) from %I where %I = $1', TG_TABLE_NAME, v_author_col)
    using v_author into v_last_at;
  if v_last_at is not null and now() - v_last_at < make_interval(secs => v_cooldown_seconds) then
    raise exception '너무 빠르게 연속으로 작성하고 있습니다. 잠시 후 다시 시도해 주세요.' using errcode = 'P0001';
  end if;

  execute format(
    'select count(*) from %I where %I = $1 and created_at > now() - interval ''1 hour''',
    TG_TABLE_NAME, v_author_col
  ) using v_author into v_count_last_hour;
  if v_count_last_hour >= v_max_per_hour then
    raise exception '시간당 작성 가능한 글/댓글 수를 초과했습니다. 잠시 후 다시 시도해 주세요.' using errcode = 'P0001';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- (쿨다운 초, 시간당 최대 개수, 작성자 컬럼명)
drop trigger if exists rate_limit_board_posts on board_posts;
create trigger rate_limit_board_posts before insert on board_posts
  for each row execute function enforce_rate_limit(10, 10, 'author_id');

drop trigger if exists rate_limit_board_comments on board_comments;
create trigger rate_limit_board_comments before insert on board_comments
  for each row execute function enforce_rate_limit(5, 30, 'author_id');

drop trigger if exists rate_limit_questions on questions;
create trigger rate_limit_questions before insert on questions
  for each row execute function enforce_rate_limit(10, 10, 'user_id');

-- ------------------------------------------------------------
-- 43. 신고 기능
-- ------------------------------------------------------------
-- 닉네임을 클릭하면 뜨는 메뉴에서 "이 사람"을 신고하는 형태라 target_type='profile'이
-- 기본이다(게시글/댓글 자체를 신고하는 것도 나중에 확장할 수 있게 타입을 열어둠).
-- context에는 어느 글/댓글에서 신고했는지 참고용 텍스트를 같이 남긴다.
create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references profiles(id) on delete set null,
  target_type text not null check (target_type in ('profile','board_post','board_comment')),
  target_id uuid not null,
  context text,
  reason text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

drop policy if exists "reports_insert_own" on reports;
create policy "reports_insert_own" on reports for insert with check (auth.uid() = reporter_id);

-- 신고 내역은 teacher는 물론 editor도 볼 수 없고 admin 이상만 봐야 한다는 요구사항이라
-- is_editor_or_above()가 아니라 is_admin()을 쓴다(editor를 제외하는 게 핵심).
drop policy if exists "reports_read_admin" on reports;
create policy "reports_read_admin" on reports for select using (is_admin());

drop policy if exists "reports_update_admin" on reports;
create policy "reports_update_admin" on reports for update using (is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end $$;

-- ------------------------------------------------------------
-- 44. 공지/뉴스/Q&A 공통 "일시 숨김" 토글 (게시판은 [1]에서 이미 구현됨)
-- ------------------------------------------------------------
-- 삭제하지 않고 학생 화면에서만 숨기고, 관리자 화면(editor 이상)에서는 계속 보이는
-- 토글이다. teacher가 쓰는 교과/학급 공지도 is_teacher_or_editor_above()가 관리
-- 목적 열람을 그대로 허용하므로 함께 적용된다.
alter table posts add column if not exists is_hidden boolean not null default false;
alter table questions add column if not exists is_hidden boolean not null default false;

drop policy if exists "posts_read_published" on posts;
create policy "posts_read_published" on posts for select
  using (
    type in ('notice','news')
    and (is_editor_or_above() or (status = 'published' and not is_hidden))
  );

drop policy if exists "posts_read_subject_notice" on posts;
create policy "posts_read_subject_notice" on posts for select
  using (
    type = 'subject_notice'
    and (
      is_teacher_or_editor_above()
      or (
        status = 'published' and not is_hidden
        and exists (
          select 1 from student_subjects ss
          where ss.user_id = auth.uid() and ss.subject = posts.target_subject
        )
      )
    )
  );

drop policy if exists "posts_read_homeroom_notice" on posts;
create policy "posts_read_homeroom_notice" on posts for select
  using (
    type = 'homeroom_notice'
    and (
      is_teacher_or_editor_above()
      or (
        status = 'published' and not is_hidden
        and exists (
          select 1 from directory_members dm
          join profiles p on p.email = dm.email
          where p.id = auth.uid() and dm.homeroom = posts.target_homeroom
        )
      )
    )
  );

drop policy if exists "questions_read" on questions;
create policy "questions_read" on questions for select
  using ((is_private = false and not is_hidden) or auth.uid() = user_id or is_admin());

-- ------------------------------------------------------------
-- 45. 조회수 시스템을 배치 집계 방식으로 통일
-- ------------------------------------------------------------
-- 공지사항([7]/[8] 이전)과 게시판([1])이 각자 RPC로 view_count를 직접 UPDATE하고
-- 있었는데(그때마다 audit_logs 트리거 예외 처리도 따로 필요했음), 매 조회마다 실시간
-- UPDATE하는 대신 조회 "이벤트"만 기록해두고 pg_cron으로 주기적으로 집계하는 방식으로
-- 통일한다. 이러면 인기 글에 접속이 몰려도 같은 행에 UPDATE 잠금이 반복되지 않고,
-- 공지사항/게시판 외에 다른 콘텐츠 타입이 추가돼도 content_type만 늘리면 된다.
create extension if not exists pg_cron with schema extensions;

create table if not exists content_view_events (
  id uuid primary key default uuid_generate_v4(),
  content_type text not null check (content_type in ('notice', 'board_post')),
  content_id uuid not null,
  -- 로그인 사용자는 auth.uid(), 비로그인 방문자는 브라우저에 저장해둔 임의의 id.
  viewer_key text not null,
  view_date date not null default (timezone('Asia/Seoul', now()))::date,
  created_at timestamptz not null default now(),
  -- 같은 사용자가 같은 콘텐츠를 같은 날 여러 번 봐도 한 번만 세어지도록 하는 핵심 제약.
  unique (content_type, content_id, viewer_key, view_date)
);

create index if not exists content_view_events_lookup_idx on content_view_events(content_type, content_id);

alter table content_view_events enable row level security;

-- 익명 방문자도 조회를 기록해야 하므로 로그인 여부와 무관하게 삽입 허용. 조회/수정/삭제는
-- 아무 정책도 없어서(기본값) 클라이언트는 할 수 없고, view_count는 아래 집계 함수를 통해서만
-- 반영된다.
drop policy if exists "content_view_events_insert_all" on content_view_events;
create policy "content_view_events_insert_all" on content_view_events for insert with check (true);

create or replace function aggregate_view_counts()
returns void as $$
begin
  update posts p set view_count = sub.cnt
  from (
    select content_id, count(*) as cnt
    from content_view_events
    where content_type = 'notice'
    group by content_id
  ) sub
  where p.id = sub.content_id and p.view_count is distinct from sub.cnt;

  update board_posts bp set view_count = sub.cnt
  from (
    select content_id, count(*) as cnt
    from content_view_events
    where content_type = 'board_post'
    group by content_id
  ) sub
  where bp.id = sub.content_id and bp.view_count is distinct from sub.cnt;
end;
$$ language plpgsql security definer;

-- 5분마다 집계. pg_cron 작업은 마이그레이션을 다시 실행하면 중복 스케줄될 수 있으니
-- 이미 있으면 건드리지 않는다.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'aggregate-view-counts') then
    perform cron.schedule('aggregate-view-counts', '*/5 * * * *', 'select aggregate_view_counts();');
  end if;
end $$;

-- 이전 방식(공지/게시판 각자 RPC로 즉시 UPDATE)은 더 이상 쓰지 않는다.
drop function if exists increment_post_view_count(uuid);
drop function if exists increment_board_view_count(uuid);

-- ------------------------------------------------------------
-- 46. 알림 센터 (댓글/답변 알림)
-- ------------------------------------------------------------
-- 다이렉트 메시지 기능은 아직 보류 상태라 이번에는 두 가지만: 내 게시판 글/댓글에
-- 댓글·답글이 달렸을 때, 내 Q&A 질문에 답변이 달렸을 때. 트리거로 자동 생성하고
-- (클라이언트가 직접 만들 수 없음, RLS에 insert 정책 없음 — SECURITY DEFINER 함수만
-- 기록), 본인 것만 읽고 읽음 처리할 수 있다.
create table if not exists user_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('board_comment', 'qna_answered')),
  target_type text not null,
  target_id uuid not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_id_idx on user_notifications(user_id);

alter table user_notifications enable row level security;

drop policy if exists "user_notifications_read_own" on user_notifications;
create policy "user_notifications_read_own" on user_notifications for select using (auth.uid() = user_id);
drop policy if exists "user_notifications_update_own" on user_notifications;
create policy "user_notifications_update_own" on user_notifications for update using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end $$;

-- 댓글 작성자 본인 글에는 알림을 보내지 않는다(자기 글에 자기가 댓글 단 경우).
-- 대댓글이면 부모 댓글 작성자에게도 보내되, 글쓴이와 같은 사람이면 중복 알림을 피한다.
create or replace function notify_board_comment()
returns trigger as $$
declare
  v_post_author uuid;
  v_post_title text;
  v_parent_author uuid;
begin
  select author_id, title into v_post_author, v_post_title from board_posts where id = new.post_id;
  if v_post_author is not null and v_post_author != new.author_id then
    insert into user_notifications (user_id, type, target_type, target_id, message)
    values (v_post_author, 'board_comment', 'board_post', new.post_id, '내 글 "' || coalesce(v_post_title, '') || '"에 댓글이 달렸습니다.');
  end if;

  if new.parent_id is not null then
    select author_id into v_parent_author from board_comments where id = new.parent_id;
    if v_parent_author is not null and v_parent_author != new.author_id and v_parent_author is distinct from v_post_author then
      insert into user_notifications (user_id, type, target_type, target_id, message)
      values (v_parent_author, 'board_comment', 'board_post', new.post_id, '내 댓글에 답글이 달렸습니다.');
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists notify_on_board_comment on board_comments;
create trigger notify_on_board_comment after insert on board_comments
  for each row execute function notify_board_comment();

create or replace function notify_qna_answered()
returns trigger as $$
declare
  v_user_id uuid;
  v_title text;
begin
  select user_id, title into v_user_id, v_title from questions where id = new.question_id;
  if v_user_id is not null then
    insert into user_notifications (user_id, type, target_type, target_id, message)
    values (v_user_id, 'qna_answered', 'qna_question', new.question_id, '내 질문 "' || coalesce(v_title, '') || '"에 답변이 등록되었습니다.');
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists notify_on_answer on answers;
create trigger notify_on_answer after insert on answers
  for each row execute function notify_qna_answered();

-- ------------------------------------------------------------
-- 47. 일정(events)에도 일시 숨김 토글 추가 (공지/뉴스/Q&A/게시판과 동일한 패턴)
-- ------------------------------------------------------------
alter table events add column if not exists is_hidden boolean not null default false;

drop policy if exists "events_read_all" on events;
create policy "events_read_all" on events for select
  using (not is_hidden or is_editor_or_above());

-- ------------------------------------------------------------
-- 48. viewer 역할 추가
-- ------------------------------------------------------------
-- 사이트 잠금(점검) 모드 중에도 사이트는 정상적으로 보여야 하지만, /admin 하위 경로는
-- 어떤 화면도 접근할 수 없는 전용 역할이다(student와 동일한 권한 + 잠금 모드 예외만
-- 추가 — middleware.ts에서 처리, RLS 헬퍼 함수들은 전부 student와 동일하게 취급한다).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('student','teacher','sub_editor','editor','admin','superadmin','viewer'));

-- ------------------------------------------------------------
-- 49. 조직 활동 관리(안건함/조직 일정/활동기록)를 임원회(is_council) 전용으로 변경
-- ------------------------------------------------------------
-- 지금까지는 sub_editor 이상이면 누구나 쓸 수 있었지만, 이제 role과 무관하게
-- is_council=true인 사람만 쓸 수 있다(sub_editor/editor/admin/superadmin이어도
-- is_council이 없으면 더 이상 접근할 수 없다). middleware.ts의 /admin/org-activities/*
-- 경로 체크도 같은 기준으로 함께 바꿨다.
create or replace function is_org_activities_manager()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('sub_editor','editor','admin','superadmin') and is_council = true
  );
$$ language sql stable security definer;

-- ------------------------------------------------------------
-- 50. superadmin은 is_council 조건과 무관하게 조직 활동 관리를 항상 쓸 수 있어야 한다
-- ------------------------------------------------------------
-- 최상위 권한 안전장치 — 관리자가 플래그 설정 실수로 아무도(본인 포함) 접근 못 하게
-- 되는 상황을 막는다(admin/superadmin이 명단과 무관하게 항상 로그인 가능한 것과 같은
-- 종류의 예외). middleware.ts의 /admin/org-activities/* 체크와 AdminNav도 함께 바꿨다.
create or replace function is_org_activities_manager()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (
        role = 'superadmin'
        or (role in ('sub_editor','editor','admin') and is_council = true)
      )
  );
$$ language sql stable security definer;

-- ------------------------------------------------------------
-- 51. posts/board_posts/board_comments 작성자 이름을 안전하게 노출하는 computed column
-- ------------------------------------------------------------
-- profiles의 select RLS는 본인 또는 editor 이상만 다른 사람 행을 볼 수 있어서, 학생
-- 화면에서 posts/board_posts/board_comments를 profiles와 그대로 조인하면(PostgREST embed)
-- 다른 사람이 쓴 글은 작성자 이름이 항상 비어서 온다(RLS가 그 프로필 행을 가려버린다 —
-- 실제로 라이브 쿼리로 재현 확인함). events_with_creator처럼 뷰(security_invoker=false)로
-- 만들면 posts 자체의 RLS(임시저장/숨김/교과·학급 대상 제한 등)까지 함께 우회돼버려
-- 위험하므로, 대신 "이름만" 안전하게 반환하는 SECURITY DEFINER 함수를 PostgREST computed
-- column으로 노출한다 — 원본 테이블의 select는 여전히 정상적으로 RLS를 타고, 이 함수만
-- profiles 조회를 우회한다.
create or replace function author_name(posts) returns text as $$
  select coalesce(p.nickname, p.name) from profiles p where p.id = ($1).author_id;
$$ language sql stable security definer;
grant execute on function author_name(posts) to anon, authenticated;

create or replace function author_name(board_posts) returns text as $$
  select coalesce(p.nickname, p.name) from profiles p where p.id = ($1).author_id;
$$ language sql stable security definer;
grant execute on function author_name(board_posts) to anon, authenticated;

create or replace function author_name(board_comments) returns text as $$
  select coalesce(p.nickname, p.name) from profiles p where p.id = ($1).author_id;
$$ language sql stable security definer;
grant execute on function author_name(board_comments) to anon, authenticated;

-- board_posts/board_comments 목록에서 작성자 프로필 사진도 함께 보여주는데, 이것도
-- author_name과 같은 이유로 profiles RLS에 막혀 다른 사람 것은 비어 온다. 같은 방식으로 해결.
create or replace function author_avatar(board_posts) returns text as $$
  select p.profile_image from profiles p where p.id = ($1).author_id;
$$ language sql stable security definer;
grant execute on function author_avatar(board_posts) to anon, authenticated;

create or replace function author_avatar(board_comments) returns text as $$
  select p.profile_image from profiles p where p.id = ($1).author_id;
$$ language sql stable security definer;
grant execute on function author_avatar(board_comments) to anon, authenticated;

-- ------------------------------------------------------------
-- 52. 급식(월별 급식표) 기능
-- ------------------------------------------------------------
-- 월별 급식표 이미지를 admin 이상만 업로드/교체할 수 있고, 조회는 공개(홈 화면에 표시).
create table if not exists meal_plans (
  id uuid primary key default uuid_generate_v4(),
  year int not null,
  month int not null check (month between 1 and 12),
  image_url text not null,
  image_path text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (year, month)
);

alter table meal_plans enable row level security;

drop policy if exists "meal_plans_read_all" on meal_plans;
create policy "meal_plans_read_all" on meal_plans for select using (true);

drop policy if exists "meal_plans_write_admin" on meal_plans;
create policy "meal_plans_write_admin" on meal_plans for all using (is_admin()) with check (is_admin());

-- 홈 화면 블록 목록에 "급식" 카드를 하나 추가한다. 기존 4개 블록과 동일하게
-- /admin/main-editor에서 켜고 끄기·순서 변경이 가능하다(전부 label 기준으로 동작하는
-- 화면이라 새 코드 없이 그대로 작동함).
insert into main_blocks (id, label, is_visible, order_index) values
  ('meal', '이번 달 급식표', true, 5)
on conflict (id) do nothing;

-- 급식표 이미지 전용 Storage 버킷. attachments 버킷은 editor 이상이 쓸 수 있어서
-- 재사용하지 않고, "admin 이상만"이라는 요구사항에 맞춰 새로 분리했다.
insert into storage.buckets (id, name, public) values ('meal-plans', 'meal-plans', true)
on conflict (id) do nothing;

drop policy if exists "meal_plans_bucket_public_read" on storage.objects;
create policy "meal_plans_bucket_public_read" on storage.objects for select
  using (bucket_id = 'meal-plans');

drop policy if exists "meal_plans_bucket_insert_admin" on storage.objects;
create policy "meal_plans_bucket_insert_admin" on storage.objects for insert
  with check (bucket_id = 'meal-plans' and is_admin());

drop policy if exists "meal_plans_bucket_update_admin" on storage.objects;
create policy "meal_plans_bucket_update_admin" on storage.objects for update
  using (bucket_id = 'meal-plans' and is_admin());

drop policy if exists "meal_plans_bucket_delete_admin" on storage.objects;
create policy "meal_plans_bucket_delete_admin" on storage.objects for delete
  using (bucket_id = 'meal-plans' and is_admin());

-- ------------------------------------------------------------
-- 53. 공지사항 등록 시 이메일 알림 기능
-- ------------------------------------------------------------
-- 학생이 마이페이지에서 이메일 알림 수신 여부를 개별적으로 끌 수 있다(기본값 켜짐).
alter table profiles add column if not exists email_notifications boolean not null default true;

-- 발송 실패(및 발송 이력) 로그. 클라이언트가 직접 쓰지 않고 서버(서비스 롤 키)에서만
-- 기록하므로 별도 insert 정책이 없다 — RLS가 걸려 있으면 클라이언트/anon의 직접 삽입은
-- 항상 막힌다. post가 나중에 삭제되더라도 로그가 무슨 공지였는지 알아볼 수 있게
-- post_title을 스냅샷으로 함께 저장한다.
create table if not exists email_notification_logs (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references posts(id) on delete set null,
  post_title text,
  recipient_email text not null,
  status text not null check (status in ('sent','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table email_notification_logs enable row level security;

drop policy if exists "email_notification_logs_read_admin" on email_notification_logs;
create policy "email_notification_logs_read_admin" on email_notification_logs for select using (is_admin());

create index if not exists email_notification_logs_post_id_idx on email_notification_logs(post_id);
create index if not exists email_notification_logs_created_at_idx on email_notification_logs(created_at desc);

-- ------------------------------------------------------------
-- 54. 급식표 원본 파일명 컬럼 추가
-- ------------------------------------------------------------
-- 스토리지 키는 안전한 값(safeStorageKey)으로 바꾸고, 원본 파일명은 여기 보관한다.
alter table meal_plans add column if not exists original_file_name text;

-- ------------------------------------------------------------
-- 55. 자동 뱃지 지급이 "받은 사람의 관리자 활동"으로 잘못 기록되던 버그 수정
-- ------------------------------------------------------------
-- user_badges insert는 두 경로가 있다: (1) 학생 본인이 자동 조건 충족 시 스스로 insert
-- (user_badges_insert_self, auth.uid() = user_id) — 관리자 행위가 아님, (2) 관리자/editor가
-- 다른 학생에게 수동으로 부여(user_badges_insert_staff) — 진짜 관리자 행위. 기존 트리거는
-- 둘을 구분 안 하고 전부 기록해서, 자동 지급도 "그 학생이 user_badges를 insert했다"고
-- 남아 활동 로그에서 학생 본인의 활동인 것처럼 보였다(라이브 쿼리로 재현 확인).
-- login_access_requests의 시스템 자동 기록 제외 패턴과 동일하게, "본인에게 스스로 부여"한
-- 경우만 감사 로그에서 뺀다.
drop trigger if exists audit_user_badges on user_badges;

create trigger audit_user_badges_insert after insert on user_badges
  for each row
  when (new.user_id is distinct from auth.uid())
  execute function log_audit_event();

create trigger audit_user_badges_delete after delete on user_badges
  for each row execute function log_audit_event();

-- ------------------------------------------------------------
-- 56. 메인화면 편집기: 세로 순서뿐 아니라 가로 너비(1/3, 2/3, 전체)도 조정 가능하게 변경
-- ------------------------------------------------------------
-- 3칸 그리드 기준 칸 수(1~3)를 저장한다. 기본값은 지금까지의 배치(공지/일정은 좁게,
-- 나머지는 전체 폭)에 가깝게 맞춰서 마이그레이션 직후 레이아웃이 과하게 깨지지 않게 한다.
alter table main_blocks add column if not exists col_span int not null default 3 check (col_span between 1 and 3);
update main_blocks set col_span = 1 where id in ('notice', 'event');

-- ------------------------------------------------------------
-- 57. 공지사항 이메일 발송: 대상 선택 + 미리보기 + 발송 이력
-- ------------------------------------------------------------
-- "자동 전체 발송" 방식에서, 발송 1건(batch) 단위 요약 기록을 남기는 방식으로 재구성.
-- 기존 email_notification_logs(수신자별 성공/실패 기록)를 그 batch에 연결한다.
create table if not exists email_notification_batches (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references posts(id) on delete set null,
  post_title text,
  sent_by uuid references profiles(id) on delete set null,
  audience_description text not null,
  recipient_count int not null default 0,
  success_count int not null default 0,
  failure_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table email_notification_batches enable row level security;

-- 본인이 보낸 발송 이력은 본인도 볼 수 있어야 teacher/editor가 자기 발송 결과를 확인할 수
-- 있다(전체 이력은 admin 이상만).
drop policy if exists "email_notification_batches_read_own_or_admin" on email_notification_batches;
create policy "email_notification_batches_read_own_or_admin" on email_notification_batches for select
  using (sent_by = auth.uid() or is_admin());

alter table email_notification_logs add column if not exists batch_id uuid references email_notification_batches(id) on delete cascade;

-- 기존 email_notification_logs는 is_admin()만 볼 수 있었는데, 본인이 보낸 batch에 속한
-- 로그(수신자별 상세)는 본인도 볼 수 있게 정책을 하나 더 추가한다(permissive라 OR로 합쳐짐).
drop policy if exists "email_notification_logs_read_own_batch" on email_notification_logs;
create policy "email_notification_logs_read_own_batch" on email_notification_logs for select
  using (
    exists (
      select 1 from email_notification_batches b
      where b.id = email_notification_logs.batch_id and b.sent_by = auth.uid()
    )
  );

create index if not exists email_notification_batches_post_id_idx on email_notification_batches(post_id);
create index if not exists email_notification_batches_created_at_idx on email_notification_batches(created_at desc);
create index if not exists email_notification_logs_batch_id_idx on email_notification_logs(batch_id);

-- ------------------------------------------------------------
-- 58. 게시판 댓글/안건함/부서 활동기록에도 숨김+삭제 규칙 통일, 활동 로그 누락 보완
-- ------------------------------------------------------------
-- 공지/뉴스/Q&A/게시판/일정에만 있던 "일시 숨김" + "작성자 본인 또는 admin 이상 삭제" 규칙을
-- 글을 쓸 수 있는 나머지 기능(게시판 댓글, 안건함, 부서 활동기록)에도 맞춘다.

-- 1) 게시판 댓글: is_hidden 추가. 목록 조회 시 게시글 자체의 숨김 여부에 더해 댓글 자신의
-- 숨김 여부도 함께 확인한다(게시글은 안 숨겨졌는데 댓글만 숨길 수도 있으므로).
alter table board_comments add column if not exists is_hidden boolean not null default false;

drop policy if exists "board_comments_read" on board_comments;
create policy "board_comments_read" on board_comments for select
  using (
    exists (
      select 1 from board_posts bp
      where bp.id = board_comments.post_id
        and (not bp.is_hidden or is_editor_or_above() or auth.uid() = bp.author_id)
    )
    and (not is_hidden or is_editor_or_above() or auth.uid() = author_id)
  );

-- 숨김 토글용 update 정책(지금까지 댓글은 update 정책 자체가 없어서 수정이 불가능했다).
drop policy if exists "board_comments_update_staff" on board_comments;
create policy "board_comments_update_staff" on board_comments for update
  using (is_editor_or_above())
  with check (is_editor_or_above());

-- 2) 안건함: is_hidden 추가. 삭제 규칙을 admin 전용 -> 작성자 본인 또는 admin 이상으로 통일
-- (다른 콘텐츠 타입과 동일한 기준).
alter table proposals add column if not exists is_hidden boolean not null default false;

drop policy if exists "proposals_read_all" on proposals;
create policy "proposals_read_all" on proposals for select
  using (not is_hidden or is_editor_or_above() or auth.uid() = author_id);

drop policy if exists "proposals_delete_admin" on proposals;
drop policy if exists "proposals_delete_own_or_admin" on proposals;
create policy "proposals_delete_own_or_admin" on proposals for delete
  using (auth.uid() = author_id or is_admin());

-- 상태 변경만 기록하던 트리거를 숨김 토글도 함께 기록하도록 확장.
drop trigger if exists audit_proposals_status on proposals;
create trigger audit_proposals_status after update on proposals
  for each row
  when (old.status is distinct from new.status or old.is_hidden is distinct from new.is_hidden)
  execute function log_audit_event();

-- 안건 삭제는 지금까지 활동 로그에 기록되지 않고 있었다.
drop trigger if exists audit_proposals_delete on proposals;
create trigger audit_proposals_delete after delete on proposals
  for each row execute function log_audit_event();

-- 3) 부서 활동기록: is_hidden 추가. 기존 "for all" 정책을 세분화해서 삭제만 작성자 본인
-- 또는 admin 이상으로 제한한다(작성/수정/숨김 토글은 기존대로 editor 이상 누구나).
alter table org_records add column if not exists is_hidden boolean not null default false;

drop policy if exists "org_records_read_all" on org_records;
create policy "org_records_read_all" on org_records for select
  using (not is_hidden or is_editor_or_above() or auth.uid() = author_id);

drop policy if exists "org_records_write_editor" on org_records;
drop policy if exists "org_records_insert_editor" on org_records;
drop policy if exists "org_records_update_editor" on org_records;
drop policy if exists "org_records_delete_own_or_admin" on org_records;
create policy "org_records_insert_editor" on org_records for insert
  with check (is_editor_or_above());
create policy "org_records_update_editor" on org_records for update
  using (is_editor_or_above()) with check (is_editor_or_above());
create policy "org_records_delete_own_or_admin" on org_records for delete
  using (auth.uid() = author_id or is_admin());

-- org_events/org_records는 이미 insert/update/delete를 전부 기록하는 트리거가 있어서
-- is_hidden 추가만으로 자동으로 감사 로그에 포함된다(별도 트리거 변경 불필요).

-- 4) Q&A 질문: is_hidden/삭제 규칙은 이미 있었지만, 지금까지 활동 로그에는 한 번도
-- 기록되지 않고 있었다(questions 테이블에 audit 트리거 자체가 없었음).
drop trigger if exists audit_questions_insert on questions;
create trigger audit_questions_insert after insert on questions
  for each row execute function log_audit_event();
drop trigger if exists audit_questions_update on questions;
create trigger audit_questions_update after update on questions
  for each row
  when (old.status is distinct from new.status or old.is_hidden is distinct from new.is_hidden)
  execute function log_audit_event();
drop trigger if exists audit_questions_delete on questions;
create trigger audit_questions_delete after delete on questions
  for each row execute function log_audit_event();

-- 5) 게시판 댓글도 지금까지 활동 로그에 기록되지 않고 있었다.
drop trigger if exists audit_board_comments_insert on board_comments;
create trigger audit_board_comments_insert after insert on board_comments
  for each row execute function log_audit_event();
drop trigger if exists audit_board_comments_update on board_comments;
create trigger audit_board_comments_update after update on board_comments
  for each row
  when (old.is_hidden is distinct from new.is_hidden)
  execute function log_audit_event();
drop trigger if exists audit_board_comments_delete on board_comments;
create trigger audit_board_comments_delete after delete on board_comments
  for each row execute function log_audit_event();

-- ------------------------------------------------------------
-- 59. teacher 권한을 student와 동일하게 차단
-- ------------------------------------------------------------
-- 계정의 role='teacher'는 그대로 유지하고(나중에 되돌리기 쉽도록), "teacher만 가능하던
-- 것"만 제거한다: 교과/학급 공지 작성·수정 권한, 관리 목적 열람 권한(is_teacher_or_editor_above
-- 에서 teacher 제외 -> editor 이상과 동일). 이메일 발송/관리자 화면 접근 등 앱 레벨 권한은
-- 별도로 src/app/admin/layout.tsx, src/lib/supabase/middleware.ts, src/app/api/send-notice-email,
-- src/app/(site)/notices/page.tsx, src/components/admin/AdminNav.tsx에서 "teacher" 제외로 처리.
drop policy if exists "posts_insert_teacher_notice" on posts;
drop policy if exists "posts_update_teacher_own" on posts;

create or replace function is_teacher_or_editor_above()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('editor','admin','superadmin')
  );
$$ language sql stable security definer;

-- ------------------------------------------------------------
-- 60. 기능 활성화 스위치를 Q&A/게시판 외 나머지 메뉴에도 확장
-- ------------------------------------------------------------
-- 헤더 NAV의 나머지 메뉴(공지사항/학생자치회 소개/구성원/일정/뉴스/생활규정)도 superadmin이
-- 통째로 켜고 끌 수 있게 한다. "홈"은 사이트 루트라 대상에서 제외.
insert into feature_flags (key) values ('notices') on conflict (key) do nothing;
insert into feature_flags (key) values ('organizations') on conflict (key) do nothing;
insert into feature_flags (key) values ('members') on conflict (key) do nothing;
insert into feature_flags (key) values ('calendar') on conflict (key) do nothing;
insert into feature_flags (key) values ('news') on conflict (key) do nothing;
insert into feature_flags (key) values ('rules') on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 61. "designer" 조회 전용 역할 추가
-- ------------------------------------------------------------
-- 어떤 write(insert/update/delete) 정책에도 designer를 추가하지 않는다 — is_admin()/
-- is_superadmin()/is_editor_or_above()/is_teacher_or_editor_above() 등 기존 role 체크
-- 함수들을 전혀 건드리지 않으므로, 이 함수들로 게이트된 모든 write는 designer에게 자동으로
-- 계속 막힌다. 대신 관리자 화면이 읽어야 하는 테이블마다 "select만 허용하는" 전용 정책을
-- 새로 추가해서 admin/superadmin이 보는 데이터를 동일하게 볼 수 있게 한다(다른 정책과
-- 병행되는 permissive 정책이라 기존 규칙에는 영향 없음). 실제 계정으로 라이브 테스트해서
-- select는 통과하고 update는 0행 처리(차단)되는 것을 확인함.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('student','teacher','sub_editor','editor','admin','superadmin','viewer','designer'));

create or replace function is_designer()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'designer'
  );
$$ language sql stable security definer;

create policy "profiles_select_designer" on profiles for select using (is_designer());
create policy "answers_select_designer" on answers for select using (is_designer());
create policy "audit_logs_select_designer" on audit_logs for select using (is_designer());
create policy "board_comments_select_designer" on board_comments for select using (is_designer());
create policy "board_posts_select_designer" on board_posts for select using (is_designer());
create policy "email_notification_batches_select_designer" on email_notification_batches for select using (is_designer());
create policy "email_notification_logs_select_designer" on email_notification_logs for select using (is_designer());
create policy "events_select_designer" on events for select using (is_designer());
create policy "login_access_requests_select_designer" on login_access_requests for select using (is_designer());
create policy "org_records_select_designer" on org_records for select using (is_designer());
create policy "pages_select_designer" on pages for select using (is_designer());
create policy "posts_select_designer" on posts for select using (is_designer());
create policy "proposals_select_designer" on proposals for select using (is_designer());
create policy "questions_select_designer" on questions for select using (is_designer());
create policy "reports_select_designer" on reports for select using (is_designer());
create policy "student_subjects_select_designer" on student_subjects for select using (is_designer());
create policy "user_attendance_select_designer" on user_attendance for select using (is_designer());
create policy "user_badges_select_designer" on user_badges for select using (is_designer());

-- ------------------------------------------------------------
-- 62. 학생생활규정을 조(條) 단위로 분리 검색하기 위한 정렬 컬럼
-- ------------------------------------------------------------
-- 규정 전문을 하나의 rules 행에 통째로 넣으면 검색 결과를 눌러도 문서 전체가 나와서 원하는
-- 조항만 바로 보기 어렵다. 조(條)마다 별도 행으로 등록해 검색 결과에서 바로 해당 조문만
-- 보이게 했다. title(예: "제20조(생활교육의 종류)")은 "제10조"가 "제2조"보다 문자열상
-- 앞에 오는 등 숫자 순서와 어긋나므로, 화면 표시 순서를 위한 정수 컬럼을 별도로 둔다.
alter table rules add column if not exists order_index int not null default 0;

-- ------------------------------------------------------------
-- 64. 신고 처리 화면에서 바로 실행하는 제재 기능(경고/일시정지/영구차단)
-- ------------------------------------------------------------
-- reports.target_id는 target_type에 따라 다른 테이블을 가리키는 범용 컬럼이라(profile/
-- board_post/board_comment), 신고 접수 시점에 실제 작성자(profiles.id)를 미리 계산해
-- target_author_id에 저장해둔다. 게시글/댓글이 나중에 삭제돼도 "누구를 신고했었는지"는
-- 계속 알 수 있어야 하므로 런타임 조인 대신 INSERT 시점 트리거로 한 번만 계산한다.
alter table reports add column if not exists target_author_id uuid references profiles(id);

create or replace function resolve_report_target_author()
returns trigger as $$
begin
  if new.target_type = 'profile' then
    new.target_author_id := new.target_id;
  elsif new.target_type = 'board_post' then
    select author_id into new.target_author_id from board_posts where id = new.target_id;
  elsif new.target_type = 'board_comment' then
    select author_id into new.target_author_id from board_comments where id = new.target_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_resolve_report_target_author on reports;
create trigger trg_resolve_report_target_author
  before insert on reports
  for each row execute function resolve_report_target_author();

-- 기존에 이미 접수된 신고에도 소급 적용(재실행해도 이미 채워진 행은 건드리지 않음)
update reports r set target_author_id = (
  case r.target_type
    when 'profile' then r.target_id
    when 'board_post' then (select author_id from board_posts where id = r.target_id)
    when 'board_comment' then (select author_id from board_comments where id = r.target_id)
  end
)
where r.target_author_id is null;

-- 경고 누적 / 일시정지
alter table profiles add column if not exists warning_count int not null default 0;
alter table profiles add column if not exists suspended_until timestamptz;

create table if not exists user_warnings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  report_id uuid references reports(id) on delete set null,
  issued_by uuid references profiles(id),
  reason text,
  created_at timestamptz not null default now()
);
alter table user_warnings enable row level security;

drop policy if exists "user_warnings_select_self_or_admin" on user_warnings;
create policy "user_warnings_select_self_or_admin" on user_warnings for select
  using (auth.uid() = user_id or is_admin());
drop policy if exists "user_warnings_insert_admin" on user_warnings;
create policy "user_warnings_insert_admin" on user_warnings for insert with check (is_admin());

-- 경고 누적 자동조치 기준값 — 코드에 하드코딩하지 않고 admin이 나중에 바꿀 수 있도록
-- site_settings(기존 전역 설정 싱글턴)에 둔다.
alter table site_settings add column if not exists warning_suspend_threshold int not null default 3;
alter table site_settings add column if not exists warning_suspend_days int not null default 3;
alter table site_settings add column if not exists warning_ban_threshold int not null default 5;

-- 영구 차단 공용 로직(경고 자동조치/수동 차단이 함께 씀) — "외부 계정 관리"와 동일하게
-- directory_members.is_allowed=false + login_access_requests 이력 기록을 재사용한다.
create or replace function internal_ban_user_by_email(target_email text, p_reason text)
returns void as $$
begin
  insert into directory_members (email, member_type, display_name, is_allowed)
  values (target_email, 'other', target_email, false)
  on conflict (email) do update set is_allowed = false;

  if exists (select 1 from login_access_requests where email = target_email) then
    update login_access_requests
      set status = 'blocked', decided_by = auth.uid(), decided_at = now()
      where email = target_email;
  else
    insert into login_access_requests (email, status, decided_by, decided_at)
    values (target_email, 'blocked', auth.uid(), now());
  end if;

  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'ban', 'directory_members', target_email, jsonb_build_object('reason', p_reason));
end;
$$ language plpgsql security definer set search_path = public;

-- 신고 화면에서 경고를 부여하고, 누적 기준을 넘으면 자동으로 정지/영구차단까지 처리한다.
create or replace function issue_user_warning(target_user_id uuid, p_report_id uuid, p_reason text)
returns json as $$
declare
  new_count int;
  suspend_threshold int;
  suspend_days int;
  ban_threshold int;
  target_email text;
  auto_action text := null;
begin
  if not is_admin() then
    raise exception 'admin 이상만 경고를 부여할 수 있습니다';
  end if;

  insert into user_warnings (user_id, report_id, issued_by, reason)
  values (target_user_id, p_report_id, auth.uid(), p_reason);

  update profiles set warning_count = warning_count + 1
  where id = target_user_id
  returning warning_count, email into new_count, target_email;

  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'warn', 'profiles', target_user_id::text, jsonb_build_object('warning_count', new_count, 'reason', p_reason));

  select warning_suspend_threshold, warning_suspend_days, warning_ban_threshold
    into suspend_threshold, suspend_days, ban_threshold
    from site_settings where id = 'default';

  if new_count >= ban_threshold then
    perform internal_ban_user_by_email(target_email, '경고 누적(' || new_count || '회)으로 인한 영구 차단');
    auto_action := 'banned';
  elsif new_count >= suspend_threshold then
    update profiles set suspended_until = now() + (suspend_days || ' days')::interval where id = target_user_id;
    insert into audit_logs (user_id, action, target_table, target_id, after_data)
    values (auth.uid(), 'suspend', 'profiles', target_user_id::text, jsonb_build_object('days', suspend_days, 'reason', '경고 누적(' || new_count || '회)으로 인한 자동 정지'));
    auto_action := 'suspended';
  end if;

  return json_build_object('warning_count', new_count, 'auto_action', auto_action, 'suspend_days', suspend_days);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function issue_user_warning(uuid, uuid, text) to authenticated;

-- 신고 화면에서 관리자가 직접 일시정지를 거는 경로(경고 자동정지와 별개)
create or replace function suspend_user(target_user_id uuid, days int, p_reason text)
returns void as $$
begin
  if not is_admin() then
    raise exception 'admin 이상만 계정을 정지할 수 있습니다';
  end if;
  update profiles set suspended_until = now() + (days || ' days')::interval where id = target_user_id;
  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'suspend', 'profiles', target_user_id::text, jsonb_build_object('days', days, 'reason', p_reason));
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function suspend_user(uuid, int, text) to authenticated;

-- 신고 화면에서 관리자가 직접 영구 차단하는 경로
create or replace function ban_user_permanently(target_user_id uuid, p_reason text)
returns void as $$
declare
  target_email text;
begin
  if not is_admin() then
    raise exception 'admin 이상만 계정을 차단할 수 있습니다';
  end if;
  select email into target_email from profiles where id = target_user_id;
  if target_email is null then
    raise exception '대상 계정을 찾을 수 없습니다';
  end if;
  perform internal_ban_user_by_email(target_email, p_reason);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function ban_user_permanently(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 65. 경고 철회 기능
-- ------------------------------------------------------------
-- 실수로 부여했거나 이의제기로 취소해야 하는 경고를 지울 수 있어야 한다. 기록 자체를
-- 지우지 않고(감사 목적) revoked_at/revoked_by로 소프트 삭제한다 — 마이페이지/관리자
-- 화면 모두 revoked_at is null인 것만 "현재 유효한 경고"로 보여준다.
alter table user_warnings add column if not exists revoked_at timestamptz;
alter table user_warnings add column if not exists revoked_by uuid references profiles(id);

create or replace function revoke_user_warning(warning_id uuid)
returns void as $$
declare
  target_user_id uuid;
begin
  if not is_admin() then
    raise exception 'admin 이상만 경고를 철회할 수 있습니다';
  end if;

  select user_id into target_user_id from user_warnings where id = warning_id and revoked_at is null;
  if target_user_id is null then
    raise exception '철회할 수 있는 경고를 찾을 수 없습니다(이미 철회됐거나 존재하지 않음)';
  end if;

  update user_warnings set revoked_at = now(), revoked_by = auth.uid() where id = warning_id;
  update profiles set warning_count = greatest(0, warning_count - 1) where id = target_user_id;

  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'unwarn', 'profiles', target_user_id::text, jsonb_build_object('warning_id', warning_id));
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function revoke_user_warning(uuid) to authenticated;

-- ------------------------------------------------------------
-- 66. 영구 차단 해제 / 일시정지 조기 해제 + 구성원 프로필 화면에서 바로 제재
-- ------------------------------------------------------------
-- 영구 차단 해제 — "외부 계정 관리" 화면의 승인(approve) 로직과 동일하게
-- directory_members.is_allowed=true로 되돌리고 login_access_requests 이력도 갱신한다.
create or replace function unban_user_permanently(target_user_id uuid)
returns void as $$
declare
  target_email text;
begin
  if not is_admin() then
    raise exception 'admin 이상만 차단을 해제할 수 있습니다';
  end if;
  select email into target_email from profiles where id = target_user_id;
  if target_email is null then
    raise exception '대상 계정을 찾을 수 없습니다';
  end if;

  update directory_members set is_allowed = true where email = target_email;

  if exists (select 1 from login_access_requests where email = target_email) then
    update login_access_requests
      set status = 'approved', decided_by = auth.uid(), decided_at = now()
      where email = target_email;
  end if;

  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'unban', 'directory_members', target_email, jsonb_build_object('reason', '관리자가 직접 차단 해제'));
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function unban_user_permanently(uuid) to authenticated;

-- 일시정지 조기 해제(정지 기간이 남아있어도 관리자가 즉시 풀 수 있게)
create or replace function unsuspend_user(target_user_id uuid)
returns void as $$
begin
  if not is_admin() then
    raise exception 'admin 이상만 정지를 해제할 수 있습니다';
  end if;
  update profiles set suspended_until = null where id = target_user_id;
  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'unsuspend', 'profiles', target_user_id::text, jsonb_build_object('reason', '관리자가 직접 정지 해제'));
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function unsuspend_user(uuid) to authenticated;

-- ------------------------------------------------------------
-- 67. 부서 활동 관리(안건함/부서 일정/활동기록) 접근을 role과 무관하게 is_council로 통일
-- ------------------------------------------------------------
-- 예전엔 sub_editor 이상 role이면서 is_council인 사람만 부서 활동을 관리할 수 있었는데,
-- 관리자 버튼/탭 노출도 role과 무관하게 is_council 하나만으로 열어주기로 하면서(student/
-- teacher도 임원이면 접근) RLS도 같은 기준으로 완화한다. superadmin은 계속 항상 허용.
create or replace function is_org_activities_manager()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'superadmin' or is_council = true)
  );
$$;

-- org_records(활동기록)는 다른 두 화면과 달리 is_editor_or_above()로 따로 막혀 있어서
-- 위 함수 완화와 별개로 여전히 editor 이상만 쓸 수 있었다 — is_org_activities_manager()도
-- 함께 허용해 기준을 통일한다(editor 이상 계정의 기존 권한은 그대로 유지).
drop policy if exists org_records_insert_editor on org_records;
create policy org_records_insert_editor on org_records
  for insert
  with check (is_editor_or_above() or is_org_activities_manager());

drop policy if exists org_records_update_editor on org_records;
create policy org_records_update_editor on org_records
  for update
  using (is_editor_or_above() or is_org_activities_manager())
  with check (is_editor_or_above() or is_org_activities_manager());

-- ------------------------------------------------------------
-- 68. 관리자 안건함 화면에 찬반 투표 버튼 추가 + 상태 변경은 admin 이상만
-- ------------------------------------------------------------
-- 안건 상태(검토중/승인/반려/완료) 변경은 admin 이상만 할 수 있어야 한다. proposals
-- 테이블의 UPDATE RLS(proposals_update_editor)는 is_org_activities_manager()(=is_council
-- 또는 superadmin)라 이 화면에 들어올 수 있는 모든 임원회 구성원이 그대로 상태까지 바꿀 수
-- 있었는데, 상태 변경만 더 좁은 admin 이상 권한으로 묶는다. RLS는 row 단위라 컬럼별로
-- 나눌 수 없으므로, status가 실제로 바뀔 때만 걸리는 트리거로 강제한다 — 클라이언트가 직접
-- REST로 status를 바꾸려는 시도도 이 트리거가 함께 막는다(UI 제한과 별개의 실제 방어선).
-- (찬반 투표 자체는 학생용 /org-activities 안건함과 동일하게 proposal_votes 테이블/RLS를
-- 그대로 재사용 — role과 무관하게 인증된 사용자면 누구나 자기 표만 넣고 뺄 수 있고,
-- unique(proposal_id, user_id) 제약이 1인 1표를 DB 레벨에서 보장하므로 별도 변경 불필요.)
create or replace function enforce_proposal_status_admin_only()
returns trigger as $$
begin
  if new.status is distinct from old.status and not is_admin() then
    raise exception '안건 상태 변경은 admin 이상만 할 수 있습니다';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_proposal_status_admin_only on proposals;
create trigger trg_proposal_status_admin_only
  before update on proposals
  for each row execute function enforce_proposal_status_admin_only();

-- ------------------------------------------------------------
-- 69. designer 역할의 쓰기 권한을 admin과 동일한 수준으로 확장 (superadmin 전용 화면 제외)
-- ------------------------------------------------------------
-- designer 역할의 쓰기 권한을 admin과 동일한 수준으로 올린다. 단, superadmin 전용
-- 화면(뱃지 관리/회원·권한 관리/외부 계정 관리/접속 통계/사이트 잠금/활동 로그/기능
-- 스위치/테마 — middleware.ts의 superadminOnlyPrefixes와 AdminNav의 SUPERADMIN_NAV에
-- 해당하는 화면들)은 그대로 제외한다. is_admin()/is_editor_or_above()는 여러 화면에
-- 걸쳐 재사용되는 함수라 그대로 바꾸면 위 제외 대상 화면까지 같이 열리므로, 함수는
-- 건드리지 않고 "admin 수준으로 열어줘야 하는" 개별 정책에만 OR is_designer()를 덧붙인다.

-- ===== RPC/트리거: 신고 내역·부서 활동 관련 admin 전용 조치 =====
-- (protect_profile_fields는 /admin/users 회원·권한 관리와 직결된 email/role 변경
-- 트리거라 의도적으로 그대로 둔다 — superadmin 전용 유지)

create or replace function issue_user_warning(target_user_id uuid, p_report_id uuid, p_reason text)
returns json as $$
declare
  new_count int;
  suspend_threshold int;
  suspend_days int;
  ban_threshold int;
  target_email text;
  auto_action text := null;
begin
  if not (is_admin() or is_designer()) then
    raise exception 'admin 이상만 경고를 부여할 수 있습니다';
  end if;

  insert into user_warnings (user_id, report_id, issued_by, reason)
  values (target_user_id, p_report_id, auth.uid(), p_reason);

  update profiles set warning_count = warning_count + 1
  where id = target_user_id
  returning warning_count, email into new_count, target_email;

  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'warn', 'profiles', target_user_id::text, jsonb_build_object('warning_count', new_count, 'reason', p_reason));

  select warning_suspend_threshold, warning_suspend_days, warning_ban_threshold
    into suspend_threshold, suspend_days, ban_threshold
    from site_settings where id = 'default';

  if new_count >= ban_threshold then
    perform internal_ban_user_by_email(target_email, '경고 누적(' || new_count || '회)으로 인한 영구 차단');
    auto_action := 'banned';
  elsif new_count >= suspend_threshold then
    update profiles set suspended_until = now() + (suspend_days || ' days')::interval where id = target_user_id;
    insert into audit_logs (user_id, action, target_table, target_id, after_data)
    values (auth.uid(), 'suspend', 'profiles', target_user_id::text, jsonb_build_object('days', suspend_days, 'reason', '경고 누적(' || new_count || '회)으로 인한 자동 정지'));
    auto_action := 'suspended';
  end if;

  return json_build_object('warning_count', new_count, 'auto_action', auto_action, 'suspend_days', suspend_days);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function revoke_user_warning(warning_id uuid)
returns void as $$
declare
  target_user_id uuid;
begin
  if not (is_admin() or is_designer()) then
    raise exception 'admin 이상만 경고를 철회할 수 있습니다';
  end if;

  select user_id into target_user_id from user_warnings where id = warning_id and revoked_at is null;
  if target_user_id is null then
    raise exception '철회할 수 있는 경고를 찾을 수 없습니다(이미 철회됐거나 존재하지 않음)';
  end if;

  update user_warnings set revoked_at = now(), revoked_by = auth.uid() where id = warning_id;
  update profiles set warning_count = greatest(0, warning_count - 1) where id = target_user_id;

  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'unwarn', 'profiles', target_user_id::text, jsonb_build_object('warning_id', warning_id));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function suspend_user(target_user_id uuid, days int, p_reason text)
returns void as $$
begin
  if not (is_admin() or is_designer()) then
    raise exception 'admin 이상만 계정을 정지할 수 있습니다';
  end if;
  update profiles set suspended_until = now() + (days || ' days')::interval where id = target_user_id;
  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'suspend', 'profiles', target_user_id::text, jsonb_build_object('days', days, 'reason', p_reason));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function unsuspend_user(target_user_id uuid)
returns void as $$
begin
  if not (is_admin() or is_designer()) then
    raise exception 'admin 이상만 정지를 해제할 수 있습니다';
  end if;
  update profiles set suspended_until = null where id = target_user_id;
  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'unsuspend', 'profiles', target_user_id::text, jsonb_build_object('reason', '관리자가 직접 정지 해제'));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function ban_user_permanently(target_user_id uuid, p_reason text)
returns void as $$
declare
  target_email text;
begin
  if not (is_admin() or is_designer()) then
    raise exception 'admin 이상만 계정을 차단할 수 있습니다';
  end if;
  select email into target_email from profiles where id = target_user_id;
  if target_email is null then
    raise exception '대상 계정을 찾을 수 없습니다';
  end if;
  perform internal_ban_user_by_email(target_email, p_reason);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function unban_user_permanently(target_user_id uuid)
returns void as $$
declare
  target_email text;
begin
  if not (is_admin() or is_designer()) then
    raise exception 'admin 이상만 차단을 해제할 수 있습니다';
  end if;
  select email into target_email from profiles where id = target_user_id;
  if target_email is null then
    raise exception '대상 계정을 찾을 수 없습니다';
  end if;

  update directory_members set is_allowed = true where email = target_email;

  if exists (select 1 from login_access_requests where email = target_email) then
    update login_access_requests
      set status = 'approved', decided_by = auth.uid(), decided_at = now()
      where email = target_email;
  end if;

  insert into audit_logs (user_id, action, target_table, target_id, after_data)
  values (auth.uid(), 'unban', 'directory_members', target_email, jsonb_build_object('reason', '관리자가 직접 차단 해제'));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function enforce_proposal_status_admin_only()
returns trigger as $$
begin
  if new.status is distinct from old.status and not (is_admin() or is_designer()) then
    raise exception '안건 상태 변경은 admin 이상만 할 수 있습니다';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ===== is_admin() 기반 RLS: admin 전용(=superadmin 전용 아닌) 정책만 OR is_designer() =====
alter policy board_comments_delete_own_or_admin on board_comments using ((auth.uid() = author_id) or is_admin() or is_designer());
alter policy board_posts_delete_own_or_admin on board_posts using ((auth.uid() = author_id) or is_admin() or is_designer());
alter policy meal_plans_write_admin on meal_plans using (is_admin() or is_designer()) with check (is_admin() or is_designer());
alter policy meal_plans_bucket_insert_admin on storage.objects with check (bucket_id = 'meal-plans' and (is_admin() or is_designer()));
alter policy meal_plans_bucket_update_admin on storage.objects using (bucket_id = 'meal-plans' and (is_admin() or is_designer()));
alter policy meal_plans_bucket_delete_admin on storage.objects using (bucket_id = 'meal-plans' and (is_admin() or is_designer()));
alter policy org_records_delete_own_or_admin on org_records using ((auth.uid() = author_id) or is_admin() or is_designer());
alter policy posts_delete_admin on posts using (is_admin() or is_designer());
alter policy proposals_delete_own_or_admin on proposals using ((auth.uid() = author_id) or is_admin() or is_designer());
alter policy questions_delete_admin on questions using (is_admin() or is_designer());
alter policy reports_update_admin on reports using (is_admin() or is_designer());
alter policy notifications_delete_admin on notifications using (is_admin() or is_designer());
alter policy user_warnings_insert_admin on user_warnings with check (is_admin() or is_designer());

-- reports/user_warnings는 designer의 조회 정책이 이미 있었지만(reports_select_designer),
-- user_warnings에는 없었다 — 신고 상세에서 대상자 경고 이력을 볼 수 있어야 하므로 추가.
create policy user_warnings_select_designer on user_warnings for select using (is_designer());

-- ===== is_editor_or_above() 기반 RLS: 일반 콘텐츠(공지/뉴스/일정/게시판/Q&A/규정/부서 등) =====
-- (badges_write_admin, user_badges_insert_staff는 /admin/badges 전용 기능이라 제외 — 그대로 유지)
alter policy answers_write_admin on answers with check (is_editor_or_above() or is_designer());
alter policy answers_update_editor on answers using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy attachments_write_admin on attachments using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy blocks_write_admin on blocks using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy board_comments_update_staff on board_comments using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy board_posts_update_own_or_staff on board_posts using ((auth.uid() = author_id) or is_editor_or_above() or is_designer());
alter policy events_write_admin on events using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy main_blocks_write_admin on main_blocks using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy members_write_admin on members using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy menus_write_admin on menus using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy notifications_write_admin on notifications with check (is_editor_or_above() or is_designer());
alter policy notifications_update_admin on notifications using (is_editor_or_above() or is_designer());
alter policy news_videos_delete_editor on storage.objects using (bucket_id = 'news-videos' and (is_editor_or_above() or is_designer()));
alter policy news_videos_insert_editor on storage.objects with check (bucket_id = 'news-videos' and (is_editor_or_above() or is_designer()));
alter policy news_videos_update_editor on storage.objects using (bucket_id = 'news-videos' and (is_editor_or_above() or is_designer()));
alter policy attachments_bucket_delete_editor on storage.objects using (bucket_id = 'attachments' and (is_editor_or_above() or is_designer()));
alter policy attachments_bucket_insert_editor on storage.objects with check (bucket_id = 'attachments' and (is_editor_or_above() or is_designer()));
alter policy attachments_bucket_update_editor on storage.objects using (bucket_id = 'attachments' and (is_editor_or_above() or is_designer()));
alter policy profile_photos_delete_self_or_editor on storage.objects using (bucket_id = 'profile-photos' and (is_editor_or_above() or is_designer() or (storage.foldername(name))[1] = auth.uid()::text));
alter policy profile_photos_insert_self_or_editor on storage.objects with check (bucket_id = 'profile-photos' and (is_editor_or_above() or is_designer() or (storage.foldername(name))[1] = auth.uid()::text));
alter policy profile_photos_update_self_or_editor on storage.objects using (bucket_id = 'profile-photos' and (is_editor_or_above() or is_designer() or (storage.foldername(name))[1] = auth.uid()::text));
alter policy org_records_insert_editor on org_records with check (is_editor_or_above() or is_org_activities_manager() or is_designer());
alter policy org_records_update_editor on org_records using (is_editor_or_above() or is_org_activities_manager() or is_designer()) with check (is_editor_or_above() or is_org_activities_manager() or is_designer());
alter policy organizations_write_admin on organizations using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy pages_write_admin on pages using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy posts_insert_editor on posts with check ((type = any (array['notice','news'])) and (is_editor_or_above() or is_designer()));
alter policy posts_update_editor on posts using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy questions_update_admin on questions using (is_editor_or_above() or is_designer());
alter policy rules_write_admin on rules using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());
alter policy student_subjects_write_staff on student_subjects using (is_editor_or_above() or is_designer()) with check (is_editor_or_above() or is_designer());

-- ------------------------------------------------------------
-- 70. 뱃지 자동 지급 조건에 "Q&A 처음 작성" 추가
-- ------------------------------------------------------------
-- 뱃지 자동 지급 조건에 "Q&A 처음 작성"을 추가한다. 기존 award_type은 auto(연속접속
-- 일수 도달)/date(날짜 조건)/manual(관리자 수동 부여)뿐이라, "특정 행동을 하면 서버가
-- 자동으로 지급"하는 부류를 위해 action을 새 award_type으로 추가한다. action 타입은
-- 뱃지마다 별도 코드(트리거)로 연결해야 해서 범용 설정 UI는 없고, 이 뱃지 전용
-- 트리거만 둔다.
alter table badges drop constraint badges_award_type_check;
alter table badges add constraint badges_award_type_check
  check (award_type = any (array['auto', 'manual', 'date', 'action']));

insert into badges (code, label, icon, description, award_type, order_index, is_active, is_secret)
values ('first_qna', '궁금한 게 많아요', '❓', 'Q&A에 처음 질문을 남기면 받는 뱃지입니다.', 'action', 9, true, false);

-- questions에 처음 글을 쓴 순간(그 사용자의 첫 질문일 때)에만 지급한다. user_badges의
-- unique(user_id, badge_id) + on conflict do nothing으로 중복 지급을 막고, celebrated는
-- 기본값(false)으로 남겨서 BadgeGrantWatcher(관리자가 뱃지를 직접 지급했을 때와 동일한
-- realtime 감지 경로)가 그 자리에서 축하 팝업을 띄우게 한다 — Q&A 작성 화면 쪽 코드는
-- 전혀 건드릴 필요가 없다.
create or replace function grant_first_qna_badge()
returns trigger as $$
declare
  v_badge_id uuid;
  v_question_count int;
begin
  select count(*) into v_question_count from questions where user_id = new.user_id;
  if v_question_count = 1 then
    select id into v_badge_id from badges where code = 'first_qna' and is_active = true;
    if v_badge_id is not null then
      insert into user_badges (user_id, badge_id)
      values (new.user_id, v_badge_id)
      on conflict (user_id, badge_id) do nothing;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_grant_first_qna_badge on questions;
create trigger trg_grant_first_qna_badge
  after insert on questions
  for each row execute function grant_first_qna_badge();

-- ------------------------------------------------------------
-- 71. 시크릿 뱃지를 시크릿/슈퍼시크릿 두 단계로 분리
-- ------------------------------------------------------------
-- 시크릿 뱃지를 두 단계로 나눈다: "시크릿"은 목록에 실루엣(그림자)으로 보이되 이름/조건은
-- 획득 전까지 가려지고, "슈퍼시크릿"은 기존 is_secret=true와 동일하게 획득 전까지 목록에서
-- 아예 안 보인다(존재 자체를 숨김). 기존 is_secret=true였던 뱃지는 "시크릿"으로 이관한다
-- (기존 동작보다 더 많이 노출되긴 하지만, 실루엣+이름/조건 숨김이라 정체는 여전히 안 보임).
alter table badges add column secret_tier text not null default 'none'
  check (secret_tier in ('none', 'secret', 'super_secret'));
update badges set secret_tier = 'secret' where is_secret = true;
alter table badges drop column is_secret;

-- ------------------------------------------------------------
-- 72. developer(superadmin) 권한은 아무도 새로 부여할 수 없고, 본인도 자기 role을 못 바꿈
-- ------------------------------------------------------------
-- developer(=superadmin) 권한은 이제 이 트리거를 거치는 어떤 경로(관리자 화면 포함)로도
-- 아무도 새로 부여할 수 없게 한다 — 부여는 DB에서 직접 해야 한다. 그리고 이미
-- superadmin인 계정은 본인 스스로 자기 role을 바꿀 수 없다(다른 developer가 바꿔주는
-- 것까지는 막지 않음 — 요건은 "본인 스스로"만).
create or replace function protect_profile_fields()
returns trigger as $$
begin
  if not is_admin() then
    new.email := old.email;
    new.role := old.role;
  elsif new.role <> old.role then
    if not is_superadmin() and new.role in ('admin', 'superadmin') then
      new.role := old.role;
    elsif new.role = 'superadmin' and old.role <> 'superadmin' then
      new.role := old.role;
    elsif old.role = 'superadmin' and auth.uid() = old.id then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------
-- 73. 구성원 조회 페이지 이스터에그 "미스터리 인물" + 셀프 클레임 뱃지
-- ------------------------------------------------------------
-- 구성원 조회 페이지에 숨어있는 "미스터리 인물" 이스터에그. 이 뱃지 하나(code='phantom_member')
-- 전용 기능이라 범용 컬럼/트리거가 아니라 이 코드에만 묶어서 구현한다.
-- easter_egg_names: 이 뱃지가 화면에 보여줄 후보 이름 목록(관리자가 여러 개 설정, 접속마다
-- 그 중 하나를 무작위로 고름). 다른 뱃지에는 의미 없는 값이라 기본값은 빈 배열.
alter table badges add column easter_egg_names text[] not null default '{}';

insert into badges (code, label, icon, description, award_type, secret_tier, order_index, is_active, easter_egg_names)
values (
  'phantom_member',
  '미스터리 인물',
  '👻',
  '구성원 조회 페이지에 숨어있는 미스터리 인물을 찾아 눌러보세요.',
  'action',
  'super_secret',
  10,
  true,
  array['가가가']
);

-- 학생이 미스터리 인물을 눌러 들어간 화면에서 "???" 버튼을 눌렀을 때 자기 자신에게 지급한다
-- (관리자 승인 없이 본인이 직접 획득하는 셀프 클레임 — 다른 action 뱃지처럼 서버 트리거가
-- 아니라 사용자의 명시적 클릭이 트리거라 RPC로 노출한다). 뱃지가 비활성화되면(admin이 끄면)
-- 더 이상 획득할 수 없다.
create or replace function claim_easter_egg_badge()
returns json as $$
declare
  v_badge_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select id into v_badge_id from badges where code = 'phantom_member' and is_active = true;
  if v_badge_id is null then
    raise exception '지금은 획득할 수 없는 뱃지입니다';
  end if;

  insert into user_badges (user_id, badge_id)
  values (auth.uid(), v_badge_id)
  on conflict (user_id, badge_id) do nothing;

  return json_build_object('badge_id', v_badge_id);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function claim_easter_egg_badge() to authenticated;

-- ------------------------------------------------------------
-- 74. 미스터리 인물 뱃지를 최초 5명 한정으로 제한 + developer는 모든 뱃지를 항상 보유
-- ------------------------------------------------------------
-- "넌 누구야"(phantom_member) 뱃지를 최초 발견한 5명에게만 지급하고, 5명이 채워지면
-- 자동으로 비활성화(=미스터리 인물도 함께 사라짐)한다. developer(superadmin)는 실제로
-- 지급하지 않고(진짜 user_badges 행을 만들지 않음) 그 대신 화면에서 항상 "가진 것"으로
-- 표시되므로(mypage 쪽 처리), 5명 정원 계산에도 전혀 영향을 주지 않는다.
create or replace function claim_easter_egg_badge()
returns json as $$
declare
  v_badge_id uuid;
  v_is_developer boolean;
  v_holder_count int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select id into v_badge_id from badges where code = 'phantom_member' and is_active = true;
  if v_badge_id is null then
    raise exception '지금은 획득할 수 없는 뱃지입니다';
  end if;

  select (role = 'superadmin') into v_is_developer from profiles where id = auth.uid();
  if v_is_developer then
    return json_build_object('badge_id', v_badge_id, 'developer', true);
  end if;

  select count(*) into v_holder_count
    from user_badges ub join profiles p on p.id = ub.user_id
    where ub.badge_id = v_badge_id and p.role <> 'superadmin';
  if v_holder_count >= 5 then
    update badges set is_active = false where id = v_badge_id;
    raise exception '이미 정원(5명)이 마감된 뱃지입니다';
  end if;

  insert into user_badges (user_id, badge_id)
  values (auth.uid(), v_badge_id)
  on conflict (user_id, badge_id) do nothing;

  select count(*) into v_holder_count
    from user_badges ub join profiles p on p.id = ub.user_id
    where ub.badge_id = v_badge_id and p.role <> 'superadmin';
  if v_holder_count >= 5 then
    update badges set is_active = false where id = v_badge_id;
  end if;

  return json_build_object('badge_id', v_badge_id);
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------
-- 75. 뱃지 달성 조건 문구를 관리자가 직접 입력할 수 있게 함
-- ------------------------------------------------------------
-- 뱃지 달성 조건 문구를 관리자가 직접 자유롭게 입력할 수 있게 한다(description=설명과는
-- 별개). 비어있으면 기존처럼 award_type별 자동 문구(auto=연속 N일, date=날짜 조건,
-- manual/action=관리자 확인 후 지급)를 그대로 쓴다.
alter table badges add column condition_text text;

update badges set condition_text = 'Q&A에 질문하기' where code = 'first_qna';

-- ------------------------------------------------------------
-- 76. "소통하는 사람" 뱃지: 게시판 첫 글 또는 첫 댓글
-- ------------------------------------------------------------
-- "소통하는 사람" 뱃지: 게시판에 처음 글을 쓰거나 처음 댓글을 달면(둘 중 먼저 오는 쪽)
-- 지급한다. board_posts/board_comments 양쪽에 각각 트리거를 두고, 두 트리거 모두
-- 같은 뱃지를 on conflict do nothing으로 지급하므로 어느 쪽이 먼저 오든 중복 없이 1회만
-- 지급된다.
insert into badges (code, label, icon, description, award_type, secret_tier, order_index, is_active, condition_text)
values (
  'first_board_activity',
  '소통하는 사람',
  '💬',
  '게시판에 처음 글을 쓰거나 처음 댓글을 달면 받는 뱃지입니다.',
  'action',
  'none',
  11,
  true,
  '게시판에 첫 글 또는 첫 댓글 작성'
);

create or replace function grant_first_board_activity_badge()
returns trigger as $$
declare
  v_badge_id uuid;
  v_post_count int;
  v_comment_count int;
begin
  select count(*) into v_post_count from board_posts where author_id = new.author_id;
  select count(*) into v_comment_count from board_comments where author_id = new.author_id;
  if (tg_table_name = 'board_posts' and v_post_count = 1) or (tg_table_name = 'board_comments' and v_comment_count = 1) then
    select id into v_badge_id from badges where code = 'first_board_activity' and is_active = true;
    if v_badge_id is not null then
      insert into user_badges (user_id, badge_id)
      values (new.author_id, v_badge_id)
      on conflict (user_id, badge_id) do nothing;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_grant_first_board_post_badge on board_posts;
create trigger trg_grant_first_board_post_badge
  after insert on board_posts
  for each row execute function grant_first_board_activity_badge();

drop trigger if exists trg_grant_first_board_comment_badge on board_comments;
create trigger trg_grant_first_board_comment_badge
  after insert on board_comments
  for each row execute function grant_first_board_activity_badge();

-- ------------------------------------------------------------
-- 77. "탐험가" 뱃지: 사이트 7개 주요 메뉴를 전부 방문
-- ------------------------------------------------------------
-- "탐험가" 뱃지: 사이트의 7개 주요 메뉴(공지사항/뉴스/일정/생활규정/Q&A/게시판/구성원)를
-- 한 번씩 다 방문하면 지급한다. 방문 기록 자체를 남길 DB 이벤트가 없으므로(페이지
-- 조회는 insert/update가 아님), 클라이언트가 각 페이지에서 mark_page_visited()를
-- 직접 호출해 방문을 기록하고, 7개가 다 채워지면 이 함수 안에서 뱃지를 지급한다.
create table user_page_visits (
  user_id uuid not null references profiles(id) on delete cascade,
  page_key text not null,
  visited_at timestamptz not null default now(),
  primary key (user_id, page_key)
);

alter table user_page_visits enable row level security;
create policy user_page_visits_select_self on user_page_visits for select using (auth.uid() = user_id);

insert into badges (code, label, icon, description, award_type, secret_tier, order_index, is_active, condition_text)
values (
  'explorer',
  '탐험가',
  '🧭',
  '사이트의 모든 메뉴를 한 번씩 방문하면 받는 뱃지입니다.',
  'action',
  'none',
  12,
  true,
  '공지사항·뉴스·일정·생활규정·Q&A·게시판·구성원 전부 방문'
);

create or replace function mark_page_visited(p_page_key text)
returns void as $$
declare
  v_badge_id uuid;
  v_visited_count int;
  required_pages text[] := array['notices', 'news', 'calendar', 'rules', 'qna', 'board', 'members'];
begin
  if auth.uid() is null then
    return;
  end if;
  if not (p_page_key = any(required_pages)) then
    return;
  end if;

  insert into user_page_visits (user_id, page_key)
  values (auth.uid(), p_page_key)
  on conflict (user_id, page_key) do nothing;

  select count(distinct page_key) into v_visited_count
    from user_page_visits
    where user_id = auth.uid() and page_key = any(required_pages);

  if v_visited_count >= array_length(required_pages, 1) then
    select id into v_badge_id from badges where code = 'explorer' and is_active = true;
    if v_badge_id is not null then
      insert into user_badges (user_id, badge_id)
      values (auth.uid(), v_badge_id)
      on conflict (user_id, badge_id) do nothing;
    end if;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function mark_page_visited(text) to authenticated;

-- ------------------------------------------------------------
-- 78. 메인화면 편집기에 1/2 너비를 추가하기 위해 6칸 기준 그리드로 이관
-- ------------------------------------------------------------
-- 메인화면 편집기에 1/2 너비를 추가하려면 기존 3칸 기준(1/3=1, 2/3=2, 전체=3) 그리드로는
-- 1/2를 표현할 수 없다(1.5칸이 됨). 2와 3의 최소공배수인 6칸 기준으로 옮겨서
-- 1/3=2, 1/2=3, 2/3=4, 전체=6으로 전부 정수로 표현되게 한다. 기존 값(1/2/3)에
-- 그대로 2를 곱하면 같은 비율을 유지한 채 6칸 기준으로 이관된다.
alter table main_blocks drop constraint main_blocks_col_span_check;
update main_blocks set col_span = col_span * 2;
alter table main_blocks add constraint main_blocks_col_span_check check (col_span >= 1 and col_span <= 6);

-- 79. "사이트 첫 방문" 뱃지 추가 (목록 맨 앞)
-- ------------------------------------------------------------
-- streak_threshold=1인 auto 뱃지 — checkMilestones가 이미 "연속 접속일 >= streak_threshold"를
-- 기준으로 지급하므로, 1로 두면 첫 체크인(연속 접속 1일째) 시점에 별도 코드 없이 그대로
-- 지급된다. order_index=0으로 두어 secret_tier가 같은(none) 다른 뱃지들보다 항상 앞에 오게 한다.
insert into badges (code, label, description, icon, award_type, streak_threshold, order_index, is_active, secret_tier, condition_text)
values ('first_visit', '사이트 첫 방문', '사이트에 처음 방문해 접속 기록을 남김', '👋', 'auto', 1, 0, true, 'none', '사이트 첫 방문');
