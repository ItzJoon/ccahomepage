import { createClient } from "@/lib/supabase/server";
import { DEFAULT_HOME_THEME, isHomeThemeKey } from "@/lib/homeTheme";
import AdminDashboardHome from "@/components/admin/AdminDashboardHome";

export default async function AdminDashboard() {
  const supabase = createClient();
  const [
    { count: noticeCount },
    { count: newsCount },
    { count: eventCount },
    { data: pendingQ },
    { data: pendingReports },
    { data: recentPosts },
    { data: siteTheme },
  ] = await Promise.all([
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("type", "notice"),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("type", "news"),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("questions").select("id").eq("status", "pending"),
    supabase.from("reports").select("id").eq("status", "pending"),
    supabase
      .from("posts")
      .select("id, type, title, created_at, author_name")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("site_theme").select("theme").eq("id", "default").maybeSingle(),
  ]);

  const rawThemeValue = siteTheme?.theme ?? "";
  const initialThemeKey = isHomeThemeKey(rawThemeValue) ? rawThemeValue : DEFAULT_HOME_THEME;

  return (
    <AdminDashboardHome
      stats={{
        noticeCount: noticeCount ?? 0,
        newsCount: newsCount ?? 0,
        eventCount: eventCount ?? 0,
        pendingQCount: pendingQ?.length ?? 0,
        pendingReportCount: pendingReports?.length ?? 0,
      }}
      recentPosts={recentPosts ?? []}
      initialThemeKey={initialThemeKey}
    />
  );
}
