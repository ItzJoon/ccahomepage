-- ============================================================
-- Supabase Storage: 첨부파일 버킷 및 접근 정책
-- schema.sql 실행 후, Supabase SQL Editor에서 실행하세요.
-- (버킷 자체는 대시보드 Storage 메뉴에서 만들어도 되지만, 아래 SQL로 한 번에 생성 가능합니다)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 공개 읽기: 누구나 첨부파일 다운로드 가능 (학생용 사이트에서 로그인 없이도 열람)
create policy "attachments_bucket_public_read"
on storage.objects for select
using (bucket_id = 'attachments');

-- 업로드: editor 이상만 가능
create policy "attachments_bucket_insert_editor"
on storage.objects for insert
with check (
  bucket_id = 'attachments'
  and public.is_editor_or_above()
);

-- 수정/삭제: editor 이상만 가능
create policy "attachments_bucket_update_editor"
on storage.objects for update
using (bucket_id = 'attachments' and public.is_editor_or_above());

create policy "attachments_bucket_delete_editor"
on storage.objects for delete
using (bucket_id = 'attachments' and public.is_editor_or_above());

-- 프로필 사진 버킷 (구성원 프로필 이미지용, 선택)
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "profile_photos_public_read"
on storage.objects for select
using (bucket_id = 'profile-photos');

create policy "profile_photos_insert_editor"
on storage.objects for insert
with check (bucket_id = 'profile-photos' and public.is_editor_or_above());

create policy "profile_photos_update_editor"
on storage.objects for update
using (bucket_id = 'profile-photos' and public.is_editor_or_above());

create policy "profile_photos_delete_editor"
on storage.objects for delete
using (bucket_id = 'profile-photos' and public.is_editor_or_above());
