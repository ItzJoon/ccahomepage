import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 모든 요청에서 Supabase 세션 쿠키를 갱신합니다.
 * /admin 이하 경로는 로그인 + 관리자 권한(editor 이상)을 확인해 없으면 /login 으로 리다이렉트합니다.
 * site_settings.maintenance_mode가 켜져 있으면(관리자가 /admin/maintenance에서 토글),
 * admin/superadmin을 제외한 모든 사용자를 /maintenance 로 보냅니다(/admin 하위 경로 포함).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
      // Next.js가 fetch를 기본으로 캐싱해서, site_settings.maintenance_mode 같은 값이
      // 바뀌어도 미들웨어가 예전 응답을 계속 재사용할 수 있다. 매 요청마다 실제 값을 보도록 강제한다.
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  // 두 안내 페이지(/maintenance, /access-restricted)는 서로의 체크에서도 예외여야 한다.
  // 그렇지 않으면 명단 차단 → /access-restricted → 잠금 모드 체크에 걸려 /maintenance →
  // 거기서 다시 명단 차단 체크에 걸려 /access-restricted로 돌아가는 리다이렉트 루프가 생긴다.
  const isSpecialPageExempt =
    pathname === "/login" ||
    pathname === "/maintenance" ||
    pathname === "/access-restricted" ||
    pathname.startsWith("/auth/callback") ||
    // 검색엔진이 사이트 잠금 중에도 robots.txt/sitemap.xml은 정상적으로 받아갈 수 있어야
    // 한다(HTML 리다이렉트 응답으로 오해하지 않도록).
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";
  const isMaintenanceExempt = isSpecialPageExempt;
  const isAccessCheckExempt = isSpecialPageExempt;

  // /admin 체크와 중복 조회하지 않도록 role은 한 번만 가져와서 재사용한다.
  let roleFetched = false;
  let role: string | null = null;
  const getRole = async () => {
    if (roleFetched) return role;
    roleFetched = true;
    if (!user) return null;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = profile?.role ?? null;
    return role;
  };

  // 잠금 모드 체크와 외부 계정 차단 체크가 둘 다 site_settings를 참조하므로 한 번만 가져와서 재사용한다.
  let settingsFetched = false;
  let siteSettings: { maintenance_mode: boolean; restrict_external_checkin: boolean } | null = null;
  const getSiteSettings = async () => {
    if (settingsFetched) return siteSettings;
    settingsFetched = true;
    const { data } = await supabase
      .from("site_settings")
      .select("maintenance_mode, restrict_external_checkin")
      .eq("id", "default")
      .maybeSingle();
    siteSettings = data;
    return siteSettings;
  };

  // 학교 구성원 명단(directory_members)에 없는 이메일은 로그인은 되어도 사이트를 이용할 수
  // 없게 막는다. admin/superadmin은 명단과 무관하게 항상 통과시켜야 관리자가 실수로 스스로를
  // 잠그는 사고를 막을 수 있다(사이트 잠금 모드와 동일한 안전장치). 이 차단 기능 자체는
  // "외부 계정 관리" 화면의 스위치(restrict_external_checkin)로 켜고 끌 수 있다 — 꺼두면
  // 명단에 없는 계정도 로그인해 정상적으로 이용할 수 있다.
  if (user && !isAccessCheckExempt) {
    const r = await getRole();
    const isPrivileged = !!r && ["admin", "superadmin"].includes(r);
    if (!isPrivileged) {
      const settings = await getSiteSettings();
      const restrictionEnabled = settings?.restrict_external_checkin !== false;
      if (restrictionEnabled) {
        let allowed = false;
        if (user.email) {
          const { data: dm } = await supabase
            .from("directory_members")
            .select("is_allowed")
            .eq("email", user.email)
            .maybeSingle();
          allowed = !!dm?.is_allowed;
        }
        if (!allowed) {
          await supabase.rpc("record_login_access_attempt");
          const url = request.nextUrl.clone();
          url.pathname = "/access-restricted";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  if (!isMaintenanceExempt) {
    const settings = await getSiteSettings();
    if (settings?.maintenance_mode) {
      const r = await getRole();
      const isAdmin = !!r && ["admin", "superadmin"].includes(r);
      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/maintenance";
        return NextResponse.redirect(url);
      }
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const r = await getRole();
    // sub_editor는 처음 만들 때 권한을 아무것도 안 준 상태였다(이슈 #15). "조직 활동
    // 관리"(안건함/조직 일정/활동기록) 화면만 예외적으로 sub_editor 이상에게 열어주고,
    // 그 외 모든 /admin 하위 경로는 여전히 editor 이상만 접근할 수 있다.
    const isOrgActivitiesPath = pathname === "/admin/org-activities" || pathname.startsWith("/admin/org-activities/");
    // teacher는 "교과 공지"/"학급 공지" 작성을 위해 /admin/notices만 예외적으로 접근할 수
    // 있다(일반 공지 작성 권한은 없음 — 실제 작성 가능 범위는 posts RLS가 결정한다).
    const isNoticesPath = pathname === "/admin/notices" || pathname.startsWith("/admin/notices/");
    const adminAllowedRoles = isOrgActivitiesPath
      ? ["sub_editor", "editor", "admin", "superadmin"]
      : isNoticesPath
      ? ["teacher", "editor", "admin", "superadmin"]
      : ["editor", "admin", "superadmin"];
    if (!r || !adminAllowedRoles.includes(r)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("denied", "1");
      return NextResponse.redirect(url);
    }
    // 아래 관리 메뉴들은 admin이 아니라 superadmin만 볼 수 있어야 한다(사이트 전체에
    // 영향을 주거나 민감한 개인정보를 다루는 화면들). 메뉴 자체는 AdminNav에서 숨기지만,
    // URL을 직접 입력해 들어오는 시도도 여기서 막는다.
    const superadminOnlyPrefixes = [
      "/admin/access-requests",
      "/admin/badges",
      "/admin/users",
      "/admin/stats",
      "/admin/maintenance",
      "/admin/activity-logs",
    ];
    if (superadminOnlyPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      if (r !== "superadmin") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.searchParams.set("denied", "1");
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
