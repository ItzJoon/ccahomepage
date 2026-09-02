"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import Badge from "@/components/Badge";
import EmailNotificationHistory from "@/components/admin/EmailNotificationHistory";
import { adminDisplayName } from "@/lib/displayName";
import { DURATION_PRESETS, computeDisplayUntil, type DurationMode } from "@/lib/notificationDuration";
import type { NotificationItem } from "@/lib/types";

interface NotificationWithSender extends NotificationItem {
  sender: { name: string | null; nickname: string | null; email: string } | null;
}

export default function AdminNotifyPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"popup" | "email">("popup");
  const { rows, reload } = useRealtimeList<NotificationWithSender>("notifications", {
    select: "*, sender:profiles(name, nickname, email)",
    orderBy: { column: "sent_at", ascending: false },
  });
  const { isAdmin: iAmAdmin, role } = useMyRole();
  // designer도 admin과 동일하게 알림 삭제 및 발송 이력 전체 범위 열람을 쓸 수 있다(RLS의
  // notifications_delete_admin이 is_designer()를 허용).
  const canManageNotify = iAmAdmin || role === "designer";
  const { t } = useHomeTheme();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "urgent">("info");
  const [displayType, setDisplayType] = useState<"banner" | "popup">("banner");
  const [durationMode, setDurationMode] = useState<DurationMode>("indefinite");
  const [customUntil, setCustomUntil] = useState(""); // datetime-local 값, durationMode==="custom"일 때만 사용
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !message.trim()) return;
    if (durationMode === "custom" && !customUntil) return;
    setSending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("notifications").insert({
      title,
      message,
      level,
      display_type: displayType,
      display_until: computeDisplayUntil(durationMode, customUntil),
      sent_by: user?.id,
    });
    setTitle("");
    setMessage("");
    setSending(false);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 알림을 삭제하시겠습니까? 지금 떠 있는 팝업/배너도 즉시 닫힙니다.")) return;
    await supabase.from("notifications").delete().eq("id", id);
    reload();
  };

  // 배너/팝업 공통 조기 종료 — display_until을 지금 시각으로 당겨서 즉시 만료 처리한다
  // (팝업은 기존 popup_active도 함께 꺼서 데이터 일관성을 유지한다).
  const stopNow = async (n: NotificationItem) => {
    if (!confirm("지금 바로 노출을 종료하시겠습니까? 지금 떠 있는 팝업/배너도 즉시 닫히고, 발송 기록은 그대로 남습니다.")) return;
    await supabase
      .from("notifications")
      .update({ display_until: new Date().toISOString(), ...(n.display_type === "popup" ? { popup_active: false } : {}) })
      .eq("id", n.id);
    reload();
  };

  const isEnded = (n: NotificationItem) =>
    (n.display_type === "popup" && !n.popup_active) || (!!n.display_until && new Date(n.display_until).getTime() <= Date.now());

  const statusLabel = (n: NotificationItem) => {
    if (isEnded(n)) return { text: "노출 종료", className: "text-muted" };
    if (!n.display_until) return { text: "무기한 노출 중", className: "text-teal font-bold" };
    return { text: `노출 중 (~${new Date(n.display_until).toLocaleString("ko-KR")})`, className: "text-teal font-bold" };
  };

  return (
    <div>
      <h2 className="text-[22px] mb-4">알림 발송</h2>
      <div className="flex border border-border rounded-lg overflow-hidden w-fit mb-4">
        <button
          className={`px-3.5 py-1.5 text-sm font-semibold border-0 ${tab === "popup" ? t.adminToggleActive : "bg-white"}`}
          onClick={() => setTab("popup")}
        >
          배너·팝업
        </button>
        <button
          className={`px-3.5 py-1.5 text-sm font-semibold border-0 ${tab === "email" ? t.adminToggleActive : "bg-white"}`}
          onClick={() => setTab("email")}
        >
          이메일 발송 이력
        </button>
      </div>

      {tab === "email" ? (
        <EmailNotificationHistory isAdmin={canManageNotify} />
      ) : (
        <>
      <div className={`${t.adminEditPanel} flex flex-col gap-1.5 max-w-lg`}>
        <label className="text-xs font-bold text-muted mt-2">알림 제목</label>
        <input className={t.adminInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 긴급 하교 안내" />
        <label className="text-xs font-bold text-muted mt-2">알림 내용</label>
        <textarea rows={3} className={t.adminInput} value={message} onChange={(e) => setMessage(e.target.value)} />
        <label className="text-xs font-bold text-muted mt-2">중요도</label>
        <select className={t.adminInput} value={level} onChange={(e) => setLevel(e.target.value as any)}>
          <option value="info">일반 안내</option>
          <option value="urgent">긴급</option>
        </select>
        <label className="text-xs font-bold text-muted mt-2">노출 방식</label>
        <select
          className={t.adminInput}
          value={displayType}
          onChange={(e) => setDisplayType(e.target.value as "banner" | "popup")}
        >
          <option value="banner">상단 배너 (작게 표시, 학생이 언제든 닫기 가능)</option>
          <option value="popup">팝업 (모달, 확인/오늘 하루 안 보기를 눌러야 사라짐)</option>
        </select>
        <label className="text-xs font-bold text-muted mt-2">노출 기간</label>
        <select className={t.adminInput} value={durationMode} onChange={(e) => setDurationMode(e.target.value as DurationMode)}>
          {DURATION_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {durationMode === "custom" && (
          <input
            type="datetime-local"
            className={t.adminInput}
            value={customUntil}
            onChange={(e) => setCustomUntil(e.target.value)}
          />
        )}
        {displayType === "popup" && (
          <p className="text-muted text-xs mt-1">
            팝업은 노출 기간과 별개로, 학생이 "확인" 또는 "오늘 하루 안 보기"를 누르면 그
            즉시 본인 화면에서만 닫힙니다.
          </p>
        )}
        <button disabled={sending} onClick={send} className={`${t.adminBtnPrimary} mt-3.5 self-start`}>
          {sending ? "발송 중…" : "학생 화면에 즉시 발송"}
        </button>
      </div>

      <h3 className="mt-8 mb-2">발송 이력</h3>
      <ul className="list-none m-0 p-0">
        {rows.map((n) => {
          const status = statusLabel(n);
          return (
            <li key={n.id} className={`border-b border-border py-2.5 flex items-center gap-2 flex-wrap ${isEnded(n) ? "opacity-60" : ""}`}>
              {n.level === "urgent" && <Badge color="red">긴급</Badge>}
              <span className="flex-1 text-sm">{n.title}</span>
              <span className="text-xs text-muted">{adminDisplayName(n.sender)}</span>
              <span className="text-xs text-muted">{n.display_type === "popup" ? "팝업" : "배너"}</span>
              <span className={`text-xs ${status.className}`}>{status.text}</span>
              <span className="text-xs text-muted">{new Date(n.sent_at).toLocaleString("ko-KR")}</span>
              {!isEnded(n) && (
                <button onClick={() => stopNow(n)} className="text-blue text-xs font-bold">지금 바로 내리기</button>
              )}
              {canManageNotify ? (
                <button onClick={() => remove(n.id)} className={t.adminBtnDanger}>삭제</button>
              ) : (
                <span className="text-muted text-xs" title="삭제는 admin 이상만 가능합니다">🔒</span>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <div className="text-muted text-center py-8 text-sm">발송한 알림이 없습니다.</div>}
      </ul>
        </>
      )}
    </div>
  );
}
