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
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("notifications").insert({ title, message, level, sent_by: user?.id });
    setTitle("");
    setMessage("");
    setSending(false);
    reload();
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
            <span className="text-xs text-muted">{new Date(n.sent_at).toLocaleString("ko-KR")}</span>
          </li>
        ))}
        {rows.length === 0 && <div className="text-muted text-center py-8 text-sm">발송한 알림이 없습니다.</div>}
      </ul>
    </div>
  );
}
