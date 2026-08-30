"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";
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
  const [pendingCelebrations, setPendingCelebrations] = useState<BadgeDef[]>([]);
  // Header(useAutoCheckIn)와 마이페이지가 동시에 useBadges를 호출하면 같은 사용자에 대해
  // 채널이 두 번 생기는데, 이름이 겹치면 realtime 구독끼리 충돌한다(useRealtimeList와 동일 문제).
  // 인스턴스마다 고유한 채널 이름을 쓰도록 랜덤값을 섞는다.
  const channelSuffixRef = useRef(Math.random().toString(36).slice(2));
  // realtime 콜백 안에서 badges를 바로 쓰면 이펙트가 생성될 때의 값에 고정돼(stale closure)
  // 아직 목록이 안 불러와진 시점의 빈 배열을 참조할 수 있다. 항상 최신 값을 읽도록 ref로 따로 든다.
  const badgesRef = useRef<BadgeDef[]>([]);

  const load = useCallback(async () => {
    const { data: badgeRows } = await supabase
      .from("badges")
      .select("*")
      .eq("is_active", true)
      .order("streak_threshold", { ascending: true });
    setBadges((badgeRows as BadgeDef[]) ?? []);

    if (userId) {
      const { data: earned } = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
      setEarnedIds(new Set((earned ?? []).map((e) => e.badge_id)));
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    badgesRef.current = badges;
  }, [badges]);

  /**
   * "관리자가 띄우는 알림"(NotificationBanner)이 체감상 훨씬 빠른 이유를 실측해보니, 그건
   * event:"*" 구독 여부가 아니라 — 실시간 이벤트를 받은 뒤 화면을 갱신하기까지 네트워크
   * 왕복이 몇 번 더 필요한지의 차이였다. NotificationBanner는 INSERT payload.new를 그대로
   * 읽어서 그 자리에서 바로 배너를 띄운다(추가 조회 0번). 반면 이전 버전의 checkPending은
   * "뭔가 바뀌었다"는 신호만 받고 나서 user_badges 재조회 -> badges 재조회 -> RPC까지
   * 순차적으로 왕복해야 화면이 바뀌었다 — realtime 이벤트 자체는 제때 와도, 그 뒤에 붙는
   * 왕복들이 체감 지연을 만들었다.
   *
   * 그래서 badges 목록(이미 마운트 시 한 번 불러와서 badgesRef에 최신값을 들고 있음)에서
   * 바로 찾아 쓰는 방식으로 되돌리되, INSERT/DELETE 각각 원래 하던 것처럼 처리한다 —
   * 추가 네트워크 호출 없이 payload만으로 즉시 상태를 갱신한다(mark_badges_celebrated만
   * 화면 갱신을 막지 않도록 fire-and-forget으로 뒤에서 호출).
   */
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user_badges_watch_${userId}_${channelSuffixRef.current}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_badges" }, (payload) => {
        const row = payload.new as { user_id: string; badge_id: string; celebrated: boolean };
        if (row.user_id !== userId) return;
        setEarnedIds((prev) => (prev.has(row.badge_id) ? prev : new Set([...prev, row.badge_id])));
        if (row.celebrated) return;
        const badge = badgesRef.current.find((b) => b.id === row.badge_id);
        const applyCelebration = (b: BadgeDef) => {
          setPendingCelebrations((prev) => (prev.some((p) => p.id === b.id) ? prev : [...prev, b]));
          supabase.rpc("mark_badges_celebrated", { target_badge_ids: [b.id] });
        };
        if (badge) {
          applyCelebration(badge);
        } else {
          // badges 목록이 아직 안 불러와진 드문 경우에만 조회한다(평소엔 0회 왕복).
          supabase
            .from("badges")
            .select("*")
            .eq("id", row.badge_id)
            .single()
            .then(({ data }) => data && applyCelebration(data as BadgeDef));
        }
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
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  /**
   * 위 실시간 구독은 "지금 접속 중"일 때만 통한다. 접속 중이 아닐 때 지급된 뱃지(관리자가
   * 부여했는데 그 학생이 그때 접속 안 하고 있던 경우), 또는 Supabase의 realtime tenant가
   * 유휴 상태로 내려갔다 콜드스타트되는 구간과 겹쳐 이벤트를 놓친 경우를 대비해, 접속 시
   * 즉시 + 20초 주기로 "아직 축하 못 받은(celebrated=false)" 뱃지를 재조회해서 몰아서
   * 띄운다(위 실시간 경로가 정상 동작하면 이 폴링이 도달하기 전에 이미 떠 있다 — 어디까지나
   * 안전망).
   */
  useEffect(() => {
    if (!userId) return;
    const POLL_INTERVAL_MS = 20000;
    let cancelled = false;
    const checkPending = async () => {
      const { data: rows } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId)
        .eq("celebrated", false);
      if (cancelled || !rows || rows.length === 0) return;
      const badgeIds = rows.map((r) => r.badge_id);
      const { data: badgeRows } = await supabase.from("badges").select("*").in("id", badgeIds);
      if (cancelled) return;
      if (badgeRows && badgeRows.length > 0) {
        setPendingCelebrations((prev) => {
          const known = new Set(prev.map((b) => b.id));
          const fresh = (badgeRows as BadgeDef[]).filter((b) => !known.has(b.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        setEarnedIds((prev) => new Set([...prev, ...badgeIds]));
      }
      await supabase.rpc("mark_badges_celebrated", { target_badge_ids: badgeIds });
    };
    checkPending();
    const interval = setInterval(checkPending, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, supabase]);

  const clearPendingCelebrations = useCallback(() => setPendingCelebrations([]), []);

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
    pendingCelebrations,
    clearPendingCelebrations,
    reload: load,
  };
}
