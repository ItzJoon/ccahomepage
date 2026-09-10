"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useList } from "@/hooks/useList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import Badge from "@/components/Badge";
import ImageUpload from "@/components/ImageUpload";
import SoundUpload from "@/components/SoundUpload";
import EmailNotificationHistory from "@/components/admin/EmailNotificationHistory";
import { adminDisplayName } from "@/lib/displayName";
import { DURATION_PRESETS, computeDisplayUntil, type DurationMode } from "@/lib/notificationDuration";
import { removeStorageFile } from "@/lib/storageCleanup";
import type { NotificationItem } from "@/lib/types";

interface NotificationWithSender extends NotificationItem {
  sender: { name: string | null; nickname: string | null; email: string } | null;
}

export default function AdminNotifyPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"popup" | "email">("popup");
  const { rows, reload } = useList<NotificationWithSender>("notifications", {
    select: "*, sender:profiles(name, nickname, email)",
    orderBy: { column: "sent_at", ascending: false },
  });
  const { myId, isAdmin: iAmAdmin, role } = useMyRole();
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [soundUrl, setSoundUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim()) return;
    if (!imageUrl && !message.trim()) return; // 이미지가 없으면 텍스트 알림이므로 내용이 필수
    if (durationMode === "custom" && !customUntil) return;
    setSending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("notifications").insert({
      title,
      message,
      level,
      display_type: imageUrl ? "popup" : displayType,
      display_until: computeDisplayUntil(durationMode, customUntil),
      image_url: imageUrl,
      link_url: imageUrl && linkUrl.trim() ? linkUrl.trim() : null,
      sound_url: soundUrl,
      sent_by: user?.id,
    });
    setTitle("");
    setMessage("");
    setImageUrl(null);
    setLinkUrl("");
    setSoundUrl(null);
    setSending(false);
    reload();
  };

  // 사운드를 다른 파일로 교체할 때, storage에 남는 이전 파일이 고아로 남지 않게 먼저 지운다.
  const changeSound = (url: string | null) => {
    if (soundUrl) removeStorageFile(supabase, "attachments", soundUrl);
    setSoundUrl(url);
  };

  const remove = async (n: NotificationItem) => {
    if (!confirm("이 알림을 삭제하시겠습니까? 지금 떠 있는 팝업/배너도 즉시 닫힙니다.")) return;
    await supabase.from("notifications").delete().eq("id", n.id);
    // 첨부 이미지/사운드가 있었으면 Storage에도 고아 파일로 남지 않도록 같이 지운다.
    await removeStorageFile(supabase, "attachments", n.image_url);
    await removeStorageFile(supabase, "attachments", n.sound_url);
    reload();
  };

  // 배너/팝업 공통 조기 종료 — display_until을 지금 시각으로 당겨서 즉시 만료 처리한다
  // (팝업은 기존 popup_active도 함께 꺼서 데이터 일관성을 유지한다). 사운드는 알림이 뜨는
  // 순간 한 번 재생되면 역할이 끝나므로, "무기한 노출" 알림을 관리자가 수동으로 끄는
  // 이 시점에 맞춰 파일도 함께 정리한다(기록 자체는 남기고 sound_url만 비운다).
  const stopNow = async (n: NotificationItem) => {
    if (!confirm("지금 바로 노출을 종료하시겠습니까? 지금 떠 있는 팝업/배너도 즉시 닫히고, 발송 기록은 그대로 남습니다.")) return;
    await supabase
      .from("notifications")
      .update({
        display_until: new Date().toISOString(),
        ...(n.display_type === "popup" ? { popup_active: false } : {}),
        ...(n.sound_url ? { sound_url: null } : {}),
      })
      .eq("id", n.id);
    if (n.sound_url) await removeStorageFile(supabase, "attachments", n.sound_url);
    reload();
  };

  const isEnded = (n: NotificationItem) =>
    (n.display_type === "popup" && !n.popup_active) || (!!n.display_until && new Date(n.display_until).getTime() <= Date.now());

  // 지금 동시에 떠 있는 팝업들 사이의 노출 순서 — display_order 오름차순으로 하나씩
  // 차례로 뜬다(NotificationPopup.tsx 참고). main_blocks 편집기와 동일하게 인접한
  // 두 항목의 display_order를 맞바꿔서 순서를 바꾼다.
  const activePopups = [...rows]
    .filter((n) => n.display_type === "popup" && !isEnded(n))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const moveOrder = async (n: NotificationItem, dir: number) => {
    const idx = activePopups.findIndex((x) => x.id === n.id);
    const swap = activePopups[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("notifications").update({ display_order: swap.display_order }).eq("id", n.id),
      supabase.from("notifications").update({ display_order: n.display_order }).eq("id", swap.id),
    ]);
    reload();
  };

  // 이미 발송된(아직 노출 종료 전인) 알림의 종료 시각을 나중에 바꿀 수 있게 한다 —
  // 발송 시점의 노출 기간 선택과 같은 UI(DURATION_PRESETS/computeDisplayUntil)를
  // 그대로 재사용하되, 기준 시각은 "지금부터"로 다시 계산된다.
  const [editingUntilId, setEditingUntilId] = useState<string | null>(null);
  const [editUntilMode, setEditUntilMode] = useState<DurationMode>("indefinite");
  const [editUntilCustom, setEditUntilCustom] = useState("");

  // datetime-local input은 브라우저 로컬 시간을 그대로 표시/입력받는데(타임존 정보가 없음),
  // toISOString()은 항상 UTC라서 그대로 slice하면 관리자 로컬 시간(KST)과 9시간 어긋난
  // 값이 채워진다. computeDisplayUntil이 저장 시 이 값을 로컬 시간으로 해석해 다시
  // ISO로 바꾸므로(OrgEventsManager/JudiciaryEventsManager의 toDatetimeLocal과 동일 패턴),
  // 프리필도 로컬 getter로 만들어야 왕복이 어긋나지 않는다.
  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const startEditUntil = (n: NotificationItem) => {
    setEditingUntilId(n.id);
    setEditUntilMode(n.display_until ? "custom" : "indefinite");
    setEditUntilCustom(n.display_until ? toDatetimeLocal(n.display_until) : "");
  };

  const saveUntil = async (n: NotificationItem) => {
    if (editUntilMode === "custom" && !editUntilCustom) return;
    await supabase.from("notifications").update({ display_until: computeDisplayUntil(editUntilMode, editUntilCustom) }).eq("id", n.id);
    setEditingUntilId(null);
    reload();
  };

  // 노출 기간이 자연 만료(display_until 경과)된 알림은 별도로 끄는 액션이 없으므로,
  // 이 관리자 화면을 열 때마다 한 번씩 훑어서 사운드 파일만 정리한다(텍스트/이미지
  // 기록은 그대로 유지, 재생 역할이 끝난 mp3만 정리 대상). 같은 화면을 여러 번 열어도
  // sound_url이 이미 비어 있으면 다시 처리되지 않는다.
  const sweptRef = useRef(new Set<string>());
  useEffect(() => {
    for (const n of rows) {
      if (!n.sound_url || !isEnded(n) || sweptRef.current.has(n.id)) continue;
      sweptRef.current.add(n.id);
      removeStorageFile(supabase, "attachments", n.sound_url).then(() => {
        supabase.from("notifications").update({ sound_url: null }).eq("id", n.id).then(() => reload());
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

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
          className={`px-3.5 py-1.5 text-sm font-semibold border-0 ${tab === "popup" ? t.adminToggleActive : "bg-surface"}`}
          onClick={() => setTab("popup")}
        >
          배너·팝업
        </button>
        <button
          className={`px-3.5 py-1.5 text-sm font-semibold border-0 ${tab === "email" ? t.adminToggleActive : "bg-surface"}`}
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
        <label className="text-xs font-bold text-muted mt-2">알림 내용{imageUrl && " (선택)"}</label>
        <textarea
          rows={3}
          className={t.adminInput}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={imageUrl ? "비워두면 이미지만 표시됩니다" : ""}
        />
        <label className="text-xs font-bold text-muted mt-2">이미지 첨부 (선택)</label>
        <ImageUpload userId={myId || "notify"} value={imageUrl} onChange={setImageUrl} bucket="attachments" />
        {imageUrl && (
          <>
            <p className="text-muted text-xs mt-1">
              {message.trim()
                ? "이미지와 함께 위 제목/내용도 팝업에 표시됩니다 (노출 방식은 자동으로 팝업이 됩니다)."
                : "알림 내용을 비워두면 제목/내용 없이 이미지 중심의 팝업으로 표시됩니다 (확인/오늘 하루 안 보기 버튼 포함, 노출 방식은 자동으로 팝업이 됩니다)."}
            </p>
            <label className="text-xs font-bold text-muted mt-2">이미지 클릭 시 이동할 링크 (선택)</label>
            <input
              className={t.adminInput}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="예: /events/xxxx 또는 https://..."
            />
          </>
        )}
        <label className="text-xs font-bold text-muted mt-2">사운드 첨부 (선택)</label>
        <SoundUpload userId={myId || "notify"} value={soundUrl} onChange={changeSound} bucket="attachments" />
        {soundUrl && (
          <p className="text-muted text-xs mt-1">알림이 화면에 뜨는 순간 이 사운드가 한 번 재생됩니다(마이페이지에서 알림 사운드를 꺼둔 학생에게는 재생되지 않습니다).</p>
        )}
        <label className="text-xs font-bold text-muted mt-2">중요도</label>
        <select className={t.adminInput} value={level} onChange={(e) => setLevel(e.target.value as any)}>
          <option value="info">일반 안내</option>
          <option value="urgent">긴급</option>
        </select>
        <label className="text-xs font-bold text-muted mt-2">노출 방식</label>
        <select
          className={t.adminInput}
          value={imageUrl ? "popup" : displayType}
          disabled={!!imageUrl}
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

      {activePopups.length > 1 && (
        <>
          <h3 className="mt-8 mb-2">지금 뜨는 순서</h3>
          <p className="text-muted text-xs mb-2">
            팝업이 동시에 여러 개 활성화돼 있으면 위에서부터 순서대로 하나씩 뜹니다. 화살표로
            순서를 바꾸면 이 목록 안에서 바로 위/아래로 옮겨집니다.
          </p>
          <ul className="list-none m-0 p-0 flex flex-col gap-1.5 mb-6">
            {activePopups.map((n, idx) => (
              <li key={n.id} className={`${t.adminEditPanel} flex items-center gap-2`}>
                <span className="text-muted text-xs font-bold w-4 shrink-0 text-center">{idx + 1}</span>
                {n.level === "urgent" && <Badge color="red">긴급</Badge>}
                <span className="flex-1 text-sm">{n.title}</span>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveOrder(n, -1)}
                  className="text-blue disabled:text-muted disabled:opacity-40 text-xs px-1"
                  title="먼저 뜨게 하기"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={idx === activePopups.length - 1}
                  onClick={() => moveOrder(n, 1)}
                  className="text-blue disabled:text-muted disabled:opacity-40 text-xs px-1"
                  title="나중에 뜨게 하기"
                >
                  ▼
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-8 mb-2">발송 이력</h3>
      <ul className="list-none m-0 p-0">
        {rows.map((n) => {
          const status = statusLabel(n);
          return (
            <li key={n.id} className={`border-b border-border py-2.5 flex flex-col gap-1.5 ${isEnded(n) ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2 flex-wrap">
                {n.level === "urgent" && <Badge color="red">긴급</Badge>}
                <span className="flex-1 text-sm">{n.title}</span>
                <span className="text-xs text-muted">{adminDisplayName(n.sender)}</span>
                <span className="text-xs text-muted">
                  {n.display_type === "popup" ? "팝업" : "배너"}
                  {n.image_url && " · 이미지"}
                  {n.sound_url && " · 사운드"}
                </span>
                <span className={`text-xs ${status.className}`}>{status.text}</span>
                <span className="text-xs text-muted">{new Date(n.sent_at).toLocaleString("ko-KR")}</span>
                {!isEnded(n) && (
                  <button onClick={() => startEditUntil(n)} className="text-blue text-xs font-bold">종료 시각 변경</button>
                )}
                {!isEnded(n) && (
                  <button onClick={() => stopNow(n)} className="text-blue text-xs font-bold">지금 바로 내리기</button>
                )}
                {canManageNotify ? (
                  <button onClick={() => remove(n)} className={t.adminBtnDanger}>삭제</button>
                ) : (
                  <span className="text-muted text-xs" title="삭제는 admin 이상만 가능합니다">🔒</span>
                )}
              </div>
              {editingUntilId === n.id && (
                <div className={`${t.adminEditPanel} flex items-center gap-1.5 flex-wrap w-fit`}>
                  <select
                    className={t.adminInput}
                    value={editUntilMode}
                    onChange={(e) => setEditUntilMode(e.target.value as DurationMode)}
                  >
                    {DURATION_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {editUntilMode === "custom" && (
                    <input
                      type="datetime-local"
                      className={t.adminInput}
                      value={editUntilCustom}
                      onChange={(e) => setEditUntilCustom(e.target.value)}
                    />
                  )}
                  <button onClick={() => saveUntil(n)} className={t.adminBtnPrimary}>저장</button>
                  <button onClick={() => setEditingUntilId(null)} className={t.adminBtnSecondary}>취소</button>
                </div>
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
