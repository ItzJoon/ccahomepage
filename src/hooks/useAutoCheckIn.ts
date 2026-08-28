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
  const {
    badges,
    earnedIds,
    loading: badgesLoading,
    checkMilestones,
    checkDateBadges,
    externalGrant,
    clearExternalGrant,
    pendingCelebrations,
    clearPendingCelebrations,
  } = useBadges(userId);
  const [toast, setToast] = useState<number | null>(null);
  // 축하할 뱃지가 여러 개 겹칠 수 있어(연속 접속 여러 단계 동시 달성, 접속 안 한 사이 관리자가
  // 여러 개 부여 등) 큐로 관리하고 하나씩 순서대로 보여준다.
  const [celebrateQueue, setCelebrateQueue] = useState<BadgeDef[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
  const firedRef = useRef(false);
  const dateCheckedRef = useRef(false);

  const pushCelebrations = (list: BadgeDef[]) => {
    if (list.length === 0) return;
    setCelebrateQueue((q) => [...q, ...list]);
  };

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
        pushCelebrations(newly);
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
      if (!maintenanceMode) pushCelebrations(newly);
    })();
  }, [userId, badgesLoading, checkDateBadges, maintenanceMode]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 관리자가 "뱃지 직접 부여"로 지급한 뱃지는 관리자 화면이 아니라 학생 본인 화면에서
  // 축하 팝업이 떠야 하므로, useBadges의 실시간 구독이 감지한 지급을 그대로 큐에 넣는다.
  useEffect(() => {
    if (!externalGrant) return;
    pushCelebrations([externalGrant]);
    clearExternalGrant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalGrant, clearExternalGrant]);

  // 접속 중이 아닐 때 관리자가 부여해서 놓쳤던 축하도 접속하는 순간 몰아서 큐에 넣는다.
  useEffect(() => {
    if (pendingCelebrations.length === 0) return;
    pushCelebrations(pendingCelebrations);
    clearPendingCelebrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCelebrations, clearPendingCelebrations]);

  return {
    streak: attendance.streak,
    history: attendance.history,
    checkedToday: attendance.checkedToday,
    freezeCredits: attendance.freezeCredits,
    loading: attendance.loading,
    badges,
    earnedIds,
    toast,
    celebrate: celebrateQueue[0] ?? null,
    dismissCelebrate: () => setCelebrateQueue((q) => q.slice(1)),
  };
}
