import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "https://.../storage/v1/object/public/<bucket>/uid/file.png" 형태의 공개 URL에서
 * 버킷 내부 경로("uid/file.png")만 뽑아낸다. 알림/패치노트에 첨부된 이미지·사운드
 * 파일을 행 삭제/교체/노출 종료 시 정리할 때 공통으로 쓴다.
 */
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

/** publicUrl이 없으면 아무 것도 하지 않는다(항상 안전하게 호출 가능). */
export async function removeStorageFile(
  supabase: SupabaseClient,
  bucket: string,
  publicUrl: string | null | undefined
) {
  if (!publicUrl) return;
  const path = extractStoragePath(publicUrl, bucket);
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}
