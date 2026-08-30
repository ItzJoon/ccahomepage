"use client";

import AdminTable from "./AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { EmailNotificationBatch, EmailNotificationLog } from "@/lib/types";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 공지사항 이메일 발송 이력. RLS가 본인이 보낸 batch + admin 이상은 전체를 보여주므로
 * (email_notification_batches_read_own_or_admin), 여기서 별도 필터링은 필요 없다.
 */
export default function EmailNotificationHistory({ isAdmin }: { isAdmin: boolean }) {
  const supabase = createClient();
  const { rows } = useRealtimeList<EmailNotificationBatch>("email_notification_batches", {
    orderBy: { column: "created_at", ascending: false },
    limit: 200,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [logs, setLogs] = useState<EmailNotificationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const toggleExpand = async (batchId: string) => {
    if (expanded === batchId) {
      setExpanded(null);
      return;
    }
    setExpanded(batchId);
    setLoadingLogs(true);
    const { data } = await supabase
      .from("email_notification_logs")
      .select("*")
      .eq("batch_id", batchId)
      .order("status", { ascending: true }); // failed가 sent보다 앞에 오도록
    setLogs((data as EmailNotificationLog[]) ?? []);
    setLoadingLogs(false);
  };

  return (
    <div>
      <p className="text-muted mb-3 text-sm">
        공지사항 이메일 알림 발송 이력입니다.{" "}
        {isAdmin ? "관리자는 전체 발송 이력을 볼 수 있습니다." : "본인이 보낸 발송 이력만 표시됩니다."}
      </p>
      <AdminTable>
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">공지 제목</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">대상</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">대상자 수</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">성공/실패</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-32">발송 시각</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <>
              <tr key={b.id} className="hover:bg-[#F2F4F8] cursor-pointer" onClick={() => toggleExpand(b.id)}>
                <td className="p-2.5 border-b border-border text-sm">{b.post_title || "(삭제된 글)"}</td>
                <td className="p-2.5 border-b border-border text-sm text-muted">{b.audience_description}</td>
                <td className="p-2.5 border-b border-border text-sm">{b.recipient_count}</td>
                <td className="p-2.5 border-b border-border text-sm">
                  <span className="text-teal font-bold">{b.success_count}</span> /{" "}
                  <span className="text-red font-bold">{b.failure_count}</span>
                </td>
                <td className="p-2.5 border-b border-border text-sm">{fmtDateTime(b.created_at)}</td>
              </tr>
              {expanded === b.id && (
                <tr>
                  <td colSpan={5} className="p-2.5 border-b border-border bg-[#F7F8FB]">
                    {loadingLogs ? (
                      <span className="text-muted text-xs">불러오는 중…</span>
                    ) : (
                      <ul className="list-none m-0 p-0 flex flex-col gap-1">
                        {logs.map((l) => (
                          <li key={l.id} className="text-xs flex gap-2 items-center">
                            <span className={l.status === "sent" ? "text-teal font-bold" : "text-red font-bold"}>
                              {l.status === "sent" ? "성공" : "실패"}
                            </span>
                            <span>{l.recipient_email}</span>
                            {l.error_message && <span className="text-muted">— {l.error_message}</span>}
                          </li>
                        ))}
                        {logs.length === 0 && <li className="text-muted text-xs">상세 기록이 없습니다.</li>}
                      </ul>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted text-center py-8 text-sm">
                발송 이력이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
