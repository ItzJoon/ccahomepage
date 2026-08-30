"use client";

import { useEffect, useRef } from "react";
import { useBadges } from "@/hooks/useBadges";

/**
 * 날짜 조건 뱃지(예: 얼리엑세스)는 지금까지 (site) 레이아웃에서만 평가됐다. editor/sub_editor
 * 처럼 로그인 후 /admin만 이용하고 공개 화면은 한 번도 들어가지 않는 계정은 조건을
 * 만족해도 뱃지를 영영 못 받는 사각지대가 있었다. 관리자 화면에서도 한 번은 평가되도록
 * 이 컴포넌트를 admin 레이아웃에 마운트한다 — 축하 팝업 UI는 공개 화면의 몫으로 남겨두고
 * 여기서는 조용히 지급만 한다(지급 시점에 celebrated=true로 기록되므로 이후 공개 화면에
 * 들어가도 뒤늦게 팝업이 뜨지 않는다).
 */
export default function AdminDateBadgeSync({ userId }: { userId: string | null }) {
  const { checkDateBadges, loading } = useBadges(userId);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!userId || loading || ranRef.current) return;
    ranRef.current = true;
    checkDateBadges();
  }, [userId, loading, checkDateBadges]);

  return null;
}
