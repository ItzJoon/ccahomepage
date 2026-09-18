"use client";

import { useState } from "react";
import { adminDisplayName } from "@/lib/displayName";
import type { NotificationItem } from "@/lib/types";

interface NotificationWithSender extends NotificationItem {
  sender: { name: string | null; nickname: string | null; email: string } | null;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

/**
 * 발송 이력 항목 하나의 상세 내용을 보여주고, "이 설정 그대로 다시 발송"으로
 * 새 발송 폼에 프리필할 수 있게 한다. 실제 프리필/발송 로직은 admin/notify/page.tsx가
 * 갖고 있고(onResend), 여기는 순수 표시 + 트리거 역할만 한다.
 */
export default function NotifyDetailModal({
  notification: n,
  onClose,
  onResend,
}: {
  notification: NotificationWithSender;
  onClose: () => void;
  onResend: () => void;
}) {
  const [imageOk, setImageOk] = useState(true);
  const isImageOnly = !!n.image_url && !n.message.trim();

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border last:border-b-0">
      <span className="text-[11px] font-bold text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="m-0">발송 상세</h3>
          <button onClick={onClose} className="text-muted text-xl leading-none shrink-0">
            ✕
          </button>
        </div>

        {row("발송 대상", n.audience_description || "전체 학생/교사")}
        {row(
          "노출 방식",
          <>
            {n.display_type === "popup" ? "팝업" : "배너"}
            {isImageOnly && " · 이미지 전용(제목/본문 없이 이미지만 표시)"}
            {" · "}
            {n.level === "urgent" ? "긴급" : "일반 안내"}
          </>
        )}
        {row(
          "첨부 이미지",
          n.image_url ? (
            imageOk ? (
              <img
                src={n.image_url}
                alt="첨부 이미지"
                className="max-w-full max-h-48 rounded-lg border border-border object-contain mt-1"
                onError={() => setImageOk(false)}
              />
            ) : (
              <span className="text-muted">삭제됨(원본 파일을 찾을 수 없음)</span>
            )
          ) : (
            <span className="text-muted">없음</span>
          )
        )}
        {row(
          "첨부 사운드",
          n.sound_url ? (
            <audio controls src={n.sound_url} className="mt-1 w-full h-9" />
          ) : (
            <span className="text-muted">없음(첨부 안 함 또는 노출 종료 후 자동 정리됨)</span>
          )
        )}
        {row(
          "노출 기간",
          n.display_until ? `${fmtDateTime(n.sent_at)} ~ ${fmtDateTime(n.display_until)}` : "무기한"
        )}
        {row("제목", n.title)}
        {row("본문", n.message.trim() ? <span className="whitespace-pre-wrap">{n.message}</span> : <span className="text-muted">없음</span>)}
        {n.link_url && row("클릭 시 이동 링크", n.link_url)}
        {row("발송 시각", fmtDateTime(n.sent_at))}
        {row("발송한 관리자", adminDisplayName(n.sender))}
        {row(
          "발송 결과",
          <>
            발송 완료(배너·팝업은 이메일과 달리 수신자별 성공/실패 기록이 없는 방식입니다 — 대상
            조건에 맞는 학생/교사 화면에 표시됩니다). 이메일로도 함께 보냈다면 "이메일 발송 이력"
            탭에 별도로 기록되어 있습니다.
          </>
        )}

        <button
          onClick={onResend}
          className="w-full bg-navy text-white font-bold text-sm rounded-lg px-5 py-2.5 mt-4"
        >
          이 설정 그대로 다시 발송
        </button>
      </div>
    </div>
  );
}
