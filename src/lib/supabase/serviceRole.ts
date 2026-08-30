import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * RLS를 완전히 우회하는 서비스 롤 클라이언트. 이메일 발송 대상(교과/학급 공지 대상자 등)을
 * 계산하려면 여러 학생의 profiles/student_subjects/directory_members를 한꺼번에 조회해야
 * 하는데, 일반 RLS로는 본인 것만 보여서 불가능하다. 반드시 서버(Route Handler 등)에서만
 * 만들어 쓰고, 클라이언트 번들에 절대 포함되면 안 된다 — SUPABASE_SERVICE_ROLE_KEY는
 * NEXT_PUBLIC_ 접두어가 없어 서버에서만 읽힌다.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
