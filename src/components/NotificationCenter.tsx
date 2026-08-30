"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { UserNotification } from "@/lib/types";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function targetHref(n: UserNotification) {
  if (n.target_type === "board_post") return `/board/${n.target_id}`;
  if (n.target_type === "qna_question") return "/qna";
  return "/";
}

/**
 * 헤더의 알림 종/벨 아이콘. 내 게시판 글/댓글에 댓글·답글이 달렸을 때, 내 Q&A 질문에
 * 답변이 달렸을 때만 알림이 온다(다이렉트 메시지는 보류 상태라 이번 대상에서 제외).
 * 알림 생성 자체는 DB 트리거가 하고, 여기서는 실시간 구독으로 목록/안읽음 개수만 보여준다.
 */
export default function NotificationCenter({ userId }: { userId: string | null }) {
  const supabase = createClient();
  // RLS가 auth.uid() = user_id인 행만 돌려주므로(비로그인이면 auth.uid()가 없어 항상
  // 0건), 여기서 별도로 user_id 필터를 걸 필요는 없다.
  const { rows, reload } = useRealtimeList<UserNotification>("user_notifications", {
    orderBy: { column: "created_at", ascending: false },
    limit: 30,
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!userId) return null;

  const unreadCount = rows.filter((n) => !n.is_read).length;

  const markRead = async (n: UserNotification) => {
    if (!n.is_read) {
      await supabase.from("user_notifications").update({ is_read: true }).eq("id", n.id);
      reload();
    }
    setOpen(false);
  };

  const markAllRead = async () => {
    const unreadIds = rows.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("user_notifications").update({ is_read: true }).in("id", unreadIds);
    reload();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-md text-base leading-none hover:bg-black/5"
        aria-label="알림"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-auto py-1.5 z-30 bg-white border border-border rounded-lg shadow-md">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-bold text-muted">알림</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue font-bold">
                모두 읽음
              </button>
            )}
          </div>
          {rows.length === 0 && <p className="text-muted text-xs text-center py-4 m-0">알림이 없습니다.</p>}
          {rows.map((n) => (
            <Link
              key={n.id}
              href={targetHref(n)}
              onClick={() => markRead(n)}
              className={`block px-3 py-2 text-sm border-t border-border first:border-t-0 ${n.is_read ? "text-muted" : "font-semibold"}`}
            >
              {n.message}
              <div className="text-[11px] text-muted mt-0.5">{fmtDateTime(n.created_at)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
