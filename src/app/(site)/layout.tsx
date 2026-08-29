import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NotificationBanner from "@/components/NotificationBanner";
import NotificationPopup from "@/components/NotificationPopup";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 학생용 화면 전체(공지사항, 구성원, 마이페이지 등)에 공통으로 붙는 헤더/푸터/알림.
 * 라우트 그룹(site)으로 묶어서 /admin과 레이아웃 트리를 완전히 분리했다 — 같은 레이아웃을
 * 공유하면(예: 루트 레이아웃에서 조건부로 분기) Next.js가 클라이언트 사이드 내비게이션 시
 * 공통 조상 레이아웃을 다시 그리지 않아서, 사이트 헤더를 단 채로 옮겨간 /admin 페이지에
 * 관리자 헤더가 겹쳐 보이는 버그가 있었다. 레이아웃 트리 자체를 분리해야 내비게이션마다
 * 확실하게 마운트/언마운트된다.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  // 프로필/커스텀 페이지/배너/팝업/잠금 여부 조회는 서로 의존관계가 없는데, 하나씩 순서대로
  // 기다리면 매 페이지 로드마다 Supabase 왕복이 그만큼 누적된다. 동시에 요청해서 가장 느린 것
  // 하나만큼만 기다린다. 명단(directory_members)에서 학생/교사인지(=연속 접속 체크인 대상인지)
  // 확인하는 조회는 profile.email이 있어야 하므로, profile을 가져오는 브랜치 안에서만
  // 순차적으로 이어서 하고(다른 브랜치들과는 여전히 병렬), 다른 조회를 막지 않게 한다.
  const [
    { profile, memberType },
    { data: customPages },
    { data: latestBanner },
    { data: latestPopup },
    { data: settings },
  ] = await Promise.all([
    (async () => {
      const profile = await getCurrentProfile();
      if (!profile) return { profile: null, memberType: null as string | null };
      const { data: dm } = await supabase
        .from("directory_members")
        .select("member_type")
        .eq("email", profile.email)
        .maybeSingle();
      return { profile, memberType: dm?.member_type ?? null };
    })(),
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
      supabase
        .from("site_settings")
        .select("maintenance_mode, restrict_external_checkin")
        .eq("id", "default")
        .maybeSingle(),
    ]);

  // 사이트 잠금 모드 중에는 admin/superadmin만 우회하므로(middleware.ts와 동일 기준), 그 외
  // 사용자에게는 아직 정식 운영 전이라 배너/팝업 알림 같은 상호작용도 함께 보류한다.
  const isLockdownExempt = !!profile && ["admin", "superadmin"].includes(profile.role);
  const showNotifications = !settings?.maintenance_mode || isLockdownExempt;
  // 연속 접속 체크인/뱃지 시스템은 실제 학교 구성원(학생/교사)을 위한 기능이라, "외부 계정
  // 관리"에서 개별 승인된 계정(member_type='other')에게는 기본적으로 막아둔다("접속 1일째"
  // 팝업 등이 뜨는 게 어색해서). admin/superadmin은 명단 등록 여부와 무관하게 항상 가능하고,
  // restrict_external_checkin을 관리자가 꺼두면(기본값 true) 외부 계정도 다시 허용된다.
  const checkInEligible =
    isLockdownExempt ||
    settings?.restrict_external_checkin === false ||
    memberType === "student" ||
    memberType === "teacher";

  return (
    <div className="min-h-screen flex flex-col">
      <Header profile={profile as any} customPages={customPages ?? []} checkInEligible={checkInEligible} />
      {showNotifications && <NotificationBanner initial={latestBanner as any} />}
      {showNotifications && <NotificationPopup initial={latestPopup as any} />}
      <main className="flex-1 max-w-[1180px] mx-auto px-5 py-7 w-full">{children}</main>
      <Footer />
    </div>
  );
}
