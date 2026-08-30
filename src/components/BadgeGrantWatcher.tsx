"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BadgeCelebration from "@/components/BadgeCelebration";
import type { BadgeDef } from "@/lib/types";

/**
 * 관리자가 뱃지를 직접 지급하면 그 학생 화면에 즉시 축하 팝업을 띄운다.
 * NotificationBanner(관리자 알림 배너)와 완전히 같은 구조로 만들었다 — INSERT
 * payload를 그대로 읽어 그 자리에서 바로 렌더링하고, badges 정의는 마운트 시
 * 한 번 캐시해둬서(badgesRef) 평소엔 추가 네트워크 왕복 없이 즉시 뜬다.
 *
 * 예전엔 이 기능이 useBadges -> useAutoCheckIn -> Header로 이어지는 훅 체인을
 * 거쳐서 렌더링됐는데, 그 중계 단계마다 React 렌더/이펙트 사이클이 하나씩 더
 * 끼면서 알림 배너보다 체감이 느렸다. 이 컴포넌트는 그 중계 없이 독립적으로
 * 구독하고 바로 렌더링한다(자기 스스로 획득한 연속접속/날짜 조건 뱃지 축하는
 * 여전히 useAutoCheckIn 쪽에서 처리 — 그건 realtime 없이 즉시 로컬에서 처리되는
 * 별개의 경로라 이 지연 문제와 무관함).
 */
export default function BadgeGrantWatcher({ userId }: { userId: string | null }) {
  const [queue, setQueue] = useState<BadgeDef[]>([]);
  const badgesRef = useRef<BadgeDef[]>([]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("badges")
      .select("*")
      .then(({ data }) => {
        if (!cancelled) badgesRef.current = (data as BadgeDef[]) ?? [];
      });

    const resolveBadge = async (badgeId: string): Promise<BadgeDef | null> => {
      const cached = badgesRef.current.find((b) => b.id === badgeId);
      if (cached) return cached;
      // badges 캐시가 아직 안 불러와진 드문 경우에만 개별 조회한다(평소엔 0회 왕복).
      const { data } = await supabase.from("badges").select("*").eq("id", badgeId).single();
      return (data as BadgeDef) ?? null;
    };

    const push = (badge: BadgeDef) => {
      setQueue((prev) => (prev.some((b) => b.id === badge.id) ? prev : [...prev, badge]));
      supabase.rpc("mark_badges_celebrated", { target_badge_ids: [badge.id] });
    };

    const channel = supabase
      .channel(`badge_grant_watch_${userId}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_badges" }, async (payload) => {
        const row = payload.new as { user_id: string; badge_id: string; celebrated: boolean };
        if (row.user_id !== userId || row.celebrated) return;
        const badge = await resolveBadge(row.badge_id);
        if (badge) push(badge);
      })
      .subscribe();

    // 접속 중이 아닐 때 지급됐거나 실시간 이벤트를 놓친 경우를 대비한 안전망
    // (접속 시 즉시 1회 + 20초 주기 재확인 — 위 실시간 경로가 정상 동작하면
    // 이 폴링이 돌기 전에 이미 떠 있다).
    const checkPending = async () => {
      const { data: rows } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId)
        .eq("celebrated", false);
      if (cancelled || !rows || rows.length === 0) return;
      for (const r of rows) {
        const badge = await resolveBadge(r.badge_id);
        if (!cancelled && badge) push(badge);
      }
    };
    checkPending();
    const interval = setInterval(checkPending, 20000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId]);

  const current = queue[0] ?? null;
  if (!current) return null;
  return <BadgeCelebration badge={current} onClose={() => setQueue((q) => q.slice(1))} />;
}
