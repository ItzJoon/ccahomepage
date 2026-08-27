import { createClient } from "@/lib/supabase/server";

export default async function AdminStatsPage() {
  const supabase = createClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ count: totalStudents }, { data: recentAttendance }, { data: topStreaks }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase
      .from("user_attendance")
      .select("visit_date")
      .gte("visit_date", thirtyDaysAgo.toISOString().slice(0, 10)),
    supabase
      .from("user_attendance")
      .select("user_id, streak_count, profiles(name, email)")
      .order("streak_count", { ascending: false })
      .limit(10),
  ]);

  return (
    <div>
      <h2 className="text-[22px] mb-4">접속 통계</h2>
      <div className="flex gap-3 flex-wrap mb-6">
        <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[150px]">
          <div className="font-serif font-black text-2xl">{totalStudents ?? 0}</div>
          <div className="text-sm text-muted">가입 학생 수</div>
        </div>
        <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[150px]">
          <div className="font-serif font-black text-2xl">{recentAttendance?.length ?? 0}</div>
          <div className="text-sm text-muted">최근 30일 총 방문 횟수</div>
        </div>
      </div>
      <h3 className="mb-2">연속 접속일수 상위 학생</h3>
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">이메일</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">연속 접속일</th>
          </tr>
        </thead>
        <tbody>
          {(topStreaks ?? []).map((row: any, i: number) => (
            <tr key={i}>
              <td className="p-2.5 border-b border-border text-sm">{row.profiles?.name || "-"}</td>
              <td className="p-2.5 border-b border-border text-sm">{row.profiles?.email}</td>
              <td className="p-2.5 border-b border-border text-sm">{row.streak_count}일</td>
            </tr>
          ))}
          {(!topStreaks || topStreaks.length === 0) && (
            <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">아직 접속 기록이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
