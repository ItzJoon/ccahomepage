import type { Metadata } from "next";
import "./globals.css";

// 카카오톡/문자/디스코드 등에 링크를 공유하거나 구글 검색 결과에 뜰 때 사이트 이름이
// "Vercel"로 나오던 문제 — openGraph.siteName/title 등을 따로 설정 안 해서 각 플랫폼이
// 배포 플랫폼 이름으로 대체 표시한 것. title/description은 아래에서도 그대로 재사용한다.
const SITE_NAME = "중앙기독고등학교 학생자치회";
const SITE_DESCRIPTION = "학생자치회 공식 홈페이지 — 공지사항, 부서 소개, 학사일정, 규정 등을 확인하세요.";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: {
    default: SITE_NAME,
    template: "%s | 중앙기독고등학교 학생자치회",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    url: "/",
    locale: "ko_KR",
    type: "website",
    // logo.png를 임시로 링크 미리보기 이미지로 쓴다 — 나중에 정사각형/16:9 등 링크
    // 미리보기 전용 썸네일이 생기면 이 경로만 바꾸면 된다(README 18절 참고).
    images: ["/logo.png"],
  },
  verification: {
    google: "95ZwXJ_vN51YAY4FWQv4OR3AC0yR6MbKc2eA4K3hAfc",
  },
};

// 구글이 이 사이트를 "중앙기독고등학교 학생자치회"라는 조직/웹사이트로 명확히 인식하도록
// 돕는 구조화 데이터(JSON-LD). NEXT_PUBLIC_SITE_URL이 아직 없는 로컬 환경에서는 안전하게
// 빈 문자열로 두고(스키마상 url이 없어도 파싱은 되며, 실제 배포 환경에는 항상 설정돼 있음).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: siteUrl,
  logo: siteUrl ? `${siteUrl}/logo.png` : undefined,
  description: SITE_DESCRIPTION,
};
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: siteUrl,
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
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
