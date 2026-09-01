"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 관리자가 다른 관리 화면에서 나(로그인한 본인)를 정지/영구차단시키는 순간, 새로고침
 * 없이 즉시 차단되도록 감시하는 컴포넌트. 실제 차단 로직(정지 중/영구차단 판정, /suspended
 * 또는 /access-restricted로 보내는 것)은 이미 middleware.ts가 서버 요청마다 하고 있으므로
 * 여기서 그 판정을 다시 구현하지 않고, 상태가 바뀐 걸 감지하면 그냥 페이지를 다시 불러와서
 * (window.location.href) middleware를 다시 타게 만든다.
 */
export default function SuspensionWatcher({ userId, email }: { userId: string; email: string }) {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Realtime 구독 전에 세션 토큰을 반영해야 RLS를 통과한다(다른 realtime 훅과 동일한
      // 이유 — useRealtimeList.ts 참고).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`suspension_watch_${userId}_${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            const row = payload.new as { suspended_until: string | null };
            if (row.suspended_until && new Date(row.suspended_until).getTime() > Date.now()) {
              window.location.href = "/";
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "directory_members", filter: `email=eq.${email}` },
          (payload) => {
            const row = payload.new as { is_allowed: boolean };
            if (!row.is_allowed) {
              window.location.href = "/";
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, email]);

  return null;
}
