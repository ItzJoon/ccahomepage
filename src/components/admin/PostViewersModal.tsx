"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { adminDisplayName } from "@/lib/displayName";

const PAGE_SIZE = 20;

interface ViewerRow {
  user_id: string;
  view_count: number;
  first_viewed_at: string;
  last_viewed_at: string;
  profiles: { name: string | null; nickname: string | null; email: string } | null;
}

interface Summary {
  viewer_count: number;
  total_views: number;
  audience_count: number;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 공지 상세를 로그인 사용자가 열람할 때마다 record_post_view()가 post_views에 누적한
// 기록(누가/몇 번/언제)을 관리자에게 보여준다. 기존 배치 집계 조회수(ViewCounter)와는
// 완전히 별개 테이블 — 여긴 로그인 사용자만, 그리고 개인 식별이 가능하다.
export default function PostViewersModal({
  postId,
  postTitle,
  onClose,
}: {
  postId: string;
  postTitle: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const [rows, setRows] = useState<ViewerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "count">("recent");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  // 학년/반 정보는 profiles가 아니라 directory_members(이메일 매칭)에 있어서, 조회자
  // 목록을 한 번 불러온 뒤 그 이메일들만으로 별도 조회해 매핑해둔다.
  const [gradeMap, setGradeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .rpc("get_post_view_summary", { p_post_id: postId })
      .then(({ data }) => {
        if (data && data[0]) setSummary(data[0] as Summary);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    setPage(0);
  }, [search, sortBy]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let userIds: string[] | null = null;
      const q = search.trim();
      if (q) {
        const { data: matches } = await supabase
          .from("profiles")
          .select("id")
          .or(`name.ilike.%${q}%,nickname.ilike.%${q}%,email.ilike.%${q}%`);
        userIds = (matches ?? []).map((m) => m.id);
        if (userIds.length === 0) {
          if (!cancelled) {
            setRows([]);
            setTotal(0);
            setGradeMap({});
            setLoading(false);
          }
          return;
        }
      }
      let query = supabase
        .from("post_views")
        .select("user_id, view_count, first_viewed_at, last_viewed_at, profiles(name, nickname, email)", {
          count: "exact",
        })
        .eq("post_id", postId)
        .order(sortBy === "count" ? "view_count" : "last_viewed_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (userIds) query = query.in("user_id", userIds);
      const { data, count } = await query;
      if (cancelled) return;
      const viewerRows = ((data as unknown) as ViewerRow[]) ?? [];
      setRows(viewerRows);
      setTotal(count ?? 0);

      const emails = viewerRows.map((r) => r.profiles?.email).filter((e): e is string => !!e);
      if (emails.length > 0) {
        const { data: dms } = await supabase
          .from("directory_members")
          .select("email, grade, homeroom_label")
          .in("email", emails);
        const map: Record<string, string> = {};
        (dms ?? []).forEach((d) => {
          if (d.grade && d.homeroom_label) map[d.email] = `${d.grade}학년 ${d.homeroom_label}`;
          else if (d.grade) map[d.email] = `${d.grade}학년`;
        });
        if (!cancelled) setGradeMap(map);
      } else if (!cancelled) {
        setGradeMap({});
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, search, sortBy, page, supabase]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-xs text-muted mb-0.5">조회자 목록</div>
            <h3 className="text-lg font-bold truncate">{postTitle}</h3>
          </div>
          <button onClick={onClose} className="text-muted text-2xl leading-none shrink-0" aria-label="닫기">
            ×
          </button>
        </div>

        {summary && (
          <div className="text-sm bg-bg rounded-lg px-3 py-2 mb-3">
            전체 {summary.audience_count}명 중 <strong>{summary.viewer_count}명</strong> 조회 · 총 조회{" "}
            <strong>{summary.total_views}회</strong>
          </div>
        )}

        <div className="flex gap-2 mb-3 flex-wrap">
          <input
            className={`${t.adminInput} flex-1 min-w-[160px]`}
            placeholder="이름 또는 이메일 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={t.adminInput} value={sortBy} onChange={(e) => setSortBy(e.target.value as "recent" | "count")}>
            <option value="recent">최근 조회순</option>
            <option value="count">조회 많은 순</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="text-muted text-center py-8 text-sm">불러오는 중...</div>
          ) : rows.length === 0 ? (
            <div className="text-muted text-center py-8 text-sm">
              {search ? "검색 결과가 없습니다." : "아직 조회한 사람이 없습니다."}
            </div>
          ) : (
            <ul className="list-none m-0 p-0">
              {rows.map((r) => (
                <li key={r.user_id} className="flex items-center justify-between gap-3 py-2 border-b border-border">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{adminDisplayName(r.profiles, "(탈퇴한 사용자)")}</div>
                    <div className="text-xs text-muted truncate">
                      {(r.profiles?.email && gradeMap[r.profiles.email]) || r.profiles?.email || "-"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={r.view_count > 1 ? "text-sm font-bold text-blue" : "text-sm text-muted"}>
                      {r.view_count}회
                    </div>
                    <div className="text-xs text-muted">{fmtDateTime(r.last_viewed_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-muted text-xs">전체 {total}명</span>
          <div className="flex items-center gap-2">
            <button
              className={`${t.adminBtnSecondary} disabled:opacity-40`}
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              이전
            </button>
            <span className="text-sm text-muted">
              {page + 1} / {totalPages}
            </span>
            <button
              className={`${t.adminBtnSecondary} disabled:opacity-40`}
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
