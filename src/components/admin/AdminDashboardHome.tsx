"use client";

import Link from "next/link";
import { Megaphone, Newspaper, Calendar, MessageSquare, Heart, Plus, BookOpen } from "lucide-react";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { timeAgo } from "@/lib/date";
import type { HomeThemeKey } from "@/lib/homeTheme";

interface RecentPost {
  id: string;
  type: "notice" | "news";
  title: string;
  created_at: string;
  author_name: string | null;
}

export default function AdminDashboardHome({
  stats,
  recentPosts,
  initialThemeKey,
}: {
  stats: { noticeCount: number; newsCount: number; eventCount: number; pendingQCount: number; pendingReportCount: number };
  recentPosts: RecentPost[];
  initialThemeKey?: HomeThemeKey;
}) {
  const { t } = useHomeTheme(initialThemeKey);

  const statCards = [
    { label: "공지사항 게시", value: stats.noticeCount, icon: Megaphone, warn: false },
    { label: "발행된 뉴스", value: stats.newsCount, icon: Newspaper, warn: false },
    { label: "등록된 일정", value: stats.eventCount, icon: Calendar, warn: false },
    { label: "답변 대기 Q&A", value: stats.pendingQCount, icon: MessageSquare, warn: true, href: "/admin/qna" },
    { label: "미확인 신고", value: stats.pendingReportCount, icon: Heart, warn: true, href: "/admin/reports" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-[28px] font-black">관리자 대시보드</h2>
        <p className="text-sm text-muted">학생자치회 관리자 대시보드</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          const card = (
            <div className={s.warn ? t.dashStatCardWarn : t.dashStatCard}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-muted uppercase tracking-wide">{s.label}</span>
                <span className={`inline-flex items-center justify-center ${t.dashStatIconBg}`}>
                  <Icon size={16} />
                </span>
              </div>
              <div className={`text-4xl font-black font-mono ${s.warn ? t.dashStatValueWarn : t.dashStatValue}`}>
                {s.value}
              </div>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-base font-bold">콘텐츠 · 공지 발행</h3>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/notices" className={`inline-flex items-center gap-2 ${t.dashActionPrimary}`}>
            <Plus size={16} /> 새 공지/소식 올리기
          </Link>
          <Link href="/admin/events" className={`inline-flex items-center gap-2 ${t.dashActionSecondary}`}>
            <Calendar size={16} /> 일정 등록
          </Link>
          <Link href="/admin/rules" className={`inline-flex items-center gap-2 ${t.dashActionSecondary}`}>
            <BookOpen size={16} /> 학생생활규정 관리
          </Link>
        </div>
      </div>

      <div className={t.dashActivityCard}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-base">최근 등록된 공지·뉴스</div>
            <div className="text-muted text-[13px] mt-0.5">최근 등록된 공지사항/뉴스 변경 이력입니다.</div>
          </div>
          <Link href="/admin/notices" className={t.dashActivityViewAllBtn}>
            전체 보기
          </Link>
        </div>
        <div className="border-t border-border">
          {recentPosts.map((p) => (
            <Link
              key={p.id}
              href={`${p.type === "notice" ? "/admin/notices" : "/admin/news"}?edit=${p.id}`}
              className="flex items-center justify-between gap-4 py-4 border-b border-border last:border-b-0 hover:bg-[#F7F8FB] -mx-2 px-2 rounded-md transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span
                  className={`shrink-0 text-xs font-bold rounded px-2 py-1 ${
                    p.type === "notice" ? t.dashActivityTagNotice : t.dashActivityTagNews
                  }`}
                >
                  {p.type === "notice" ? "공지" : "뉴스"}
                </span>
                <span className="text-sm truncate">{p.title}</span>
              </div>
              <div className="shrink-0 flex items-center gap-4 text-muted text-[13px]">
                <span>{p.author_name || "-"}</span>
                <span>{timeAgo(p.created_at)}</span>
              </div>
            </Link>
          ))}
          {recentPosts.length === 0 && (
            <div className="text-muted text-center py-8 text-sm">최근 등록된 공지/뉴스가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
