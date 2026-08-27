import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/server";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts 에서 1차로 걸러지지만, 서버 컴포넌트 레벨에서도 한 번 더 확인합니다.
  const profile = await getCurrentProfile();
  if (!profile || !["editor", "admin", "superadmin"].includes(profile.role)) {
    redirect("/login?next=/admin");
  }

  return (
    <div className="min-h-screen bg-[#F2F4F8]">
      <header className="bg-navy text-white sticky top-0 z-20">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between px-5 py-3">
          <Link href="/admin" className="font-bold text-lg flex items-center gap-2">
  <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white" />
  학생자치회 관리자
</Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#C9D2E3]">{profile.name || profile.email} · {profile.role}</span>
            <Link href="/" className="text-sm px-3 py-1.5 rounded-md border border-white/30 hover:bg-white/10">
              학생 화면 미리보기
            </Link>
          </div>
        </div>
      </header>
      <div className="max-w-[1280px] mx-auto flex">
        <AdminNav />
        <main className="flex-1 p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
