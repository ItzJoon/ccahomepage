"use client";

import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import type { SiteRestriction } from "@/lib/types";

function nowKstHM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/**
 * 사이트 제한(/admin/site-restrictions)이 지금 이 학생 계정에 적용되는지 화면단에서
 * 판단한다. 실제 차단은 RLS(각 테이블의 insert with check에 is_student_restricted_now()가
 * 들어가 있음, supabase/schema.sql 92번 참고)가 최종적으로 보장하므로, 이 훅은 그 전에
 * 버튼을 숨기지 않고도 친절한 안내 메시지를 보여주기 위한 용도다 — 서버 함수와 같은
 * 조건(role='student' + 설정된 시간대)을 클라이언트에서 다시 계산한다.
 */
export function useWriteRestriction() {
  const { role } = useMyRole();
  const { rows } = useRealtimeList<SiteRestriction>("site_restrictions", {
    filter: (q) => q.eq("id", "default"),
  });
  const restriction = rows[0];
  const activeWindow = restriction?.is_enabled
    ? restriction.windows.find((w) => {
        const now = nowKstHM();
        return now >= w.start && now <= w.end;
      })
    : undefined;

  const isRestricted = role === "student" && !!activeWindow;
  const message = activeWindow
    ? `현재 수업시간이라 글쓰기가 제한되어 있어요 (제한 시간: ${activeWindow.label ? `${activeWindow.label} ` : ""}${activeWindow.start}~${activeWindow.end})`
    : "";

  return { isRestricted, message };
}
