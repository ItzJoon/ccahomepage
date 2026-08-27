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
  role text not null default 'student' check (role in ('student','editor','admin','superadmin')),
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

alter table attachments
  add constraint attachments_rule_fk foreign key (rule_id) references rules(id) on delete cascade;
alter table attachments
  add constraint attachments_event_fk foreign key (event_id) references events(id) on delete cascade;

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

-- profiles: 본인 열람/수정, 관리자는 전체 열람, superadmin만 role 변경(앱 로직에서 별도 제한 권장)
create policy "profiles_select_self_or_admin" on profiles for select
  using (auth.uid() = id or is_admin());
create policy "profiles_update_self" on profiles for update
  using (auth.uid() = id);
-- admin/superadmin은 다른 사용자의 role을 변경할 수 있음 (회원·권한 관리 화면에서 사용)
create policy "profiles_update_admin" on profiles for update
  using (is_admin());

-- 공개 콘텐츠(조직/구성원/일정/규정/발행된 게시물): 누구나 열람, 관리자만 쓰기
create policy "organizations_read_all" on organizations for select using (true);
create policy "organizations_write_admin" on organizations for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "members_read_all" on members for select using (true);
create policy "members_write_admin" on members for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "posts_read_published" on posts for select
  using (status = 'published' or is_editor_or_above());
create policy "posts_write_admin" on posts for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "attachments_read_all" on attachments for select using (true);
create policy "attachments_write_admin" on attachments for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "events_read_all" on events for select using (true);
create policy "events_write_admin" on events for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "rules_read_all" on rules for select using (true);
create policy "rules_write_admin" on rules for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "pages_read_published" on pages for select using (is_published or is_editor_or_above());
create policy "pages_write_admin" on pages for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "menus_read_all" on menus for select using (true);
create policy "menus_write_admin" on menus for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "blocks_read_all" on blocks for select using (true);
create policy "blocks_write_admin" on blocks for all using (is_editor_or_above()) with check (is_editor_or_above());

create policy "main_blocks_read_all" on main_blocks for select using (true);
create policy "main_blocks_write_admin" on main_blocks for all using (is_editor_or_above()) with check (is_editor_or_above());

-- 알림: 누구나 열람, 관리자만 발송
create policy "notifications_read_all" on notifications for select using (true);
create policy "notifications_write_admin" on notifications for insert with check (is_editor_or_above());

-- Q&A: 공개 질문은 누구나, 비공개 질문은 작성자 본인 + 관리자만. 로그인 사용자는 질문 작성 가능
create policy "questions_read" on questions for select
  using (is_private = false or auth.uid() = user_id or is_admin());
create policy "questions_insert_own" on questions for insert
  with check (auth.uid() = user_id);
create policy "questions_update_admin" on questions for update
  using (is_admin());

create policy "answers_read" on answers for select
  using (
    exists (
      select 1 from questions q
      where q.id = question_id
      and (q.is_private = false or q.user_id = auth.uid() or is_admin())
    )
  );
create policy "answers_write_admin" on answers for insert with check (is_admin());

-- 접속 기록: 본인 것만 읽기/쓰기, 관리자는 전체 열람(집계용)
create policy "attendance_select_self_or_admin" on user_attendance for select
  using (auth.uid() = user_id or is_admin());
create policy "attendance_upsert_self" on user_attendance for insert
  with check (auth.uid() = user_id);
create policy "attendance_update_self" on user_attendance for update
  using (auth.uid() = user_id);

-- 감사 로그: 관리자만 열람, 시스템(서버)에서 기록
create policy "audit_logs_admin_read" on audit_logs for select using (is_admin());
create policy "audit_logs_insert_admin" on audit_logs for insert with check (is_editor_or_above());

-- ============================================================
-- Realtime 발행 (관리자 변경 → 학생 화면 즉시 반영에 사용)
-- ============================================================
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table questions;
alter publication supabase_realtime add table answers;
alter publication supabase_realtime add table organizations;
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table rules;
alter publication supabase_realtime add table pages;
alter publication supabase_realtime add table main_blocks;
alter publication supabase_realtime add table attachments;
alter publication supabase_realtime add table profiles;

-- ============================================================
-- 기능 추가분 (기존 DB에 반영하려면 이 블록만 실행해도 됩니다. 전체 재실행도 안전합니다)
-- ============================================================

-- ------------------------------------------------------------
-- 기능 2. 마이페이지 프로필 설정
-- ------------------------------------------------------------
alter table profiles add column if not exists nickname text;
alter table profiles add column if not exists bio text;

-- 학생이 본인 profiles row를 수정할 때 email/role은 절대 바뀌지 않도록 트리거로 강제.
-- (RLS의 USING 절만으로는 UPDATE 시 "새 값"을 막지 못하므로 이중 방어 차원의 트리거)
create or replace function protect_profile_fields()
returns trigger as $$
begin
  if not is_admin() then
    new.email := old.email;
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists before_profile_update on profiles;
create trigger before_profile_update
  before update on profiles
  for each row execute procedure protect_profile_fields();

