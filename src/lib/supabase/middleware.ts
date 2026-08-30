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

  // 역할/사이트 설정/명단 등록 여부를 하나씩 순서대로(직렬로) 기다리면 매 페이지
  // 진입마다 Supabase 왕복이 여러 번 누적돼 체감상 2초 가까운 지연이 생긴다(예전에
  // (site)/layout.tsx의 직렬 조회 때문에 겪었던 것과 같은 종류의 문제가 미들웨어의
  // 권한 체크가 늘어나면서 다시 생김). 이 요청에서 필요할 수 있는 조회를 전부 한 번에
  // 병렬로 가져와서 왕복 횟수를 줄인다. 예외 페이지(로그인/점검/명단차단 안내 등)는
  // 어차피 이 값들이 필요 없으므로 조회 자체를 건너뛴다.
  let role: string | null = null;
  let isCouncil = false;
  let siteSettings: { maintenance_mode: boolean; restrict_external_checkin: boolean } | null = null;
  let directoryAllowed = false;
  if (!isSpecialPageExempt) {
    if (user) {
      const [roleResult, settingsResult, directoryResult] = await Promise.all([
        supabase.from("profiles").select("role, is_council").eq("id", user.id).single(),
        supabase.from("site_settings").select("maintenance_mode, restrict_external_checkin").eq("id", "default").maybeSingle(),
        user.email
          ? supabase.from("directory_members").select("is_allowed").eq("email", user.email).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      role = roleResult.data?.role ?? null;
      isCouncil = !!roleResult.data?.is_council;
      siteSettings = settingsResult.data;
      directoryAllowed = !!(directoryResult.data as { is_allowed: boolean } | null)?.is_allowed;
    } else {
      // 비로그인 방문자는 role/명단 체크가 필요 없지만, 사이트 잠금 모드(maintenance_mode)는
      // 로그인 여부와 무관하게 모든 방문자에게 적용돼야 하므로 이 조회만은 건너뛰면 안 된다.
      // (이전에는 이 fetch 전체가 `user &&` 조건 안에만 있어서, 잠금 중에도 비로그인
      // 방문자에게는 사이트가 그대로 보이는 버그가 있었다.)
      const { data } = await supabase
        .from("site_settings")
        .select("maintenance_mode, restrict_external_checkin")
        .eq("id", "default")
        .maybeSingle();
      siteSettings = data;
    }
  }

  // 학교 구성원 명단(directory_members)에 없는 이메일은 로그인은 되어도 사이트를 이용할 수
  // 없게 막는다. admin/superadmin은 명단과 무관하게 항상 통과시켜야 관리자가 실수로 스스로를
  // 잠그는 사고를 막을 수 있다(사이트 잠금 모드와 동일한 안전장치). 이 차단 기능 자체는
  // "외부 계정 관리" 화면의 스위치(restrict_external_checkin)로 켜고 끌 수 있다 — 꺼두면
  // 명단에 없는 계정도 로그인해 정상적으로 이용할 수 있다.
  if (user && !isAccessCheckExempt) {
    const isPrivileged = !!role && ["admin", "superadmin"].includes(role);
    if (!isPrivileged) {
      const restrictionEnabled = siteSettings?.restrict_external_checkin !== false;
      if (restrictionEnabled && !directoryAllowed) {
        await supabase.rpc("record_login_access_attempt");
        const url = request.nextUrl.clone();
        url.pathname = "/access-restricted";
        return NextResponse.redirect(url);
      }
    }
  }

  // 기능 단위 활성화 스위치(feature_flags) — superadmin이 /admin/feature-flags에서
  // Q&A/게시판 같은 메뉴 전체를 끌 수 있다. 로그인 여부와 무관하게 적용되어야 하므로
  // 위의 로그인 사용자 전용 병렬 조회와 별도로, 해당 경로에 들어올 때만 조회한다.
  const FEATURE_GATED_PREFIXES: Record<string, string> = {
    "/qna": "qna",
    "/board": "board",
    "/notices": "notices",
    "/organizations": "organizations",
    "/members": "members",
    "/calendar": "calendar",
    "/events": "calendar",
    "/news": "news",
    "/rules": "rules",
  };
  const gatedFeatureKey = Object.keys(FEATURE_GATED_PREFIXES).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (gatedFeatureKey) {
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", FEATURE_GATED_PREFIXES[gatedFeatureKey])
      .maybeSingle();
    if (flag?.enabled === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // 부서 활동(안건함/부서 일정/활동기록)이 임원회 전용으로 바뀌면서, 학생 메뉴에서
  // 링크를 지운 것과 별개로 URL을 직접 입력해 들어오는 것도 막는다 — /admin/org-activities/*
  // 와 동일한 기준(is_council, superadmin은 예외)을 그대로 적용한다.
  if ((pathname === "/org-activities" || pathname.startsWith("/org-activities/")) && !(isCouncil || role === "superadmin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!isMaintenanceExempt && siteSettings?.maintenance_mode) {
    // viewer는 관리자 권한은 전혀 없지만(아래 /admin 체크에서 항상 막힘), 잠금 모드
    // 중에도 사이트를 볼 수 있어야 하는 전용 역할이라 admin/superadmin과 함께 예외 처리한다.
    const bypassesMaintenance = !!role && ["admin", "superadmin", "viewer"].includes(role);
    if (!bypassesMaintenance) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const r = role;
    // sub_editor는 처음 만들 때 권한을 아무것도 안 준 상태였다(이슈 #15). "부서 활동
    // 관리"(안건함/부서 일정/활동기록) 화면은 sub_editor 이상 중에서도 임원회
    // (is_council=true)만 볼 수 있다 — role만으로는 부족하고 플래그도 함께 필요하다.
    // 그 외 모든 /admin 하위 경로는 여전히 editor 이상만 접근할 수 있다.
    const isOrgActivitiesPath = pathname === "/admin/org-activities" || pathname.startsWith("/admin/org-activities/");
    // teacher는 예전엔 "교과 공지"/"학급 공지" 작성을 위해 /admin/notices만 예외적으로
    // 접근할 수 있었는데, teacher 권한을 student와 동일하게 차단하면서 이 예외도 없앴다
    // (posts RLS에서도 teacher 전용 작성/수정 정책을 제거함).
    // designer(조회 전용)는 모든 관리자 탭에 접근은 가능해야 하므로 이 아래의 모든 경로
    // 제한에서 superadmin과 동급으로 취급한다 — 실제 쓰기 차단은 UI가 아니라 RLS(각 테이블의
    // write 정책에 designer가 없음)가 담당하므로, 여기서 접근을 열어줘도 데이터는 안전하다.
    const adminAllowedRoles = isOrgActivitiesPath
      ? ["sub_editor", "editor", "admin", "superadmin", "designer"]
      : ["editor", "admin", "superadmin", "designer"];
    // superadmin은 최상위 권한이라 is_council 같은 부가 조건에 상관없이 조건부로 숨겨진
    // 관리 탭도 항상 볼 수 있어야 한다(관리자가 플래그 설정 실수로 스스로를 포함해
    // 아무도 접근 못 하는 상황을 막기 위한 안전장치 — admin/superadmin이 명단과 무관하게
    // 항상 로그인 가능한 것과 같은 종류의 예외). designer도 "모든 관리자 탭 접근 가능"
    // 요건상 동일하게 예외 처리한다.
    if (!r || !adminAllowedRoles.includes(r) || (isOrgActivitiesPath && !isCouncil && r !== "superadmin" && r !== "designer")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("denied", "1");
      return NextResponse.redirect(url);
    }
    // 아래 관리 메뉴들은 admin이 아니라 superadmin만 볼 수 있어야 한다(사이트 전체에
    // 영향을 주거나 민감한 개인정보를 다루는 화면들). 메뉴 자체는 AdminNav에서 숨기지만,
    // URL을 직접 입력해 들어오는 시도도 여기서 막는다. designer는 조회 전용으로 이 화면들도
    // 볼 수 있어야 하므로(요건: "super admin 전용 탭을 포함한 모든 관리자 탭") 함께 예외.
    const superadminOnlyPrefixes = [
      "/admin/access-requests",
      "/admin/badges",
      "/admin/users",
      "/admin/stats",
      "/admin/maintenance",
      "/admin/activity-logs",
      "/admin/feature-flags",
    ];
    if (superadminOnlyPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      if (r !== "superadmin" && r !== "designer") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.searchParams.set("denied", "1");
        return NextResponse.redirect(url);
      }
    }
    // 신고 내역/급식표 관리는 teacher는 물론 editor(부장급)도 볼 수 없고 admin 이상만 봐야
    // 한다. designer는 조회 전용으로 여기도 볼 수 있어야 해서 함께 예외.
    const adminOnlyPrefixes = ["/admin/reports", "/admin/meal-plans"];
    if (adminOnlyPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      if (r !== "admin" && r !== "superadmin" && r !== "designer") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.searchParams.set("denied", "1");
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
