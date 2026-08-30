import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { DEFAULT_HOME_THEME, isHomeThemeKey } from "@/lib/homeTheme";
import AdminNav from "@/components/admin/AdminNav";
import AdminHeader from "@/components/admin/AdminHeader";
import DesignerModeGate from "@/components/admin/DesignerModeGate";
import AdminDateBadgeSync from "@/components/admin/AdminDateBadgeSync";
import AdminThemeProvider from "@/components/admin/AdminThemeProvider";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts 에서 1차로 걸러지지만, 서버 컴포넌트 레벨에서도 한 번 더 확인합니다.
  // sub_editor는 /admin/org-activities/*만 middleware가 통과시키므로, 여기서는 세부
  // 경로를 다시 따지지 않고 "관리 화면에 발 들일 자격이 있는 역할인지"만 본다.
  // teacher는 관리 화면 접근 권한이 없다(student와 동일하게 차단됨). designer(조회 전용)는
  // 모든 관리 화면에 들어올 수 있어야 하므로 포함한다 — 실제 데이터 변경은 RLS가 막는다.
  const profile = await getCurrentProfile();
  if (!profile || !["sub_editor", "editor", "admin", "superadmin", "designer"].includes(profile.role)) {
    redirect("/login?next=/admin");
  }

  // AdminHeader/AdminNav도 site_theme을 실시간 구독해서 가져오는데, 그 값이 도착하기 전까지는
  // 항상 기본값으로 렌더링돼서 /admin 진입마다 "기본 UI"가 잠깐 보였다 실제 테마로 바뀌는
  // 깜빡임이 있었다((site)/layout.tsx에서 같은 문제를 고친 것과 동일한 원인). 여기서도
  // 서버에서 미리 조회한 값을 초기값으로 내려준다.
  const supabase = createClient();
  const { data: siteTheme } = await supabase.from("site_theme").select("theme").eq("id", "default").maybeSingle();
  const rawThemeValue = siteTheme?.theme ?? "";
  const initialThemeKey = isHomeThemeKey(rawThemeValue) ? rawThemeValue : DEFAULT_HOME_THEME;

  return (
    <AdminThemeProvider initialThemeKey={initialThemeKey}>
      <div className="min-h-screen bg-[#F2F4F8]">
        <AdminHeader profile={profile} initialThemeKey={initialThemeKey} />
        <div className="max-w-[1280px] mx-auto flex">
          <AdminNav role={profile.role} isCouncil={profile.is_council} initialThemeKey={initialThemeKey} />
          <main className="flex-1 p-6 min-w-0">
            <AdminDateBadgeSync userId={profile.id} />
            <DesignerModeGate isDesigner={profile.role === "designer"}>{children}</DesignerModeGate>
          </main>
        </div>
      </div>
    </AdminThemeProvider>
  );
}
