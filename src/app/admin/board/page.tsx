"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
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
  const [iAmAdmin, setIAmAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIAmAdmin(!!me && ["admin", "superadmin"].includes(me.role));
    });
  }, [supabase]);

  const remove = async (id: string) => {
    if (!confirm("이 글을 삭제하시겠습니까? 댓글도 함께 삭제됩니다.")) return;
    await supabase.from("board_posts").delete().eq("id", id);
    reload();
  };

  return (
    <div>
      <h2 className="text-[22px] mb-4">게시판 관리</h2>
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">작성자</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">상태</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">날짜</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="p-2.5 border-b border-border text-sm">{p.title}</td>
              <td className="p-2.5 border-b border-border text-sm text-muted">
                {p.author?.nickname || p.author?.name || p.author?.email || "-"}
              </td>
              <td className="p-2.5 border-b border-border">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    p.is_hidden ? "bg-[#EEF1F6] text-muted" : "bg-[#E4F5EE] text-teal"
                  }`}
                >
                  {p.is_hidden ? "숨김" : "공개"}
                </span>
              </td>
              <td className="p-2.5 border-b border-border text-sm">{fmt(p.created_at)}</td>
              <td className="p-2.5 border-b border-border">
                {iAmAdmin ? (
                  <button className="text-red text-xs font-bold" onClick={() => remove(p.id)}>삭제</button>
                ) : (
                  <span className="text-muted text-xs" title="삭제는 admin 이상만 가능합니다">🔒</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 글이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
