"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";
import { preloadBadgeSoundOverrides } from "@/lib/badgeSound";
import type { BadgeDef } from "@/lib/types";

/**
 * 뱃지 정의(badges) + 내가 획득한 뱃지(user_badges)를 관리하는 훅.
 * 체크인 후 checkMilestones(streak)를 호출하면 새로 조건을 만족한 뱃지를 자동 지급합니다.
 */
export function useBadges(userId: string | null) {
  const supabase = createClient();
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  // Header(useAutoCheckIn)와 마이페이지가 동시에 useBadges를 호출하면 같은 사용자에 대해
  // 채널이 두 번 생기는데, 이름이 겹치면 realtime 구독끼리 충돌한다(useRealtimeList와 동일 문제).
  // 인스턴스마다 고유한 채널 이름을 쓰도록 랜덤값을 섞는다.
  const channelSuffixRef = useRef(Math.random().toString(36).slice(2));

  const load = useCallback(async () => {
    // secret_tier는 문자열값이 마침 "none" < "secret" < "super_secret" 알파벳 순서와
    // 정확히 일치해서, 오름차순 정렬만으로 시크릿은 뒤로, 슈퍼시크릿은 더 뒤로 보낼 수
    // 있다 — 그 안에서는 기존처럼 streak_threshold 기준으로 정렬한다.
    const { data: badgeRows } = await supabase
      .from("badges")
      .select("*")
      .eq("is_active", true)
      .order("secret_tier", { ascending: true })
      .order("streak_threshold", { ascending: true });
    setBadges((badgeRows as BadgeDef[]) ?? []);
    if (badgeRows) preloadBadgeSoundOverrides(badgeRows as BadgeDef[]);

    if (userId) {
      const { data: earned } = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
      setEarnedIds(new Set((earned ?? []).map((e) => e.badge_id)));
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 관리자가 뱃지를 지급/회수했을 때 마이페이지 등의 보유 뱃지 목록이 새로고침 없이
   * 최신 상태를 반영하도록 earnedIds만 동기화한다. 축하 팝업 자체는 이제 이 훅을 거치지
   * 않고 BadgeGrantWatcher(NotificationBanner와 동일한 구조의 독립 컴포넌트)가 전담한다 —
   * 예전엔 useBadges -> useAutoCheckIn -> Header로 이어지는 훅 체인을 거쳐 렌더링됐는데,
   * 그 중계 단계마다 렌더/이펙트 사이클이 하나씩 더 끼면서 알림 배너보다 체감이 느렸다.
   */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      // BadgeGrantWatcher와 동일한 이유로, 구독 전에 세션 토큰을 realtime에 명시적으로
      // 반영해야 한다 — 안 그러면 마운트 직후엔 아직 미인증 상태로 구독돼 RLS를 통과 못 하고
      // 그 뒤로 이 유저의 user_badges 변경을 계속 못 받는다(새로고침 전까지 실시간 반영 안 됨).
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`user_badges_earned_sync_${userId}_${channelSuffixRef.current}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_badges" }, (payload) => {
          const row = payload.new as { user_id: string; badge_id: string };
          if (row.user_id !== userId) return;
          setEarnedIds((prev) => (prev.has(row.badge_id) ? prev : new Set([...prev, row.badge_id])));
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "user_badges" }, (payload) => {
          const row = payload.old as { user_id?: string; badge_id?: string };
          if (row.user_id !== userId || !row.badge_id) return;
          const badgeId = row.badge_id;
          setEarnedIds((prev) => {
            if (!prev.has(badgeId)) return prev;
            const next = new Set(prev);
            next.delete(badgeId);
            return next;
          });
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  /** 오늘 날짜가 뱃지의 날짜 조건(이전/이후/당일/기간)을 만족하는지 확인합니다. */
  const matchesDateCondition = (b: BadgeDef, today: string) => {
    if (!b.date_condition || !b.date_condition_value) return false;
    if (b.date_condition === "before") return today < b.date_condition_value;
    if (b.date_condition === "after") return today > b.date_condition_value;
    if (b.date_condition === "between") {
      if (!b.date_condition_value_end) return false;
      return today >= b.date_condition_value && today <= b.date_condition_value_end;
    }
    return today === b.date_condition_value;
  };

  /**
   * 아직 못 받은 뱃지 중 조건을 만족하는 것들을 실제로 지급합니다(공용 로직). 지급 즉시 호출한
   * 쪽에서 축하 팝업을 보여줄 것이므로 celebrated=true로 기록한다.
   *
   * earnedIds는 useBadges가 아직 로딩 중일 때 호출되면(예: 체크인 직후 badges 목록이 채 안
   * 불러와진 시점) 오래된 값일 수 있어, 이미 보유한 뱃지를 "새로 획득"으로 잘못 판단할 수 있다.
   * 그래서 일반 insert 대신 `on conflict (user_id, badge_id) do nothing` + `.select()`를 써서,
   * DB에 실제로 새로 들어간 행만 결과로 받는다 — 이미 있던 뱃지는 조용히 무시되고(에러도 안 남),
   * 그 뱃지에 대한 축하 팝업도 뜨지 않는다(이미 받은 뱃지가 재접속 때마다 다시 축하되는 버그 방지).
   */
  const grant = useCallback(
    async (toGrant: BadgeDef[]) => {
      if (!userId || toGrant.length === 0) return [];
      const { data, error } = await supabase
        .from("user_badges")
        .upsert(
          toGrant.map((b) => ({ user_id: userId, badge_id: b.id, celebrated: true })),
          { onConflict: "user_id,badge_id", ignoreDuplicates: true }
        )
        .select("badge_id");
      if (error || !data) return [];
      const insertedIds = new Set(data.map((r) => r.badge_id));
      const actuallyGranted = toGrant.filter((b) => insertedIds.has(b.id));
      if (actuallyGranted.length > 0) {
        setEarnedIds((prev) => new Set([...prev, ...actuallyGranted.map((b) => b.id)]));
      }
      return actuallyGranted;
    },
    [userId, supabase]
  );

  /** 새로 달성한 스트릭 값을 기준으로, 아직 못 받은 연속 접속 뱃지가 있으면 지급하고 반환합니다. */
  const checkMilestones = useCallback(
    async (streak: number) => {
      if (!userId) return [];
      const newlyEarned = badges.filter(
        (b) => b.award_type === "auto" && !earnedIds.has(b.id) && b.streak_threshold !== null && b.streak_threshold <= streak
      );
      return grant(newlyEarned);
    },
    [userId, badges, earnedIds, grant]
  );

  /**
   * 오늘 날짜를 기준으로 날짜 조건 뱃지를 확인해 지급합니다. 연속 접속과 달리 "새 체크인" 이벤트에
   * 묶여있지 않고 로그인해서 사이트에 들어오기만 하면 되는 조건이라, 이미 오늘 체크인을 마친
   * 사용자(예: 뱃지가 생기기 전에 먼저 접속했던 사용자)도 다시 접속할 때마다 평가되어야 한다.
   */
  const checkDateBadges = useCallback(async () => {
    if (!userId) return [];
    const today = todayKST();
    const newlyEarned = badges.filter(
      (b) => b.award_type === "date" && !earnedIds.has(b.id) && matchesDateCondition(b, today)
    );
    return grant(newlyEarned);
  }, [userId, badges, earnedIds, grant]);

  return {
    badges,
    earnedIds,
    loading,
    checkMilestones,
    checkDateBadges,
    reload: load,
  };
}
