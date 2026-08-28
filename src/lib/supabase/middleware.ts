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
  const isMaintenanceExempt =
    pathname === "/login" || pathname === "/maintenance" || pathname.startsWith("/auth/callback");
  const isAccessCheckExempt =
    pathname === "/login" || pathname === "/access-restricted" || pathname.startsWith("/auth/callback");

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

  // 학교 구성원 명단(directory_members)에 없는 이메일은 로그인은 되어도 사이트를 이용할 수
  // 없게 막는다. admin/superadmin은 명단과 무관하게 항상 통과시켜야 관리자가 실수로 스스로를
  // 잠그는 사고를 막을 수 있다(사이트 잠금 모드와 동일한 안전장치).
  if (user && !isAccessCheckExempt) {
    const r = await getRole();
    const isPrivileged = !!r && ["admin", "superadmin"].includes(r);
    if (!isPrivileged) {
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

  if (!isMaintenanceExempt) {
    const { data: settings } = await supabase
      .from("site_settings")
      .select("maintenance_mode")
      .eq("id", "default")
      .maybeSingle();
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
    if (!r || !["editor", "admin", "superadmin"].includes(r)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("denied", "1");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
