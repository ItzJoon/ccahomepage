import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 정적 자산/공개 파일은 애초에 인증·권한 로직이 필요 없는데도 이 매처를 못 벗어나면
  // 요청마다 미들웨어 전체(무거운 Supabase 조회 포함)가 실행된다. 기존엔 이미지 확장자
  // 몇 개만 빼뒀는데, 폰트 파일과 PdfInlineViewer가 쓰는 pdf.worker.min.mjs(public/에
  // 직접 두고 정적으로 서빙 — _next/static 밑이 아니라서 이 규칙에 안 걸리면 그대로
  // 통과해버림)가 빠져 있었고, robots.txt/sitemap.xml/manifest.webmanifest/sw.js도
  // (로그인 여부와 무관하게 항상 그대로 내려줘야 해서 아래 로직에서 별도로 예외
  // 처리하고 있었지만) 아예 매처에서 빼면 그 로직 자체를 탈 필요도 없어진다.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot|mjs)$).*)",
  ],
};
