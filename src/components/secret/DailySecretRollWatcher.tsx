"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BadgeDef } from "@/lib/types";

/**
 * "하루 한 번 랜덤 확률 지급형" — 세션당 한 번만 굴리면 충분하다(서버의
 * secret_daily_attempts가 하루 한 번만 실제로 굴리도록 멱등 처리하므로, 여러 번
 * 호출해도 이미 오늘 시도했으면 그 결과만 그대로 돌아온다). 결과가 "오늘 처음 시도"일
 * 때만 잠깐 토스트를 보여준다.
 */
export default function DailySecretRollWatcher({ badges }: { badges: BadgeDef[] }) {
  const supabase = createClient();
  const [toast, setToast] = useState<{ label: string; won: boolean } | null>(null);
  const rolledRef = useRef(false);
  const badgeIdsKey = badges.map((b) => b.id).join(",");

  useEffect(() => {
    if (!badgeIdsKey || rolledRef.current) return;
    rolledRef.current = true;
    (async () => {
      for (const b of badges) {
        const { data } = await supabase.rpc("roll_daily_secret_badge", { p_badge_id: b.id });
        const result = data as { already_attempted: boolean; won: boolean } | null;
        if (result && !result.already_attempted) {
          setToast({ label: b.label, won: result.won });
          await new Promise((r) => setTimeout(r, 3500));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeIdsKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      style={{ position: "fixed", top: 16, right: 16, zIndex: 45 }}
      className="bg-white border border-border rounded-xl px-4 py-3 shadow-lg text-sm font-bold"
    >
      {toast.won ? `🎉 오늘의 운빨 당첨! (${toast.label})` : "오늘의 운빨: 아쉽게 낙첨"}
    </div>
  );
}
