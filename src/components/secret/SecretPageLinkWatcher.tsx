"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { BadgeDef } from "@/lib/types";

/**
 * "시간대 한정 숨은 페이지형" — 활성 창(요일+시각) 여부는 항상 서버(is_timed_secret_badge_active)에게
 * 물어본다. RestrictionGuardWatcher와 동일하게 10초 폴링으로 확인해서, 이미 열어둔 화면에도
 * 새로고침 없이 링크가 나타나거나 사라진다.
 */
export default function SecretPageLinkWatcher({ badges }: { badges: BadgeDef[] }) {
  const supabase = createClient();
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const badgeIdsKey = badges.map((b) => b.id).join(",");

  useEffect(() => {
    if (!badgeIdsKey) {
      setActiveIds(new Set());
      return;
    }
    let cancelled = false;
    const check = async () => {
      const results = await Promise.all(
        badges.map(async (b) => {
          const { data } = await supabase.rpc("is_timed_secret_badge_active", { p_badge_id: b.id });
          return { id: b.id, active: !!data };
        })
      );
      if (cancelled) return;
      setActiveIds(new Set(results.filter((r) => r.active).map((r) => r.id)));
    };
    check();
    const timer = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeIdsKey]);

  const active = badges.filter((b) => activeIds.has(b.id));
  if (active.length === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 45 }} className="flex flex-col gap-2">
      {active.map((b) => {
        const cfg = b.trigger_config as { slug: string; link_label: string };
        return (
          <Link
            key={b.id}
            href={`/secret/${cfg.slug}`}
            className="bg-navy text-white text-sm font-bold rounded-full px-4 py-2 shadow-lg"
          >
            {cfg.link_label}
          </Link>
        );
      })}
    </div>
  );
}
