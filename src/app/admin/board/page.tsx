"use client";

import AdminTable, { truncateCellProps, actionCellClass } from "@/components/admin/AdminTable";
import AuthorCell from "@/components/admin/AuthorCell";
import AdminPersonMenu from "@/components/admin/AdminPersonMenu";
import ImageLightbox from "@/components/ImageLightbox";
import { adminDisplayName } from "@/lib/displayName";
import Link from "next/link";
import { useState } from "react";
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
    // board_post_reads가 board_posts와 profiles 양쪽에 FK를 걸면서 board_posts→profiles
    // 임베딩 경로가 author_id 경유/board_post_reads 경유 둘로 늘어나 PostgREST가 어느 쪽인지
    // 못 정해 에러(PGRST201)를 낸다 — FK 이름을 명시해서 author_id 경로로 고정한다.
    select: "*, author:profiles!board_posts_author_id_fkey(name, nickname, email)",
    orderBy: { column: "created_at", ascending: false },
  });
  const { isAdmin: iAmAdmin, role } = useMyRole();
  // designer도 admin과 동일하게 게시글 삭제를 쓸 수 있다(RLS의
  // board_posts_delete_own_or_admin이 is_designer()를 허용).
  const canDelete = iAmAdmin || role === "designer";
  const { t } = useHomeTheme();
  // 예전엔 제목을 누르면 새 탭으로 실제 게시글 페이지가 열렸는데, 관리자 화면을 벗어나지
  // 않고 그 자리에서 바로 볼 수 있게 상세 패널(신고 내역/Q&A 관리와 동일한 패턴)로 바꿨다.
  const [openId, setOpenId] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!confirm("이 글을 삭제하시겠습니까? 댓글도 함께 삭제됩니다.")) return;
    await supabase.from("board_posts").delete().eq("id", id);
    if (openId === id) setOpenId(null);
    reload();
  };

  // 숨김/숨김 해제 어느 쪽이든 관리자가 이미 이 글을 살펴봤다는 뜻이라 함께 확인 처리한다
  // (목록 행의 숨김 버튼은 상세를 열지 않고도 바로 누를 수 있어, 클릭 열람 처리만으로는
  // 놓치는 경로라 따로 챙긴다).
  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("board_posts").update({ is_hidden: !isHidden, reviewed_at: new Date().toISOString() }).eq("id", id);
    reload();
  };

  // 사이드바 안 읽음 뱃지 기준(reviewed_at)을 열람 시점에 채운다 — 이미 확인한 글을
  // 다시 열 때는 굳이 다시 쓰지 않는다.
  const openPost = (p: BoardPost) => {
    setOpenId(p.id);
    if (!p.reviewed_at) {
      supabase.from("board_posts").update({ reviewed_at: new Date().toISOString() }).eq("id", p.id).then(() => reload());
    }
  };

  const current = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${current ? "lg:grid-cols-[1fr_380px]" : ""}`}>
      <div className="min-w-0">
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
              <tr
                key={p.id}
                onClick={() => openPost(p)}
                className={`cursor-pointer ${t.adminTableRowHover} ${openId === p.id ? t.adminTableRowActive : ""}`}
              >
                <td className={t.adminTableCell}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {!p.reviewed_at && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-red" title="관리자 미확인" />
                    )}
                    <span {...truncateCellProps(p.title)} className={`flex-1 min-w-0 truncate ${!p.reviewed_at ? "font-bold" : ""}`}>
                      {p.title}
                    </span>
                  </div>
                </td>
                <td className={`${t.adminTableCell} text-muted`} onClick={(e) => e.stopPropagation()}>
                  {p.author_id ? (
                    <AdminPersonMenu userId={p.author_id} name={adminDisplayName(p.author)} />
                  ) : (
                    <AuthorCell name={adminDisplayName(p.author)} />
                  )}
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
                <td className={t.adminTableCell} onClick={(e) => e.stopPropagation()}>
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

      {current && (
        <div className={`${t.adminEditPanel} sticky top-20`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="m-0">{current.title}</h3>
            <button type="button" onClick={() => setOpenId(null)} className="text-muted text-xl leading-none shrink-0">
              ✕
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted mb-3 flex-wrap">
            {current.author_id ? (
              <AdminPersonMenu userId={current.author_id} name={adminDisplayName(current.author)} />
            ) : (
              <span>{adminDisplayName(current.author)}</span>
            )}
            <span>· {fmt(current.created_at)}</span>
            <Link href={`/board/${current.id}`} target="_blank" className="text-blue font-bold ml-auto">
              실제 페이지에서 보기 ↗
            </Link>
          </div>
          <p className="text-sm whitespace-pre-wrap">{current.content}</p>
          {current.image_url && (
            <ImageLightbox
              src={current.image_url}
              alt="첨부 이미지"
              className="max-w-full rounded-lg border border-border mt-2 object-contain"
            />
          )}
          <div className="flex gap-2 mt-3.5">
            <button onClick={() => toggleHidden(current.id, current.is_hidden)} className={t.adminBtnSecondary}>
              {current.is_hidden ? "숨김 해제" : "숨김"}
            </button>
            {canDelete && (
              <button onClick={() => remove(current.id)} className={t.adminBtnDanger}>
                삭제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
