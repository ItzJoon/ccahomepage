"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EmailAudience, EmailNotificationBatch, PostType } from "@/lib/types";

const GRADES = ["10", "11", "12"];
const HOMEROOMS = [
  { value: 1, label: "샬롬" },
  { value: 2, label: "헤세드" },
  { value: 3, label: "토브" },
];
const GMAIL_DAILY_LIMIT = 500;

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 공지/뉴스 수정 화면에서 "이메일로 알림 보내기"를 담당하는 패널.
 * - notice/news: 대상을 전체(admin 이상)/학년별/학급별/직접 입력 중 골라서 보낸다.
 * - subject_notice/homeroom_notice: teacher가 쓴 교과/학급 공지라 대상이 이미 정해져
 *   있으므로 별도 선택 없이 자동 대상으로만 보낸다.
 * 발송 전에는 항상 "대상자 확인"으로 정확한 수신자 수(서버가 계산한 값, RLS/수신거부
 * 반영)를 먼저 보고 확인 창을 한 번 더 거친 뒤에만 실제로 나간다.
 */
export default function EmailSendPanel({
  postId,
  postType,
  isAdmin,
  isEditor,
}: {
  postId: string;
  postType: PostType;
  isAdmin: boolean;
  isEditor: boolean;
}) {
  const supabase = createClient();
  const isAuto = postType === "subject_notice" || postType === "homeroom_notice";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"all" | "grades" | "homerooms" | "custom">(isAdmin ? "all" : "grades");
  const [grades, setGrades] = useState<Set<string>>(new Set());
  const [homerooms, setHomerooms] = useState<Set<number>>(new Set());
  const [customEmails, setCustomEmails] = useState("");
  const [preview, setPreview] = useState<{ count: number; emails: string[]; description: string; todaySentCount: number } | null>(null);
  const [showAllEmails, setShowAllEmails] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [lastBatch, setLastBatch] = useState<EmailNotificationBatch | null>(null);

  useEffect(() => {
    supabase
      .from("email_notification_batches")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLastBatch((data as EmailNotificationBatch) ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const buildAudience = (): EmailAudience => {
    if (isAuto) return { mode: "auto" };
    if (mode === "all") return { mode: "all" };
    if (mode === "grades") return { mode: "grades", grades: Array.from(grades) };
    if (mode === "homerooms") return { mode: "homerooms", homerooms: Array.from(homerooms) };
    return {
      mode: "custom",
      emails: customEmails
        .split(/[\n,]/)
        .map((e) => e.trim())
        .filter(Boolean),
    };
  };

  const runPreview = async () => {
    setError(null);
    setResult(null);
    setPreviewing(true);
    try {
      const res = await fetch("/api/send-notice-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, audience: buildAudience(), dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "대상자를 계산하지 못했습니다.");
      setPreview(data);
      setShowAllEmails(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "대상자를 계산하지 못했습니다.");
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    if (!preview) return;
    const overLimit = preview.todaySentCount + preview.count > GMAIL_DAILY_LIMIT;
    const resendNotice = lastBatch
      ? `이미 ${fmtDateTime(lastBatch.created_at)}에 ${lastBatch.recipient_count}명에게 발송된 공지입니다. 다시 보내시겠습니까?\n\n`
      : "";
    const limitNotice = overLimit
      ? `⚠️ 오늘 발송 예정 수(${preview.todaySentCount + preview.count}통)가 Gmail 일일 한도(약 ${GMAIL_DAILY_LIMIT}통)를 넘을 수 있습니다.\n\n`
      : "";
    const confirmed = window.confirm(
      `${resendNotice}${limitNotice}"${preview.description}" 대상 총 ${preview.count}명에게 이메일을 보냅니다. 계속하시겠습니까?`
    );
    if (!confirmed) return;

    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/send-notice-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, audience: buildAudience() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발송에 실패했습니다.");
      setResult({ sent: data.sent, failed: data.failed, total: data.total });
      setPreview(null);
      supabase
        .from("email_notification_batches")
        .select("*")
        .eq("id", data.batchId)
        .single()
        .then(({ data: b }) => setLastBatch((b as EmailNotificationBatch) ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const toggleGrade = (g: string) =>
    setGrades((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  const toggleHomeroom = (h: number) =>
    setHomerooms((prev) => {
      const next = new Set(prev);
      next.has(h) ? next.delete(h) : next.add(h);
      return next;
    });

  if (!isAuto && !isAdmin && !isEditor) return null; // teacher는 isAuto가 아니면 애초에 이 공지를 쓸 수 없다

  return (
    <div className="border-t border-border mt-3.5 pt-3.5">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        이메일로 알림 보내기
      </label>
      {lastBatch && (
        <p className="text-[11px] text-muted mt-1">
          최근 발송: {fmtDateTime(lastBatch.created_at)} · {lastBatch.audience_description} · {lastBatch.recipient_count}명
          (성공 {lastBatch.success_count} / 실패 {lastBatch.failure_count})
        </p>
      )}
      {open && (
        <div className="bg-bg rounded-lg p-3.5 mt-2 flex flex-col gap-2">
          {isAuto ? (
            <p className="text-xs text-muted m-0">
              교과/학급 공지는 이미 저장된 대상(교과 수강생 또는 해당 학급)에게만 자동으로 발송됩니다.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="audience-mode"
                    checked={mode === "all"}
                    disabled={!isAdmin}
                    onChange={() => setMode("all")}
                  />
                  전체 학생/교사 {!isAdmin && <span className="text-[11px] text-muted">(admin 이상만 선택 가능)</span>}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="audience-mode" checked={mode === "grades"} onChange={() => setMode("grades")} />
                  특정 학년만
                </label>
                {mode === "grades" && (
                  <div className="flex gap-2 ml-6">
                    {GRADES.map((g) => (
                      <label key={g} className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={grades.has(g)} onChange={() => toggleGrade(g)} /> {g}학년
                      </label>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2">
                  <input type="radio" name="audience-mode" checked={mode === "homerooms"} onChange={() => setMode("homerooms")} />
                  특정 학급만
                </label>
                {mode === "homerooms" && (
                  <div className="flex gap-2 ml-6">
                    {HOMEROOMS.map((h) => (
                      <label key={h.value} className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={homerooms.has(h.value)} onChange={() => toggleHomeroom(h.value)} /> {h.label}
                      </label>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2">
                  <input type="radio" name="audience-mode" checked={mode === "custom"} onChange={() => setMode("custom")} />
                  직접 입력
                </label>
                {mode === "custom" && (
                  <textarea
                    rows={3}
                    className="border border-border rounded-lg px-2.5 py-2 text-xs ml-6"
                    placeholder="이메일 주소를 쉼표 또는 줄바꿈으로 구분해서 입력하세요"
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                  />
                )}
              </div>
            </>
          )}

          <button
            onClick={runPreview}
            disabled={previewing}
            className="border border-border bg-white text-sm font-bold rounded-lg px-3 py-1.5 self-start"
          >
            {previewing ? "확인 중…" : "대상자 확인"}
          </button>

          {preview && (
            <div className="bg-white border border-border rounded-lg p-3 text-sm flex flex-col gap-1.5">
              <div className="font-bold">
                총 {preview.count}명에게 발송됩니다 ({preview.description})
              </div>
              {preview.todaySentCount + preview.count > GMAIL_DAILY_LIMIT && (
                <div className="text-red text-xs font-bold">
                  ⚠️ 오늘 발송 예정 수가 Gmail 일일 한도(약 {GMAIL_DAILY_LIMIT}통)를 넘을 수 있습니다.
                </div>
              )}
              {preview.count > 0 && (
                <div className="text-xs text-muted">
                  {(showAllEmails ? preview.emails : preview.emails.slice(0, 20)).join(", ")}
                  {!showAllEmails && preview.emails.length > 20 && (
                    <>
                      {" "}
                      외 {preview.count - 20}명{" "}
                      <button className="text-blue font-bold" onClick={() => setShowAllEmails(true)}>
                        전체 보기
                      </button>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={send}
                disabled={sending || preview.count === 0}
                className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 mt-1 self-start disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? "발송 중…" : lastBatch ? "재발송" : "발송"}
              </button>
            </div>
          )}

          {result && (
            <div className="text-sm bg-[#E4F5EE] text-teal rounded-lg px-3 py-2">
              발송 완료 — 성공 {result.sent}건 / 실패 {result.failed}건 (총 {result.total}명)
            </div>
          )}
          {error && <div className="text-red text-xs">{error}</div>}
        </div>
      )}
    </div>
  );
}
