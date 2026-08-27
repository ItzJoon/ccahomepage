import { createBrowserClient } from "@supabase/ssr";

// 브라우저 전체에서 클라이언트를 하나만 재사용합니다 (중복 생성 방지)
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
