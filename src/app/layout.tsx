import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NotificationBanner from "@/components/NotificationBanner";
import NotificationPopup from "@/components/NotificationPopup";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "학생자치회",
  description: "학생자치회 공식 사이트",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  // 프로필/커스텀 페이지/배너/팝업 조회는 서로 의존관계가 없는데, 하나씩 순서대로 기다리면
  // 매 페이지 로드마다 Supabase 왕복이 그만큼 누적된다. 동시에 요청해서 가장 느린 것 하나만큼만 기다린다.
  const [profile, { data: customPages }, { data: latestBanner }, { data: latestPopup }] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("pages")
      .select("id, slug, title, content, is_published, menu_visible, order_index")
      .eq("is_published", true)
      .eq("menu_visible", true)
      .order("order_index"),
    supabase
      .from("notifications")
      .select("*")
      .eq("display_type", "banner")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("*")
      .eq("display_type", "popup")
      .eq("popup_active", true)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen flex flex-col">
          <Header profile={profile as any} customPages={customPages ?? []} />
          <NotificationBanner initial={latestBanner as any} />
          <NotificationPopup initial={latestPopup as any} />
          <main className="flex-1 max-w-[1180px] mx-auto px-5 py-7 w-full">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
