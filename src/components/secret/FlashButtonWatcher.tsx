"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BadgeDef } from "@/lib/types";

function pageMatches(pages: string[] | "*", pathname: string) {
  if (pages === "*") return true;
  return Array.isArray(pages) && pages.includes(pathname);
}

/**
 * "잠깐 나타났다 사라지는 버튼형" — 적용 대상 페이지에 있는 동안, trigger_config의
 * 주기(interval_seconds)마다 확률(probability)을 굴려서 당첨되면 duration_ms 동안만
 * 버튼을 보여준다. 클릭이 안 되면 다음 굴림 기회로 넘어간다.
 */
export default function FlashButtonWatcher({ badges }: { badges: BadgeDef[] }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [visibleBadge, setVisibleBadge] = useState<BadgeDef | null>(null);
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

  const applicable = badges.filter(
    (b) => pageMatches(b.trigger_config?.pages, pathname) && !earnedIds.has(b.id)
  );
  const applicableKey = applicable.map((b) => b.id).join(",");

  useEffect(() => {
    if (!applicableKey) return;
    const hideTimers: ReturnType<typeof setTimeout>[] = [];
    const intervals = applicable.map((b) => {
      const cfg = b.trigger_config as { probability: number; interval_seconds: number; duration_ms: number };
      return setInterval(() => {
        if (Math.random() < cfg.probability) {
          setVisibleBadge(b);
          hideTimers.push(
            setTimeout(() => setVisibleBadge((cur) => (cur?.id === b.id ? null : cur)), cfg.duration_ms)
          );
        }
      }, cfg.interval_seconds * 1000);
    });
    return () => {
      intervals.forEach(clearInterval);
      hideTimers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicableKey]);

  const handleClick = async () => {
    if (!visibleBadge) return;
    const badge = visibleBadge;
    setVisibleBadge(null);
    setEarnedIds((prev) => new Set(prev).add(badge.id));
    await supabase.rpc("claim_secret_trigger_badge", { p_badge_id: badge.id });
  };

  if (!visibleBadge) return null;
  const cfg = visibleBadge.trigger_config as { button_label: string };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 45 }}
      className="bg-navy text-white font-bold text-sm rounded-full px-4 py-2 shadow-lg"
    >
      {cfg.button_label}
    </button>
  );
}
