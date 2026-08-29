import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

/**
 * 구글 등 검색엔진에 어떤 페이지가 있는지 알려주는 sitemap.xml을 자동 생성한다.
 * 정적 메뉴 페이지 + 실제 발행된 공지/뉴스 상세 페이지를 모두 포함한다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";
  const supabase = createClient();

  const staticPaths = [
    "",
    "/notices",
    "/organizations",
    "/members",
    "/org-activities",
    "/calendar",
    "/news",
    "/rules",
    "/qna",
  ];
  const staticRoutes: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
  }));

  const [{ data: notices }, { data: news }] = await Promise.all([
    supabase.from("posts").select("id, created_at").eq("type", "notice").eq("status", "published"),
    supabase.from("posts").select("id, created_at").eq("type", "news").eq("status", "published"),
  ]);

  const noticeRoutes: MetadataRoute.Sitemap = (notices ?? []).map((n) => ({
    url: `${siteUrl}/notices/${n.id}`,
    lastModified: new Date(n.created_at),
  }));
  const newsRoutes: MetadataRoute.Sitemap = (news ?? []).map((n) => ({
    url: `${siteUrl}/news/${n.id}`,
    lastModified: new Date(n.created_at),
  }));

  return [...staticRoutes, ...noticeRoutes, ...newsRoutes];
}
