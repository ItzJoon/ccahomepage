"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useTrackPageVisit } from "@/hooks/useTrackPageVisit";
import SectionTitle from "@/components/SectionTitle";
import Badge, { Pin } from "@/components/Badge";
import PostManager from "@/components/admin/PostManager";
import AdminTable, { truncateCellProps, actionCellClass } from "@/components/admin/AdminTable";
import type { Post } from "@/lib/types";

interface Row extends Post {
  author_name: string | null;
}

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function NoticesPage() {
  useTrackPageVisit("notices"); // "탐험가" 뱃지용 방문 기록
  const supabase = createClient();
  // 교과/학급 공지도 같이 조회한다 — RLS가 본인이 대상인 것만 돌려주므로(student_subjects
  // 수강 과목 일치 / homeroom 일치), 여기서 별도로 필터링할 필요는 없다.
  // author_name은 profiles를 그대로 조인하면 다른 사람 이름이 RLS에 막혀 비어오므로,
  // 안전하게 이름만 반환하는 computed column을 대신 쓴다(supabase/schema.sql 51번 참고).
  const { rows, reload } = useRealtimeList<Row>("posts", {
    select: "*, author_name",
    filter: (q) => q.in("type", ["notice", "subject_notice", "homeroom_notice"]).eq("status", "published"),
    orderBy: { column: "created_at", ascending: false },
  });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("전체");
  // 공지 작성 권한(WRITABLE_ROLES였던 editor 이상)은 useMyRole의 isEditorUp과 정확히
  // 같은 기준이다 — teacher는 student와 동일하게 권한이 차단돼서 더 이상 여기 포함되지
  // 않는다(예전엔 교과·학급 공지 자동 타겟팅으로 작성 가능했음).
  const { myId, isEditorUp: canWrite, isTeacher, isAdmin: iAmAdmin } = useMyRole();
  const [composerOpen, setComposerOpen] = useState(false);

  // 관리자 화면(/admin/notices)과 동일한 기준 — editor 이상은 전부, teacher는 본인이 쓴
  // 교과/학급 공지만 숨김 처리할 수 있다(RLS도 동일하게 검증한다).
  const canHide = (n: Row) => canWrite && !(isTeacher && n.type !== "notice" && n.author_id !== myId);

  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("posts").update({ is_hidden: !isHidden }).eq("id", id);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("posts").delete().eq("id", id);
    reload();
  };

  const cats = useMemo(() => ["전체", ...Array.from(new Set(rows.map((n) => n.category)))], [rows]);

  const list = rows
    .filter((n) => (cat === "전체" ? true : n.category === cat))
    .filter((n) => n.title.includes(q) || n.content.includes(q))
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at));

  return (
    <div>
      <SectionTitle
        eyebrow="NOTICE"
        title="공지사항"
        action={
          canWrite ? (
            <button onClick={() => setComposerOpen(true)} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">
              + 새 공지 작성
            </button>
          ) : undefined
        }
      />
      <div className="flex gap-2.5 mb-3.5 flex-wrap">
        <input
          className="flex-1 min-w-[200px] border border-border rounded-lg px-3 py-2 text-sm"
          placeholder="제목 또는 내용 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="border border-border rounded-lg px-3 py-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {composerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
          onClick={() => setComposerOpen(false)}
        >
          <div className="w-full max-w-xl mt-4 mb-8" onClick={(e) => e.stopPropagation()}>
            <PostManager type="notice" label="공지사항" hideList autoStartNew onClose={() => setComposerOpen(false)} />
          </div>
        </div>
      )}
      <AdminTable>
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">분류</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">작성자</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">날짜</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16">조회</th>
            {canWrite && <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-32" />}
          </tr>
        </thead>
        <tbody>
          {list.map((n) => (
            <tr key={n.id} className="hover:bg-[#F2F4F8]">
              <td className="p-2.5 border-b border-border">
                {n.type === "subject_notice" ? (
                  <Badge color="teal">교과·{n.target_subject}</Badge>
                ) : n.type === "homeroom_notice" ? (
                  <Badge color="gold">학급·{n.target_homeroom}반</Badge>
                ) : (
                  <Badge color="navy">{n.category}</Badge>
                )}
              </td>
              <td className="p-2.5 border-b border-border">
                <Link href={`/notices/${n.id}`} className="flex items-center gap-1">
                  {n.is_pinned && <Pin />} <span {...truncateCellProps(n.title)}>{n.title}</span>
                  {n.is_hidden && (
                    <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] text-muted">숨김</span>
                  )}
                </Link>
              </td>
              <td className="p-2.5 border-b border-border text-sm text-muted">{n.author_name || "-"}</td>
              <td className="p-2.5 border-b border-border text-sm">{fmt(n.publish_at)}</td>
              <td className="p-2.5 border-b border-border text-sm">{n.view_count}</td>
              {canWrite && (
                <td className="p-2.5 border-b border-border">
                  <div className={actionCellClass}>
                    {canHide(n) && (
                      <button
                        className="text-blue text-xs font-bold shrink-0"
                        onClick={() => toggleHidden(n.id, n.is_hidden)}
                      >
                        {n.is_hidden ? "숨김 해제" : "숨김"}
                      </button>
                    )}
                    {iAmAdmin ? (
                      <button className="text-red text-xs font-bold shrink-0" onClick={() => remove(n.id)}>
                        삭제
                      </button>
                    ) : (
                      <span className="text-muted text-xs shrink-0" title="삭제는 admin 이상만 가능합니다.">
                        🔒
                      </span>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </AdminTable>
      {list.length === 0 && <div className="text-muted text-center py-8 text-sm">검색 결과가 없습니다.</div>}
    </div>
  );
}
