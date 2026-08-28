"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAttendance } from "@/hooks/useAttendance";
import { useBadges } from "@/hooks/useBadges";
import type { BadgeDef } from "@/lib/types";

/**
 * 접속하면 버튼 클릭 없이 자동으로 오늘 체크인을 하고,
 * 완료 토스트(+획득한 뱃지가 있으면 축하 모달)를 띄우는 훅.
 * StreakBar(홈)와 마이페이지에서 공용으로 사용한다.
 *
 * 사이트 잠금(점검) 모드가 켜져 있는 동안은 아직 정식 운영이 아니므로 연속 접속
 * 체크인/토스트/뱃지 축하 팝업 같은 상호작용을 전부 보류한다(단, 날짜 조건 뱃지는
 * "잠금 중에 로그인하면 지급"이 목적이라 예외 — 지급은 조용히 계속하되 축하 팝업만 숨긴다).
 */
export function useAutoCheckIn(userId: string | null, isLockdownExempt: boolean = false) {
  const supabase = createClient();
  const attendance = useAttendance(userId);
  const { badges, earnedIds, loading: badgesLoading, checkMilestones, checkDateBadges } = useBadges(userId);
  const [toast, setToast] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<BadgeDef | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
  const firedRef = useRef(false);
  const dateCheckedRef = useRef(false);

  useEffect(() => {
    if (isLockdownExempt) {
      setMaintenanceMode(false);
      return;
    }
    supabase
      .from("site_settings")
      .select("maintenance_mode")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => setMaintenanceMode(!!data?.maintenance_mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLockdownExempt]);

  useEffect(() => {
    if (!userId || attendance.loading || attendance.checkedToday || firedRef.current) return;
    if (maintenanceMode === null || maintenanceMode) return; // 잠금 중이거나 확인 전이면 보류
    firedRef.current = true;
    (async () => {
      const nextStreak = await attendance.checkIn();
      if (nextStreak) {
        setToast(nextStreak);
        const newly = await checkMilestones(nextStreak);
        if (newly.length > 0) setCelebrate(newly[newly.length - 1]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attendance.loading, attendance.checkedToday, maintenanceMode]);

  // 날짜 조건 뱃지는 "새 체크인" 이벤트가 아니라 "오늘 로그인해서 사이트에 들어왔는지"만 보므로,
  // 이미 오늘 체크인을 마친 사용자(뱃지가 생기기 전에 먼저 접속했던 사용자 포함)도 접속할 때마다
  // 별도로 평가한다. 잠금 모드 중에도 지급은 계속하되(그게 목적이므로), 축하 팝업만 숨긴다.
  useEffect(() => {
    if (!userId || badgesLoading || dateCheckedRef.current) return;
    dateCheckedRef.current = true;
    (async () => {
      const newly = await checkDateBadges();
      if (newly.length > 0 && !maintenanceMode) setCelebrate(newly[newly.length - 1]);
    })();
  }, [userId, badgesLoading, checkDateBadges, maintenanceMode]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return {
    streak: attendance.streak,
    history: attendance.history,
    checkedToday: attendance.checkedToday,
    freezeCredits: attendance.freezeCredits,
    loading: attendance.loading,
    badges,
    earnedIds,
    toast,
    celebrate,
    dismissCelebrate: () => setCelebrate(null),
  };
}
