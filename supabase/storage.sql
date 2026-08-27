-- ============================================================
-- Supabase Storage: 첨부파일 버킷 및 접근 정책
-- schema.sql 실행 후, Supabase SQL Editor에서 실행하세요.
-- (버킷 자체는 대시보드 Storage 메뉴에서 만들어도 되지만, 아래 SQL로 한 번에 생성 가능합니다)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 공개 읽기: 누구나 첨부파일 다운로드 가능 (학생용 사이트에서 로그인 없이도 열람)
drop policy if exists "attachments_bucket_public_read" on storage.objects;
create policy "attachments_bucket_public_read"
on storage.objects for select
using (bucket_id = 'attachments');

-- 업로드: editor 이상만 가능
drop policy if exists "attachments_bucket_insert_editor" on storage.objects;
create policy "attachments_bucket_insert_editor"
on storage.objects for insert
with check (
  bucket_id = 'attachments'
  and public.is_editor_or_above()
);

-- 수정/삭제: editor 이상만 가능
drop policy if exists "attachments_bucket_update_editor" on storage.objects;
create policy "attachments_bucket_update_editor"
on storage.objects for update
using (bucket_id = 'attachments' and public.is_editor_or_above());

drop policy if exists "attachments_bucket_delete_editor" on storage.objects;
create policy "attachments_bucket_delete_editor"
on storage.objects for delete
using (bucket_id = 'attachments' and public.is_editor_or_above());

-- 프로필 사진 버킷 (구성원 프로필 이미지 + 기능2: 마이페이지 개인 프로필 사진)
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read"
on storage.objects for select
using (bucket_id = 'profile-photos');

-- 기존에 storage.sql을 이미 실행한 DB라면 아래 구 정책이 남아있으므로 먼저 제거합니다.
drop policy if exists "profile_photos_insert_editor" on storage.objects;
drop policy if exists "profile_photos_update_editor" on storage.objects;
drop policy if exists "profile_photos_delete_editor" on storage.objects;

-- 학생 본인은 자기 user_id 폴더(`{user_id}/파일명`)에만 업로드/수정/삭제 가능,
-- editor 이상은 구성원 카드용 사진 등 폴더 제한 없이 관리 가능.
drop policy if exists "profile_photos_insert_self_or_editor" on storage.objects;
create policy "profile_photos_insert_self_or_editor"
on storage.objects for insert
with check (
  bucket_id = 'profile-photos'
  and (public.is_editor_or_above() or (storage.foldername(name))[1] = auth.uid()::text)
);

drop policy if exists "profile_photos_update_self_or_editor" on storage.objects;
create policy "profile_photos_update_self_or_editor"
on storage.objects for update
using (
  bucket_id = 'profile-photos'
  and (public.is_editor_or_above() or (storage.foldername(name))[1] = auth.uid()::text)
);

drop policy if exists "profile_photos_delete_self_or_editor" on storage.objects;
create policy "profile_photos_delete_self_or_editor"
on storage.objects for delete
using (
  bucket_id = 'profile-photos'
  and (public.is_editor_or_above() or (storage.foldername(name))[1] = auth.uid()::text)
);
