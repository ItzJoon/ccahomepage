import { createClient } from "@/lib/supabase/server";
import StatsTabs from "@/components/admin/StatsTabs";

export default async function AdminStatsPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: totalUsers },
    { count: studentCount },
    { count: teacherCount },
    { count: staffCount },
    { data: todayAttendance },
    { data: topStreaks },
    { data: attendanceLog },
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
    supabase
      .from("user_attendance")
      .select("user_id, streak_count, profiles(name, email)")
      .order("streak_count", { ascending: false })
      .limit(10),
    supabase
      .from("user_attendance_with_name")
      .select("id, name, nickname, email, visit_date, streak_count, is_freeze, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
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
        topStreaks={(topStreaks as any) ?? []}
        attendanceLog={(attendanceLog as any) ?? []}
      />
    </div>
  );
}
