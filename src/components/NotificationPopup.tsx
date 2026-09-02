"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";
import type { NotificationItem } from "@/lib/types";

function isHiddenToday(id: string) {
  return localStorage.getItem(`notif_hide_${id}`) === todayKST();
}

/** display_until이 없으면 계속 표시(무기한), 있으면 그 시각이 지나면 만료 처리 */
function isExpired(n: NotificationItem) {
  if (!n.display_until) return false;
  return Date.now() > new Date(n.display_until).getTime();
}

/**
 * display_type이 'popup'인 알림을 페이지 진입 시 모달로 띄웁니다.
 * 배너와 달리 학생이 "확인" 또는 "오늘 하루 안 보기"를 눌러야 사라집니다.
 * "오늘 하루 안 보기"는 이 브라우저(localStorage)에만 저장되어, 같은 학생이라도
 * 다른 기기/브라우저에서는 다시 뜹니다.
 *
 * 관리자가 "팝업 중지"(popup_active=false)를 누르거나 기록 자체를 삭제하거나,
 * 노출 기간(display_until)이 지나면(또는 "지금 바로 내리기"로 그 시각을 현재로
 * 앞당기면) 지금 이 팝업을 보고 있는 학생 화면에서도 즉시 닫힙니다. 이미 만료된
 * 팝업은 layout.tsx의 초기 조회 단계에서부터 서버가 내려주지 않으므로, 여기서의
 * isExpired 체크는 방어적 목적(페이지를 오래 열어둔 사이 만료된 경우)입니다.
 */
export default function NotificationPopup({ initial }: { initial: NotificationItem | null }) {
  const [current, setCurrent] = useState<NotificationItem | null>(null);
  const currentRef = useRef<NotificationItem | null>(null);
  currentRef.current = current;

  useEffect(() => {
    if (initial && initial.popup_active && !isExpired(initial) && !isHiddenToday(initial.id)) setCurrent(initial);
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
          if (n.display_type === "popup" && n.popup_active && !isExpired(n) && !isHiddenToday(n.id)) setCurrent(n);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as NotificationItem;
          if (currentRef.current?.id === n.id && (!n.popup_active || isExpired(n))) setCurrent(null);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          const old = payload.old as { id: string };
          if (currentRef.current?.id === old.id) setCurrent(null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 노출 종료 시각이 정해진 팝업이면, 페이지를 계속 열어둔 사이 그 시각이 지나는 순간
  // 자동으로 닫는다(배너와 동일한 패턴).
  useEffect(() => {
    if (!current || !current.display_until) return;
    const remaining = new Date(current.display_until).getTime() - Date.now();
    if (remaining <= 0) {
      setCurrent(null);
      return;
    }
    const timer = setTimeout(() => setCurrent(null), remaining);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;

  const hideToday = () => {
    localStorage.setItem(`notif_hide_${current.id}`, todayKST());
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
