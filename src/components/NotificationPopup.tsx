"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationItem } from "@/lib/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isHiddenToday(id: string) {
  return localStorage.getItem(`notif_hide_${id}`) === todayStr();
}

/**
 * display_type이 'popup'인 알림을 페이지 진입 시 모달로 띄웁니다.
 * 배너와 달리 학생이 "확인" 또는 "오늘 하루 안 보기"를 눌러야 사라집니다.
 * "오늘 하루 안 보기"는 이 브라우저(localStorage)에만 저장되어, 같은 학생이라도
 * 다른 기기/브라우저에서는 다시 뜹니다.
 */
export default function NotificationPopup({ initial }: { initial: NotificationItem | null }) {
  const [current, setCurrent] = useState<NotificationItem | null>(null);

  useEffect(() => {
    if (initial && !isHiddenToday(initial.id)) setCurrent(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("public:notifications:popup")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as NotificationItem;
          if (n.display_type === "popup" && !isHiddenToday(n.id)) setCurrent(n);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!current) return null;

  const hideToday = () => {
    localStorage.setItem(`notif_hide_${current.id}`, todayStr());
    setCurrent(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
        <div className={`text-xs font-bold tracking-widest uppercase mb-1 ${current.level === "urgent" ? "text-red" : "text-gold"}`}>
          {current.level === "urgent" ? "긴급 공지" : "공지"}
        </div>
        <h3 className="text-lg font-bold mb-2">{current.title}</h3>
        <p className="text-sm text-muted whitespace-pre-wrap mb-5">{current.message}</p>
        <div className="flex gap-2 justify-end flex-wrap">
          <button onClick={hideToday} className="border border-border text-sm rounded-lg px-4 py-2">
            오늘 하루 안 보기
          </button>
          <button onClick={() => setCurrent(null)} className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
