import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: "학생자치회",
  description: "학생자치회 공식 사이트",
  verification: {
    google: "googleb020e907b1fe0293",
  },
};

/**
 * 진짜 최상위 레이아웃 — html/body 뼈대만 담당한다. 학생용 헤더/푸터/알림은
 * src/app/(site)/layout.tsx로, 관리자 헤더/사이드바는 src/app/admin/layout.tsx로
 * 완전히 분리돼 있다. 여기서 공통 헤더를 조건부로 그리는 방식은 쓰지 않는다 —
 * 두 레이아웃이 같은 부모를 공유하면 Next.js가 클라이언트 내비게이션 시 그 부모를
 * 다시 그리지 않아서, 사이트 헤더가 붙은 채로 /admin으로 넘어가 관리자 헤더와
 * 겹쳐 보이는 버그가 있었다(라우트 그룹으로 레이아웃 트리 자체를 분리해서 해결).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
