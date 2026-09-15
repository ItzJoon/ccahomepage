import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Component에서 호출 시 무시 (미들웨어가 세션을 갱신)
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {}
        },
      },
      // Next.js가 서버 쪽 fetch를 기본으로 캐싱하는 걸 막는다. 이게 없으면 사이트 잠금
      // 같은 서버 사이드 값이 실제로 바뀌어도 예전 응답이 계속 재사용될 수 있다.
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}

/** 현재 로그인한 사용자의 profiles row(role 포함)를 가져옵니다.
 *
 * auth.getUser()가 아니라 getSession()을 쓴다 — 둘의 차이는 getUser()가 매번 Supabase
 * Auth 서버에 다시 왕복해서 "이 사용자가 그 사이 정지/삭제되지 않았는지"까지 재확인하는
 * 반면 getSession()은 쿠키에 담긴 서명된 JWT를 로컬에서 검증만 하고 끝낸다는 점이다.
 * 이 프로젝트는 모든 요청이 middleware.ts를 먼저 거치는데, 거기서 이미 getUser()로
 * 그 검증을 하고, 문제가 있으면(정지/명단 차단 등) 이 페이지에 도달하기 전에 이미
 * 다른 곳으로 리다이렉트한다 — 즉 이 함수가 호출되는 시점엔 이미 같은 요청 안에서
 * 한 번 검증이 끝난 뒤라, 여기서 또 왕복할 필요가 없다. 이 함수가 사이트 전체에서
 * 10곳 넘게 호출되므로(페이지마다 최소 한 번), 페이지 하나당 Supabase Auth 서버 왕복을
 * 하나씩 없애는 효과가 있다. */
export async function getCurrentProfile() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return profile;
}
