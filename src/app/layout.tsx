import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NotificationBanner from "@/components/NotificationBanner";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "학생자치회",
  description: "학생자치회 공식 사이트",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: customPages } = await supabase
    .from("pages")
    .select("id, slug, title, content, is_published, menu_visible, order_index")
    .eq("is_published", true)
    .eq("menu_visible", true)
    .order("order_index");

  const { data: latestNotification } = await supabase
    .from("notifications")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen flex flex-col">
          <Header profile={profile as any} customPages={customPages ?? []} />
          <NotificationBanner initial={latestNotification as any} />
          <main className="flex-1 max-w-[1180px] mx-auto px-5 py-7 w-full">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
