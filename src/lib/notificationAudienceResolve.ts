import { createClient } from "@/lib/supabase/client";

const HOMEROOM_LABEL: Record<string, string> = { "1": "샬롬", "2": "헤세드", "3": "토브" };

export type NotifyAudience =
  | { mode: "all" }
  | { mode: "grades"; grades: string[] }
  | { mode: "homerooms"; classes: { grade: string; homeroom: number }[] }
  | { mode: "custom"; emails: string[] };

/**
 * 배너·팝업 알림의 발송 대상을 실제 이메일 목록으로 계산한다. 공지사항 이메일 발송의
 * resolveAudience(src/lib/email/sendNoticeNotification.ts)와 같은 개념이지만, 그쪽은
 * 서버 전용(service role) 모듈이라 "use client" 화면(관리자 발송 폼)에서 그대로 가져다
 * 쓸 수 없어 클라이언트에서 안전하게 쓸 수 있는 버전을 별도로 둔다 — 관리자 본인
 * 세션으로 directory_members를 조회하는데, 이 테이블은 로그인한 사용자 전체에게 조회가
 * 열려있어(RLS: auth.uid() is not null) 문제없다.
 *
 * all 모드는 emails를 null로 반환한다 — "전체 공개"는 목록을 나열하는 대신 null로 표현해서
 * (학교 인원이 나중에 늘어나도) 항상 정확하다.
 */
export async function resolveNotifyAudience(
  audience: NotifyAudience
): Promise<{ emails: string[] | null; description: string }> {
  const supabase = createClient();

  if (audience.mode === "all") {
    return { emails: null, description: "전체 학생/교사" };
  }

  if (audience.mode === "grades") {
    const { data } = await supabase
      .from("directory_members")
      .select("email")
      .eq("member_type", "student")
      .eq("is_allowed", true)
      .in("grade", audience.grades);
    const emails = Array.from(new Set((data ?? []).map((m) => m.email)));
    return { emails, description: `${audience.grades.join(", ")}학년` };
  }

  if (audience.mode === "homerooms") {
    if (audience.classes.length === 0) return { emails: [], description: "선택된 학급 없음" };
    const orFilter = audience.classes.map((c) => `and(grade.eq.${c.grade},homeroom.eq.${c.homeroom})`).join(",");
    const { data } = await supabase
      .from("directory_members")
      .select("email")
      .eq("member_type", "student")
      .eq("is_allowed", true)
      .or(orFilter);
    const emails = Array.from(new Set((data ?? []).map((m) => m.email)));
    const labels = audience.classes.map((c) => `${c.grade}학년 ${HOMEROOM_LABEL[String(c.homeroom)] ?? `${c.homeroom}반`}`).join(", ");
    return { emails, description: labels };
  }

  // custom
  const emails = Array.from(new Set(audience.emails.map((e) => e.trim()).filter((e) => e.includes("@"))));
  return { emails, description: "직접 입력한 이메일 주소" };
}
