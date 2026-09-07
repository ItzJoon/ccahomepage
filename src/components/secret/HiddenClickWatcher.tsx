"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BadgeDef } from "@/lib/types";

/**
 * "숨겨진 요소 클릭형" — trigger_config.page_path와 현재 경로가 일치하는 뱃지만
 * trigger_config.x_pct/y_pct(화면 기준 %) 위치에 작은 이미지를 띄운다. 실제 지급 검증은
 * claim_secret_trigger_badge RPC가 서버에서 다시 하므로, 여기서 좌표/이미지를 아무리
 * 정확히 몰라도(개발자 도구로 미리 봐도) 정원/활성 여부는 항상 서버가 최종 판단한다.
 */
export default function HiddenClickWatcher({ badges }: { badges: BadgeDef[] }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const badgeIdsKey = badges.map((b) => b.id).join(",");

  useEffect(() => {
    if (!badgeIdsKey) return;
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", data.user.id)
        .in("badge_id", badgeIdsKey.split(","));
      if (!cancelled && rows) setEarnedIds(new Set(rows.map((r) => r.badge_id)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeIdsKey]);

  const candidates = badges.filter(
    (b) => b.trigger_config?.page_path === pathname && !earnedIds.has(b.id)
  );

  const handleClick = async (b: BadgeDef) => {
    setEarnedIds((prev) => new Set(prev).add(b.id)); // 낙관적으로 즉시 숨김(중복 클릭 방지)
    await supabase.rpc("claim_secret_trigger_badge", { p_badge_id: b.id });
  };

  if (candidates.length === 0) return null;

  return (
    <>
      {candidates.map((b) => {
        const cfg = b.trigger_config as { image_url: string; x_pct: number; y_pct: number; size_px: number };
        return (
          <img
            key={b.id}
            src={cfg.image_url}
            alt=""
            onClick={() => handleClick(b)}
            style={{
              position: "fixed",
              left: `${cfg.x_pct}%`,
              top: `${cfg.y_pct}%`,
              width: cfg.size_px,
              height: cfg.size_px,
              cursor: "pointer",
              zIndex: 40,
            }}
          />
        );
      })}
    </>
  );
}
