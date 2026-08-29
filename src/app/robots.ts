import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 관리자 화면, 개인 마이페이지, 접근 제한 안내 페이지는 검색 결과에 나올 필요가 없다.
      disallow: ["/admin", "/admin/", "/mypage", "/access-restricted", "/login"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
