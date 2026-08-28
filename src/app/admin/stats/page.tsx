import { createClient } from "@/lib/supabase/server";
import StatsTabs from "@/components/admin/StatsTabs";

export default async function AdminStatsPage() {
  const supabase = createClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { count: totalUsers },
    { count: studentCount },
    { count: teacherCount },
    { count: staffCount },
    { data: recentAttendance },
    { data: topStreaks },
    { data: attendanceLog },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).in("role", ["editor", "admin", "superadmin"]),
    supabase
      .from("user_attendance")
      .select("visit_date")
      .gte("visit_date", thirtyDaysAgo.toISOString().slice(0, 10)),
    supabase
      .from("user_attendance")
      .select("user_id, streak_count, profiles(name, email)")
      .order("streak_count", { ascending: false })
      .limit(10),
    supabase
      .from("user_attendance_with_name")
      .select("id, name, nickname, email, visit_date, streak_count, is_freeze")
      .order("visit_date", { ascending: false })
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
        recentVisitCount={recentAttendance?.length ?? 0}
        topStreaks={(topStreaks as any) ?? []}
        attendanceLog={(attendanceLog as any) ?? []}
      />
    </div>
  );
}
