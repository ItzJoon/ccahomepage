import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { todayKST } from "@/lib/date";
import { fakeName, fakeEmail } from "@/lib/fakeData";
import StatsTabs from "@/components/admin/StatsTabs";

export default async function AdminStatsPage() {
  const supabase = createClient();
  const today = todayKST();
  const viewer = await getCurrentProfile();
  // designer(조회 전용)는 이 화면 구조는 봐야 하지만, 실제 학생 이름/이메일이 담긴
  // 연속 접속 순위는 개인정보라 볼 이유가 없다 — 서버에서 아예 가짜 값으로 바꿔서
  // 내려보낸다(브라우저로 실제 이름이 전달되지 않음).
  const maskPII = viewer?.role === "designer";

  const [
    { count: totalUsers },
    { count: studentCount },
    { count: teacherCount },
    { count: staffCount },
    { data: todayAttendance },
    { data: topStreaks },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    // "전체 학생 수": role=student이거나, suwoncca.org 학교 도메인 계정이면 role이 teacher가 아닌 한
    // (editor/admin으로 승격된 학생회 임원 계정도) 전부 학생으로 집계한다.
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .or("role.eq.student,and(email.ilike.*@suwoncca.org,role.neq.teacher)"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).in("role", ["editor", "admin", "superadmin"]),
    supabase.from("user_attendance").select("visit_date").eq("visit_date", today),
    // 같은 학생이 접속한 날짜 수만큼 여러 행으로 중복 표시되지 않도록, 사용자별 최신
    // 접속(=현재 연속 기록)만 남긴 뷰(user_latest_attendance)에서 가져온다.
    supabase
      .from("user_latest_attendance")
      .select("user_id, streak_count, name, email")
      .order("streak_count", { ascending: false })
      .limit(10),
  ]);

  return (
    <div>
      <h2 className="text-[22px] mb-4">접속 통계</h2>
      <StatsTabs
        totalUsers={totalUsers ?? 0}
        studentCount={studentCount ?? 0}
        teacherCount={teacherCount ?? 0}
        staffCount={staffCount ?? 0}
        todayVisitCount={todayAttendance?.length ?? 0}
        topStreaks={((topStreaks as any) ?? []).map((r: any) =>
          maskPII ? { ...r, name: fakeName(r.user_id), email: fakeEmail(r.user_id) } : r
        )}
        maskPII={maskPII}
      />
    </div>
  );
}
