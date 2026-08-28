"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Badge from "@/components/Badge";
import type { NotificationItem } from "@/lib/types";

export default function AdminNotifyPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<NotificationItem>("notifications", {
    orderBy: { column: "sent_at", ascending: false },
  });
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "urgent">("info");
  const [displayType, setDisplayType] = useState<"banner" | "popup">("banner");
  const [duration, setDuration] = useState(""); // "" = 계속 표시(직접 닫기 전까지) — 배너에만 적용
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("notifications").insert({
      title,
      message,
      level,
      display_type: displayType,
      duration_minutes: displayType === "banner" && duration ? Number(duration) : null,
      sent_by: user?.id,
    });
    setTitle("");
    setMessage("");
    setSending(false);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 알림을 삭제하시겠습니까?")) return;
    await supabase.from("notifications").delete().eq("id", id);
    reload();
  };

  const durationLabel = (n: number | null) => {
    if (!n) return "계속 표시";
    if (n < 60) return `${n}분간 표시`;
    if (n % 1440 === 0) return `${n / 1440}일간 표시`;
    if (n % 60 === 0) return `${n / 60}시간 표시`;
    return `${n}분간 표시`;
  };

  return (
    <div>
      <h2 className="text-[22px] mb-4">실시간 알림 발송</h2>
      <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 max-w-lg">
        <label className="text-xs font-bold text-muted mt-2">알림 제목</label>
        <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 긴급 하교 안내" />
        <label className="text-xs font-bold text-muted mt-2">알림 내용</label>
        <textarea rows={3} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} />
        <label className="text-xs font-bold text-muted mt-2">중요도</label>
        <select className="border border-border rounded-lg px-2.5 py-2 text-sm" value={level} onChange={(e) => setLevel(e.target.value as any)}>
          <option value="info">일반 안내</option>
          <option value="urgent">긴급</option>
        </select>
        <label className="text-xs font-bold text-muted mt-2">노출 방식</label>
        <select
          className="border border-border rounded-lg px-2.5 py-2 text-sm"
          value={displayType}
          onChange={(e) => setDisplayType(e.target.value as "banner" | "popup")}
        >
          <option value="banner">상단 배너 (작게 표시, 학생이 언제든 닫기 가능)</option>
          <option value="popup">팝업 (모달, 확인/오늘 하루 안 보기를 눌러야 사라짐)</option>
        </select>
        {displayType === "banner" ? (
          <>
            <label className="text-xs font-bold text-muted mt-2">표시 시간</label>
            <select className="border border-border rounded-lg px-2.5 py-2 text-sm" value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="">계속 표시 (학생이 직접 닫기 전까지)</option>
              <option value="10">10분</option>
              <option value="30">30분</option>
              <option value="60">1시간</option>
              <option value="180">3시간</option>
              <option value="1440">24시간</option>
            </select>
          </>
        ) : (
          <p className="text-muted text-xs mt-2">
            팝업은 학생이 "확인" 또는 "오늘 하루 안 보기"를 누르기 전까지 계속 뜹니다(표시 시간 설정 없음).
          </p>
        )}
        <button disabled={sending} onClick={send} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3.5 self-start">
          {sending ? "발송 중…" : "학생 화면에 즉시 발송"}
        </button>
      </div>

      <h3 className="mt-8 mb-2">발송 이력</h3>
      <ul className="list-none m-0 p-0">
        {rows.map((n) => (
          <li key={n.id} className="border-b border-border py-2.5 flex items-center gap-2">
            {n.level === "urgent" && <Badge color="red">긴급</Badge>}
            <span className="flex-1 text-sm">{n.title}</span>
            <span className="text-xs text-muted">{n.display_type === "popup" ? "팝업" : "배너"}</span>
            <span className="text-xs text-muted">{n.display_type === "popup" ? "확인 시 닫힘" : durationLabel(n.duration_minutes)}</span>
            <span className="text-xs text-muted">{new Date(n.sent_at).toLocaleString("ko-KR")}</span>
            <button onClick={() => remove(n.id)} className="text-red text-xs font-bold">삭제</button>
          </li>
        ))}
        {rows.length === 0 && <div className="text-muted text-center py-8 text-sm">발송한 알림이 없습니다.</div>}
      </ul>
    </div>
  );
}
