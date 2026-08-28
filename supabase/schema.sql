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
-- 역할이다. 기존 DB는 role 컬럼에 이미 CHECK 제약이 걸려 있으므로 다시 만든다.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('student','teacher','editor','admin','superadmin'));

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
