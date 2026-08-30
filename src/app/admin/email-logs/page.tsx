"use client";

import { useState } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { EmailNotificationLog } from "@/lib/types";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminEmailLogsPage() {
  const { rows } = useRealtimeList<EmailNotificationLog>("email_notification_logs", {
    orderBy: { column: "created_at", ascending: false },
    limit: 500,
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed">("failed");

  const list = rows.filter((r) => statusFilter === "all" || r.status === statusFilter);
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <div>
      <h2 className="text-[22px] mb-2">이메일 발송 로그</h2>
      <p className="text-muted mb-4 text-sm">
        공지사항 이메일 알림 발송 결과입니다. 최근 500건까지 표시하며, 실패 건은 사유와 함께 남습니다.
        {failedCount > 0 && <span className="text-red font-bold"> 실패 {failedCount}건</span>}
      </p>
      <div className="flex border border-border rounded-lg overflow-hidden w-fit mb-3.5">
        {(["failed", "sent", "all"] as const).map((s) => (
          <button
            key={s}
            className={`px-3.5 py-1.5 text-sm font-semibold ${statusFilter === s ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "failed" ? "실패" : s === "sent" ? "성공" : "전체"}
          </button>
        ))}
      </div>
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">공지 제목</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-56">수신자</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">상태</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">실패 사유</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-32">발송 시각</th>
          </tr>
        </thead>
        <tbody>
          {list.map((l) => (
            <tr key={l.id} className="hover:bg-[#F2F4F8]">
              <td className="p-2.5 border-b border-border text-sm">{l.post_title || "(삭제된 글)"}</td>
              <td className="p-2.5 border-b border-border text-sm text-muted">{l.recipient_email}</td>
              <td className="p-2.5 border-b border-border">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    l.status === "sent" ? "bg-[#E4F5EE] text-teal" : "bg-[#FDEBEC] text-red"
                  }`}
                >
                  {l.status === "sent" ? "성공" : "실패"}
                </span>
              </td>
              <td className="p-2.5 border-b border-border text-xs text-muted">{l.error_message || "-"}</td>
              <td className="p-2.5 border-b border-border text-sm">{fmtDateTime(l.created_at)}</td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted text-center py-8 text-sm">
                기록이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
