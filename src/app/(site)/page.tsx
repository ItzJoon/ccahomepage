import { createClient } from "@/lib/supabase/server";
import { DEFAULT_HOME_THEME, isHomeThemeKey } from "@/lib/homeTheme";
import HomeContent from "./HomeContent";

export const dynamic = "force-dynamic";

// 실제 화면(데이터 페칭/렌더링)은 전부 HomeContent(클라이언트 컴포넌트)가 담당한다.
// 여기서는 site_theme을 미리 서버에서 조회해 초기값으로 넘겨주기만 한다 — 그래야 홈 화면에
// 진입할 때마다 실시간 구독 값이 도착하기 전 잠깐 기본 테마(green)가 보였다 사라지는
// 깜빡임 없이 첫 렌더부터 정확한 테마로 그려진다.
export default async function HomePage() {
  const supabase = createClient();
  const { data: siteTheme } = await supabase.from("site_theme").select("theme").eq("id", "default").maybeSingle();
  const rawThemeValue = siteTheme?.theme ?? "";
  const initialThemeKey = isHomeThemeKey(rawThemeValue) ? rawThemeValue : DEFAULT_HOME_THEME;

  return <HomeContent initialThemeKey={initialThemeKey} />;
}
