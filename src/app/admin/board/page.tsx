"use client";

import AdminTable, { truncateCellProps, actionCellClass } from "@/components/admin/AdminTable";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { BoardPost } from "@/lib/types";

interface Row extends BoardPost {
  author: { name: string | null; nickname: string | null; email: string } | null;
}

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function AdminBoardPage() {
  const supabase = createClient();
  // is_editor_or_above()가 board_posts_read를 통과시켜주므로, 관리자는 숨김 글도 함께 본다.
  const { rows, reload } = useRealtimeList<Row>("board_posts", {
    select: "*, author:profiles(name, nickname, email)",
    orderBy: { column: "created_at", ascending: false },
  });
  const { isAdmin: iAmAdmin, role } = useMyRole();
  // designer도 admin과 동일하게 게시글 삭제를 쓸 수 있다(RLS의
  // board_posts_delete_own_or_admin이 is_designer()를 허용).
  const canDelete = iAmAdmin || role === "designer";
  const { t } = useHomeTheme();

  const remove = async (id: string) => {
    if (!confirm("이 글을 삭제하시겠습니까? 댓글도 함께 삭제됩니다.")) return;
    await supabase.from("board_posts").delete().eq("id", id);
    reload();
  };

  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("board_posts").update({ is_hidden: !isHidden }).eq("id", id);
    reload();
  };

  return (
    <div>
      <h2 className="text-[22px] mb-4">게시판 관리</h2>
      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>제목</th>
            <th className={`${t.adminTableHeaderCell} w-28`}>작성자</th>
            <th className={`${t.adminTableHeaderCell} w-20`}>상태</th>
            <th className={`${t.adminTableHeaderCell} w-24`}>날짜</th>
            <th className={`${t.adminTableHeaderCell} w-32`} />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className={t.adminTableCell}>
                <Link href={`/board/${p.id}`} target="_blank" {...truncateCellProps(p.title)} className="block truncate text-blue hover:underline">
                  {p.title}
                </Link>
              </td>
              <td className={`${t.adminTableCell} text-muted`}>
                {p.author?.nickname || p.author?.name || p.author?.email || "-"}
              </td>
              <td className={t.adminTableCell}>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    p.is_hidden ? "bg-[#EEF1F6] text-muted" : "bg-[#E4F5EE] text-teal"
                  }`}
                >
                  {p.is_hidden ? "숨김" : "공개"}
                </span>
              </td>
              <td className={t.adminTableCell}>{fmt(p.created_at)}</td>
              <td className={t.adminTableCell}>
                <div className={actionCellClass}>
                  <button className="text-blue text-xs font-bold shrink-0" onClick={() => toggleHidden(p.id, p.is_hidden)}>
                    {p.is_hidden ? "숨김 해제" : "숨김"}
                  </button>
                  {canDelete ? (
                    <button className={`${t.adminBtnDanger} shrink-0`} onClick={() => remove(p.id)}>삭제</button>
                  ) : (
                    <span className="text-muted text-xs shrink-0" title="삭제는 admin 이상만 가능합니다">🔒</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 글이 없습니다.</td></tr>
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
