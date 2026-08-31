"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { fakeName, fakeEmail } from "@/lib/fakeData";
import AdminTable from "./AdminTable";

type TopStreak = { user_id: string; streak_count: number; name: string | null; email: string };
type AttendanceRow = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
  visit_date: string;
  streak_count: number;
  is_freeze: boolean;
  created_at: string;
};

const LOG_SELECT = "id, name, nickname, email, visit_date, streak_count, is_freeze, created_at";

export default function StatsTabs({
  totalUsers,
  studentCount,
  teacherCount,
  staffCount,
  todayVisitCount,
  topStreaks,
  maskPII = false,
}: {
  totalUsers: number;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
  todayVisitCount: number;
  topStreaks: TopStreak[];
  // designer(조회 전용)가 이 화면을 볼 때 true — "전체 접속 기록" 탭은 서버에서 미리
  // 가릴 수 없는(실시간 구독 + 검색이 클라이언트에서 직접 조회) 실제 이름/이메일이라
  // 여기서 렌더링 직전에 가짜 값으로 바꾼다. topStreaks(요약 탭)는 이미 서버(stats/page.tsx)
  // 에서 가짜 값으로 바뀐 채로 내려온다.
  maskPII?: boolean;
}) {
  const [tab, setTab] = useState<"log" | "summary">("log");
  const supabase = createClient();
  const { t } = useHomeTheme();

  // 전체 접속 기록은 다른 관리 화면들과 같은 방식(useRealtimeList)으로 실시간 반영한다.
  // 예전에는 페이지 진입 시 서버에서 한 번만 조회해서, 화면을 열어둔 채로 있으면 그 이후
  // 생긴 체크인이 새로고침 전까지 전혀 보이지 않는 문제가 있었다. postgres_changes
  // 구독은 뷰가 아니라 원본 테이블에서만 동작하므로 table은 user_attendance, 실제 조회는
  // 이름/이메일이 조인된 user_attendance_with_name 뷰에서 한다.
  const { rows: liveLog, loading: liveLogLoading } = useRealtimeList<AttendanceRow>("user_attendance", {
    selectFrom: "user_attendance_with_name",
    select: LOG_SELECT,
    orderBy: { column: "created_at", ascending: false },
    limit: 200,
  });

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<AttendanceRow[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      // PostgREST의 or() 필터 문법에서 콤마/괄호가 특별한 의미를 가지므로 제거해 안전하게 만든다.
      const safeQ = q.replace(/[,()]/g, "");
      const { data } = await supabase
        .from("user_attendance_with_name")
        .select(LOG_SELECT)
        .or(`name.ilike.%${safeQ}%,nickname.ilike.%${safeQ}%,email.ilike.%${safeQ}%`)
        .order("created_at", { ascending: false })
        .limit(300);
      setSearchResults((data as any) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, supabase]);

  const attendanceLog = searchResults ?? liveLog;

  return (
    <div>
      <div className="flex gap-1.5 mb-5 border-b border-border">
        <button
          onClick={() => setTab("log")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
            tab === "log" ? `border-current ${t.sectionAccentColor}` : "border-transparent text-muted"
          }`}
        >
          전체 접속 기록
        </button>
        <button
          onClick={() => setTab("summary")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
            tab === "summary" ? `border-current ${t.sectionAccentColor}` : "border-transparent text-muted"
          }`}
        >
          요약
        </button>
      </div>

      {tab === "log" && (
        <div>
          <div className="flex gap-3 flex-wrap mb-6">
            <div className={`${t.dashStatCard} min-w-[150px]`}>
              <div className="font-serif font-black text-2xl">{todayVisitCount}</div>
              <div className="text-sm text-muted">하루 방문 횟수</div>
            </div>
            <div className={`${t.dashStatCard} min-w-[150px]`}>
              <div className="font-serif font-black text-2xl">{totalUsers}</div>
              <div className="text-sm text-muted">전체 가입자 수</div>
            </div>
            <div className={`${t.dashStatCard} min-w-[150px]`}>
              <div className="font-serif font-black text-2xl">{teacherCount}</div>
              <div className="text-sm text-muted">선생님 수</div>
            </div>
            <div className={`${t.dashStatCard} min-w-[150px]`}>
              <div className="font-serif font-black text-2xl">{studentCount}</div>
              <div className="text-sm text-muted">전체 학생 수</div>
            </div>
            <div className={`${t.dashStatCard} min-w-[150px]`}>
              <div className="font-serif font-black text-2xl">{staffCount}</div>
              <div className="text-sm text-muted">관리 권한 계정 수</div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="m-0">
              전체 접속 기록 {searchResults ? `(검색 결과 ${searchResults.length}건)` : "(최신순, 최근 200건)"}
            </h3>
            <input
              className={`${t.adminInput} w-full max-w-xs`}
              placeholder="이름 또는 이메일로 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <AdminTable>
            <thead>
              <tr>
                <th className={`${t.adminTableHeaderCell} w-40`}>체크인 시각</th>
                <th className={t.adminTableHeaderCell}>이름</th>
                <th className={t.adminTableHeaderCell}>이메일</th>
                <th className={`${t.adminTableHeaderCell} w-24`}>연속일수</th>
                <th className={`${t.adminTableHeaderCell} w-20`}>프리즈</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLog.map((row) => (
                <tr key={row.id}>
                  <td className={t.adminTableCell}>{new Date(row.created_at).toLocaleString("ko-KR")}</td>
                  <td className={t.adminTableCell}>{maskPII ? fakeName(row.id) : row.nickname || row.name || "-"}</td>
                  <td className={t.adminTableCell}>{maskPII ? fakeEmail(row.id) : row.email}</td>
                  <td className={t.adminTableCell}>{row.streak_count}일</td>
                  <td className={t.adminTableCell}>{row.is_freeze ? "❄️" : ""}</td>
                </tr>
              ))}
              {attendanceLog.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted text-center py-8 text-sm">
                    {searching || (liveLogLoading && !searchResults)
                      ? "불러오는 중…"
                      : searchResults
                      ? "검색 결과가 없습니다."
                      : "아직 접속 기록이 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
        </div>
      )}

      {tab === "summary" && (
        <div>
          <h3 className="mb-2">연속 접속일수 상위 학생</h3>
          <AdminTable>
            <thead>
              <tr>
                <th className={t.adminTableHeaderCell}>이름</th>
                <th className={t.adminTableHeaderCell}>이메일</th>
                <th className={`${t.adminTableHeaderCell} w-28`}>연속 접속일</th>
              </tr>
            </thead>
            <tbody>
              {topStreaks.map((row, i) => (
                <tr key={i}>
                  <td className={t.adminTableCell}>{row.name || "-"}</td>
                  <td className={t.adminTableCell}>{row.email}</td>
                  <td className={t.adminTableCell}>{row.streak_count}일</td>
                </tr>
              ))}
              {topStreaks.length === 0 && (
                <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">아직 접속 기록이 없습니다.</td></tr>
              )}
            </tbody>
          </AdminTable>
        </div>
      )}
    </div>
  );
}
