import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://ccahomepage.vercel.app";

/**
 * 구글 등 검색엔진에 어떤 페이지가 있는지 알려주는 sitemap.xml을 자동 생성한다.
 * 정적 메뉴 페이지 + 실제 공개된 공지/뉴스/조직 상세 페이지를 모두 포함한다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/notices`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/organizations`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/members`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/org-activities`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/calendar`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/news`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/rules`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/qna`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
  ];

  const [{ data: notices }, { data: news }, { data: organizations }] = await Promise.all([
    supabase.from("posts").select("id, created_at").eq("type", "notice").eq("status", "published"),
    supabase.from("posts").select("id, created_at").eq("type", "news").eq("status", "published"),
    supabase.from("organizations").select("slug, created_at").eq("is_active", true),
  ]);

  const noticeRoutes: MetadataRoute.Sitemap = (notices ?? []).map((n) => ({
    url: `${SITE_URL}/notices/${n.id}`,
    lastModified: new Date(n.created_at),
    changeFrequency: "weekly",
    priority: 0.6,
  }));
  const newsRoutes: MetadataRoute.Sitemap = (news ?? []).map((n) => ({
    url: `${SITE_URL}/news/${n.id}`,
    lastModified: new Date(n.created_at),
    changeFrequency: "weekly",
    priority: 0.6,
  }));
  const organizationRoutes: MetadataRoute.Sitemap = (organizations ?? []).map((o) => ({
    url: `${SITE_URL}/organizations/${o.slug}`,
    lastModified: new Date(o.created_at),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...noticeRoutes, ...newsRoutes, ...organizationRoutes];
}
