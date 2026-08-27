"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationItem } from "@/lib/types";

/**
 * 관리자가 알림 발송 센터에서 notifications 테이블에 INSERT 하는 순간,
 * Supabase Realtime을 통해 접속 중인 모든 학생 화면에 즉시 배너로 표시됩니다.
 */
export default function NotificationBanner({ initial }: { initial: NotificationItem | null }) {
  const [latest, setLatest] = useState<NotificationItem | null>(initial);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setLatest(payload.new as NotificationItem);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!latest || dismissed.includes(latest.id)) return null;

  return (
    <div
      className={`flex items-center gap-2.5 px-5 py-2.5 border-b max-w-[1180px] mx-auto w-full ${
        latest.level === "urgent" ? "bg-[#FDEBEC] border-[#F3B9BC]" : "bg-[#FFF7E6] border-[#F3D98A]"
      }`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: latest.level === "urgent" ? "var(--red)" : "var(--gold)" }}
      />
      <div className="flex gap-2 flex-1 flex-wrap text-sm">
        <strong>{latest.title}</strong>
        <span>{latest.message}</span>
      </div>
      <button
        onClick={() => setDismissed((d) => [...d, latest.id])}
        className="text-muted text-sm"
        aria-label="알림 닫기"
      >
        ✕
      </button>
    </div>
  );
}
