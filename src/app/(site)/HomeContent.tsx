"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useList } from "@/hooks/useList";
import Badge, { Pin } from "@/components/Badge";
import ListSkeleton from "@/components/ListSkeleton";
import StreakBar from "@/components/StreakBar";
import ImageLightbox from "@/components/ImageLightbox";
import WeatherWidget from "@/components/WeatherWidget";
import HeaderWeatherBackground from "@/components/HeaderWeatherBackground";
import HeaderWeatherTemp from "@/components/HeaderWeatherTemp";
import EventBanner from "@/components/EventBanner";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { todayKST, nowKSTTime, nowKSTDayOfWeek, timeAgo } from "@/lib/date";
import type { homeThemeStyles, HomeThemeKey } from "@/lib/homeTheme";
import type { Post, EventItem, MainBlock, MealPlan, SiteSettings } from "@/lib/types";

type PostFeedPeriod = "today" | "week" | "month" | "all";
interface PostFeedItem {
  content_type: "board_post" | "question";
  id: string;
  title: string;
  author_name: string;
  created_at: string;
  comment_count: number;
  view_count: number;
}
const PERIOD_OPTIONS: { value: PostFeedPeriod; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "week", label: "일주일" },
  { value: "month", label: "한달" },
  { value: "all", label: "전체" },
];

type Theme = (typeof homeThemeStyles)[keyof typeof homeThemeStyles];

// Tailwind는 클래스 이름을 소스에서 문자열 그대로 찾아야 인식하므로(JIT), `md:col-span-${n}`
// 처럼 동적으로 이어붙이면 실제 빌드에 포함되지 않는다. 완성된 문자열을 미리 다 적어두고
// col_span 값으로 골라 쓴다. 6칸 기준 그리드라 1/3=2, 1/2=3, 2/3=4, 전체=6이다.
const COL_SPAN_CLASS: Record<number, string> = {
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
};

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

const QUICK_MENU = [
  ["📢", "공지사항", "/notices"],
  ["🏛️", "학생자치회 소개", "/organizations"],
  ["📅", "일정 캘린더", "/calendar"],
  ["📖", "생활규정", "/rules"],
  ["💬", "Q&A", "/qna"],
  ["🙋", "마이페이지", "/mypage"],
];

// 홈 화면 전용 블록 제목. 다른 페이지에서 두루 쓰는 SectionTitle과는 별개로 두어(공용
// 컴포넌트를 건드리면 다른 페이지 톤까지 바뀌므로) 여기서만 테마별 제목 스타일을 적용한다.
function BlockTitle({
  eyebrow,
  title,
  moreHref,
  action,
  t,
}: {
  eyebrow: string;
  title: string;
  moreHref?: string;
  /** moreHref 링크 대신(또는 그 자리에) 넣고 싶은 커스텀 우측 영역 — 급식표의 중식/석식
   * 선택 버튼처럼 단순 링크가 아닌 것이 필요할 때 쓴다. */
  action?: React.ReactNode;
  t: Theme;
}) {
  return (
    <div className="flex justify-between items-end mb-4 gap-3 flex-wrap">
      <div>
        <div className={t.sectionEyebrow}>{eyebrow}</div>
        <div className="flex items-center gap-2.5">
          <span className={`w-1 h-6 ${t.sectionAccentBar} bg-current ${t.sectionAccentColor}`} />
          <h2 className={t.sectionHeadingClass}>{title}</h2>
        </div>
      </div>
      {action ??
        (moreHref && (
          <Link href={moreHref} className={t.sectionMoreBtn}>
            전체보기 ›
          </Link>
        ))}
    </div>
  );
}

// 공지/일정/뉴스 각 카드가 비어있을 때 보여주는 자리. classic/green은 지금까지처럼 문구
// 한 줄만 보이고(emptyStateIconWrap/Desc가 hidden), apple은 아이콘 원 + 제목 + 설명 2줄로 보인다.
function EmptyState({ icon, title, desc, t }: { icon: string; title: string; desc: string; t: Theme }) {
  return (
    <div className={t.emptyStateWrap}>
      <div className={t.emptyStateIconWrap}>{icon}</div>
      <div className={t.emptyStateTitle}>{title}</div>
      <div className={t.emptyStateDesc}>{desc}</div>
    </div>
  );
}

// 실험적 배경 날씨 애니메이션 — 로컬(.env.local)에서만 켜고, main 배포 환경에는 절대
// true로 반영하지 않는다. 꺼져 있으면 기존 WeatherWidget(작은 아이콘)만 그대로 보인다.
const ENABLE_HEADER_WEATHER_BG = process.env.NEXT_PUBLIC_ENABLE_HEADER_WEATHER_BG === "true";

export default function HomeContent({ initialThemeKey }: { initialThemeKey?: HomeThemeKey }) {
  // undefined = 아직 로그인 여부를 확인 중, null = 비로그인 확정, string = 로그인된 유저 id.
  // 예전엔 null 하나로 "확인 중"과 "비로그인"을 같이 나타내서, 실제로는 로그인한
  // 사용자한테도 로그인 확인이 끝나기 전 아주 짧은 순간 StreakBar가 "로그인하면 볼 수
  // 있어요" 문구를 잘못 보여주는 깜빡임이 있었다.
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const { t } = useHomeTheme(initialThemeKey);
  const [feedTab, setFeedTab] = useState<"recent" | "popular">("recent");
  const [feedPeriod, setFeedPeriod] = useState<PostFeedPeriod>("today");
  const [feedItems, setFeedItems] = useState<PostFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const { rows: blocks, loading: blocksLoading } = useList<MainBlock>("main_blocks", {
    orderBy: { column: "order_index" },
  });
  const { rows: notices, loading: noticesLoading } = useList<Post>("posts", {
    filter: (q) => q.eq("type", "notice").eq("status", "published"),
    orderBy: { column: "created_at", ascending: false },
  });
  const { rows: events, loading: eventsLoading } = useList<EventItem>("events", {
    orderBy: { column: "start_at" },
  });
  const { rows: news, loading: newsLoading } = useList<Post>("posts", {
    filter: (q) => q.eq("type", "news").eq("status", "published"),
    // /news와 동일하게 관리자가 /admin/news에서 정한 순서를 그대로 반영.
    orderBy: { column: "order_index", ascending: true },
  });
  const { rows: mealPlans, loading: mealLoading } = useList<MealPlan>("meal_plans");
  const { rows: settingsRows, loading: settingsLoading } = useList<SiteSettings>("site_settings");
  const settings = settingsRows.find((s) => s.id === "default");
  // 블록 하나하나가 각자 로딩을 끝내는 대로 따로 튀어나오는("팝인") 걸 막기 위해, 이
  // 데이터 소스들이 전부 끝날 때까지는(블록 배치를 결정하는 main_blocks 포함) 각 카드
  // 내부를 ListSkeleton으로 채워두고, 전부 끝나면 한 번에 실제 내용으로 바꿔 보여준다.
  const homeLoading = blocksLoading || noticesLoading || eventsLoading || newsLoading || mealLoading || settingsLoading || feedLoading;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // 인기 탭에서만 기간이 의미가 있어서(최근 탭은 항상 전체 기간 최신순), 최근 탭에서는
  // p_period를 "all"로 고정해 탭을 오갈 때 이전 기간 선택이 엉뚱하게 섞이지 않게 한다.
  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    createClient()
      .rpc("get_home_post_feed", {
        p_mode: feedTab,
        p_period: feedTab === "popular" ? feedPeriod : "all",
        p_limit: 6,
      })
      .then(({ data }) => {
        if (cancelled) return;
        setFeedItems((data as PostFeedItem[] | null) ?? []);
        setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feedTab, feedPeriod]);

  // 석식 전환 시각을 지난 채로 화면을 계속 열어두고 있어도(새로고침 없이) 자동으로
  // 중식->석식이 바뀌도록, 사이트 제한(RestrictionGuardWatcher)과 같은 방식으로 현재
  // 시각을 주기적으로 다시 읽는다. 1분 간격이면 급식 전환처럼 초 단위로 민감하지 않은
  // 용도로는 충분하다.
  const [nowTime, setNowTime] = useState(() => nowKSTTime());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(nowKSTTime()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const today = todayKST();
  const upcoming = events.filter((e) => e.start_at >= today).slice(0, 3);
  const dinnerSwitchTime = (settings?.dinner_switch_time ?? "13:30:00").slice(0, 5);
  // 석식은 실제로 제공되는 요일(기본값: 월/수/목)에만 전환한다 — 그 외 요일은 전환
  // 시각이 지나도 계속 중식으로 남는다.
  const dinnerDays = settings?.dinner_days ?? [1, 3, 4];
  const isDinnerDay = dinnerDays.includes(nowKSTDayOfWeek());
  // /notices 목록과 동일한 기준 — 고정(is_pinned)이 항상 최상단, 그 안에서는 최신순.
  const sortedNotices = [...notices].sort(
    (a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at)
  );
  const activeMealType = isDinnerDay && nowTime >= dinnerSwitchTime ? "dinner" : "lunch";
  // 자동 전환과 별개로 방문자가 직접 중식/석식을 골라 볼 수 있게 한다 — 석식으로
  // 전환된 뒤에도 중식표를 다시 보고 싶거나, 전환 전에 미리 석식표를 보고 싶은 경우.
  // null이면(아직 직접 고르지 않았으면) 기존처럼 시각 기준 자동 판정을 그대로 따른다.
  const [mealTypeOverride, setMealTypeOverride] = useState<"lunch" | "dinner" | null>(null);
  const displayMealType = mealTypeOverride ?? activeMealType;
  const visibleBlocks = [...blocks].filter((b) => b.is_visible).sort((a, b) => a.order_index - b.order_index);
  const thisMonth = mealPlans.find(
    (m) =>
      m.year === Number(today.slice(0, 4)) &&
      m.month === Number(today.slice(5, 7)) &&
      m.meal_type === displayMealType
  );

  return (
    <div>
      <EventBanner />
      <div className={`${t.heroCard} relative overflow-hidden`}>
        {ENABLE_HEADER_WEATHER_BG && <HeaderWeatherBackground />}
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <div className={t.heroEyebrow}>{t.heroEyebrowText}</div>
            <h1 className={t.heroHeadingClass}>{t.heroTitleText}</h1>
          </div>
          {ENABLE_HEADER_WEATHER_BG ? <HeaderWeatherTemp /> : <WeatherWidget />}
        </div>
        <p className={`relative z-10 ${t.heroSubtextClass}`}>{t.heroSubtitleText}</p>
        <div className="relative z-10 flex gap-2.5 flex-wrap">
          <Link href="/notices" className={t.heroPrimaryBtn}>
            공지사항 보기
          </Link>
          <Link href="/qna" className={t.heroSecondaryBtn}>
            질문하기
          </Link>
        </div>
      </div>

      <StreakBar userId={userId} initialThemeKey={initialThemeKey} />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-[18px]">
        {blocksLoading ? (
          // main_blocks 자체가 아직 안 와서 어떤 블록을 어떤 배치로 보여줄지 모르는
          // 아주 짧은 순간(대개 수십~백여 ms) — 빈 화면 대신 임시로 자리만 잡아둔다.
          // 실제 배치를 알게 되는 즉시 아래 visibleBlocks.map 쪽(각 카드 내부가 homeLoading
          // 동안 ListSkeleton으로 채워진 진짜 레이아웃)으로 바로 교체된다.
          <>
            <div className={`${t.cardShape} p-5 md:col-span-3`}>
              <ListSkeleton rows={4} />
            </div>
            <div className={`${t.cardShape} p-5 md:col-span-3`}>
              <ListSkeleton rows={4} />
            </div>
            <div className={`${t.cardShape} p-5 md:col-span-6`}>
              <ListSkeleton rows={3} />
            </div>
          </>
        ) : (
        visibleBlocks.map((b) => {
          const spanClass = COL_SPAN_CLASS[b.col_span] ?? COL_SPAN_CLASS[6];
          const heightStyle = b.height_px ? { minHeight: `${b.height_px}px` } : undefined;
          if (b.id === "notice")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass} flex flex-col`} style={heightStyle}>
                <BlockTitle t={t} eyebrow="NOTICE" title="최신 공지" moreHref="/notices" />
                <div className="flex-1 flex flex-col justify-center">
                  {homeLoading ? (
                    // 실제 공지 한 줄(py-2.5 + 한 줄 텍스트) 높이에 맞춰 h-10으로 — 기존
                    // ListSkeleton 기본값(h-16)은 테이블형 목록 페이지용이라 여기선 너무 커서
                    // 로딩이 끝나고 실제 내용으로 바뀔 때 카드 높이가 눈에 띄게 줄어들었다.
                    <ListSkeleton rows={4} rowClassName="h-10 rounded-lg bg-[#EEF1F6] dark:bg-white/5" />
                  ) : (
                  <ul className="list-none m-0 p-0">
                    {sortedNotices.slice(0, 5).map((n) => (
                      <li key={n.id} className="border-b border-border py-2.5">
                        <Link href={`/notices/${n.id}`} className={`flex items-center gap-2 -mx-2 px-2 rounded ${t.noticeHover}`}>
                          {n.is_pinned && <Pin />}
                          <span className="flex-1 min-w-0 truncate text-sm" title={n.title}>{n.title}</span>
                          <span className="text-xs text-muted shrink-0">{fmt(n.publish_at)}</span>
                        </Link>
                      </li>
                    ))}
                    {notices.length === 0 && (
                      <li>
                        <EmptyState icon="🔕" title="등록된 공지글이 없습니다" desc="최근에 작성된 공지사항이 이곳에 표시됩니다." t={t} />
                      </li>
                    )}
                  </ul>
                  )}
                </div>
              </div>
            );
          if (b.id === "event")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass} flex flex-col`} style={heightStyle}>
                <BlockTitle t={t} eyebrow="SCHEDULE" title="다가오는 일정" moreHref="/calendar" />
                <div className="flex-1 flex flex-col justify-center">
                  {homeLoading ? (
                    <ListSkeleton rows={3} rowClassName="h-11 rounded-lg bg-[#EEF1F6] dark:bg-white/5" />
                  ) : (
                  <div className="flex flex-col gap-2.5">
                    {upcoming.map((e) => (
                      <Link
                        href={`/events/${e.id}`}
                        key={e.id}
                        className={`flex gap-3 items-center p-1.5 rounded-lg ${t.noticeHover}`}
                      >
                        <div className={`${t.eventDateBg} text-white px-2.5 py-1.5 text-xs font-bold whitespace-nowrap`}>
                          {fmt(e.start_at).slice(5)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{e.title}</div>
                          <div className="text-xs text-muted">{e.location || "장소 미정"}</div>
                        </div>
                      </Link>
                    ))}
                    {upcoming.length === 0 && (
                      <EmptyState icon="📅" title="다가오는 예정된 일정이 없습니다" desc="학사 일정 및 자치회 행사 정보가 등록되면 업데이트됩니다." t={t} />
                    )}
                  </div>
                  )}
                </div>
              </div>
            );
          if (b.id === "news")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass} flex flex-col`} style={heightStyle}>
                <BlockTitle t={t} eyebrow="NEWS" title="학생자치회 뉴스" moreHref="/news" />
                <div className="flex-1 flex flex-col justify-center">
                  {homeLoading ? (
                    // 실제 뉴스 카드는 세로로 쌓인 목록이 아니라 3열 카드 그리드라,
                    // ListSkeleton의 세로 막대 모양을 그대로 쓰면 모양/크기가 많이 달라서
                    // 로딩이 끝날 때 레이아웃이 눈에 띄게 바뀌었다 — 실제 카드(border
                    // rounded-xl p-4)와 같은 틀 안에 같은 회색 톤(bg-[#EEF1F6]/animate-pulse)
                    // 막대만 넣어 모양을 맞춘다.
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-hidden>
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="border border-border rounded-xl p-4 animate-pulse">
                          <div className="h-3 w-12 rounded bg-[#EEF1F6] dark:bg-white/5 mb-2.5" />
                          <div className="h-4 w-4/5 rounded bg-[#EEF1F6] dark:bg-white/5 mb-2" />
                          <div className="h-3 w-full rounded bg-[#EEF1F6] dark:bg-white/5 mb-1.5" />
                          <div className="h-3 w-full rounded bg-[#EEF1F6] dark:bg-white/5 mb-1.5" />
                          <div className="h-3 w-2/3 rounded bg-[#EEF1F6] dark:bg-white/5" />
                        </div>
                      ))}
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {news.slice(0, 3).map((n) => (
                      <Link
                        href={`/news/${n.id}`}
                        key={n.id}
                        className={`border border-border rounded-xl p-4 ${t.newsHoverBorder} block`}
                      >
                        <div className="text-teal font-bold text-xs mb-1.5">{n.category}</div>
                        <div className="font-bold mb-2">{n.title}</div>
                        <p className="text-sm text-muted line-clamp-3 m-0">{n.content}</p>
                      </Link>
                    ))}
                    {news.length === 0 && (
                      <div className="md:col-span-3">
                        <EmptyState icon="📰" title="발행된 뉴스가 존재하지 않습니다" desc="자치회 활동 소식지와 행사 리뷰를 준비 중입니다." t={t} />
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            );
          if (b.id === "meal") {
            const mealLabel = displayMealType === "dinner" ? "석식" : "중식";
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass}`} style={heightStyle}>
                <BlockTitle
                  t={t}
                  eyebrow="MEAL"
                  title={`이번 달 급식표 (${mealLabel})`}
                  action={
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMealTypeOverride("lunch")}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          displayMealType === "lunch" ? "bg-navy text-white" : "border border-border text-muted"
                        }`}
                      >
                        중식
                      </button>
                      <button
                        type="button"
                        onClick={() => setMealTypeOverride("dinner")}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          displayMealType === "dinner" ? "bg-navy text-white" : "border border-border text-muted"
                        }`}
                      >
                        석식
                      </button>
                    </div>
                  }
                />
                {homeLoading ? (
                  // 급식표는 목록이 아니라 이미지 한 장이라(보통 세로로 긴 스캔본), 짧은
                  // 막대 몇 개보다 실제 이미지 비율에 가까운 세로로 긴 영역을 잡아두는 쪽이
                  // 로딩이 끝났을 때 카드 높이 변화를 훨씬 줄여준다. 관리자가 블록 높이를
                  // 지정해뒀으면 그 값을, 아니면 세로로 긴 스캔본에 흔한 비율을 기본값으로.
                  <div
                    className="w-full rounded-lg bg-[#EEF1F6] dark:bg-white/5 animate-pulse"
                    style={b.height_px ? { height: `${b.height_px - 60}px` } : { aspectRatio: "3 / 4" }}
                    aria-hidden
                  />
                ) : thisMonth ? (
                  // 높이가 지정돼 있으면 이미지가 그 안에서 스크롤되게 해서(그 값이 없을 땐
                  // 기존처럼 이미지 원본 크기만큼 카드가 늘어남), 세로로 긴 급식표 이미지가
                  // 옆 카드까지 억지로 늘리지 않게 한다.
                  <div style={b.height_px ? { maxHeight: `${b.height_px - 60}px`, overflowY: "auto" } : undefined}>
                    <ImageLightbox
                      src={thisMonth.image_url}
                      alt={`${thisMonth.year}년 ${thisMonth.month}월 ${mealLabel} 급식표`}
                      className="w-full rounded-lg border border-border object-contain"
                    />
                  </div>
                ) : (
                  <EmptyState
                    icon="🍽️"
                    title={`등록된 이번 달 ${mealLabel} 급식표가 없습니다`}
                    desc="관리자가 급식표를 업로드하면 이곳에 표시됩니다."
                    t={t}
                  />
                )}
              </div>
            );
          }
          if (b.id === "quick")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass}`} style={heightStyle}>
                <BlockTitle t={t} eyebrow="QUICK MENU" title="빠른 메뉴" />
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
                  {QUICK_MENU.map(([icon, label, href]) => (
                    <Link
                      href={href}
                      key={href}
                      className={`${t.quickTile} flex flex-col items-center gap-1.5 text-sm font-semibold`}
                    >
                      {t.quickShowIcon && <span className="text-2xl">{icon}</span>}
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          if (b.id === "posts_feed")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass} flex flex-col`} style={heightStyle}>
                <BlockTitle
                  t={t}
                  eyebrow="POSTS"
                  title={feedTab === "recent" ? "최근 게시글" : "인기 게시글"}
                  action={
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFeedTab("recent")}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            feedTab === "recent" ? "bg-navy text-white" : "border border-border text-muted"
                          }`}
                        >
                          최근
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedTab("popular")}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            feedTab === "popular" ? "bg-navy text-white" : "border border-border text-muted"
                          }`}
                        >
                          인기
                        </button>
                      </div>
                      {feedTab === "popular" && (
                        <select
                          value={feedPeriod}
                          onChange={(e) => setFeedPeriod(e.target.value as PostFeedPeriod)}
                          className="text-xs font-semibold border border-border rounded-full px-2.5 py-1 bg-transparent"
                        >
                          {PERIOD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  }
                />
                <div className="flex-1 flex flex-col justify-center">
                  {homeLoading ? (
                    <ListSkeleton rows={5} rowClassName="h-10 rounded-lg bg-[#EEF1F6] dark:bg-white/5" />
                  ) : (
                  <ul className="list-none m-0 p-0">
                    {feedItems.map((item) => (
                      <li key={`${item.content_type}_${item.id}`} className="border-b border-border py-2.5">
                        <Link
                          href={item.content_type === "question" ? `/qna?q=${item.id}` : `/board/${item.id}`}
                          className={`flex items-center gap-2 -mx-2 px-2 rounded ${t.noticeHover}`}
                        >
                          <Badge color={item.content_type === "question" ? "teal" : "navy"} className="shrink-0">
                            {item.content_type === "question" ? "Q&A" : "게시판"}
                          </Badge>
                          <span className="flex-1 min-w-0 truncate text-sm" title={item.title}>
                            {item.title}
                          </span>
                          <span className="text-xs text-muted shrink-0 hidden sm:inline">{item.author_name}</span>
                          <span className="text-xs text-muted shrink-0">{timeAgo(item.created_at)}</span>
                          <span className="text-xs text-muted shrink-0">💬 {item.comment_count}</span>
                          <span className="text-xs text-muted shrink-0">👁 {item.view_count}</span>
                        </Link>
                      </li>
                    ))}
                    {feedItems.length === 0 && (
                      <li>
                        <EmptyState
                          icon="📝"
                          title="등록된 게시글이 없습니다"
                          desc="게시판과 Q&A에 새 글이 올라오면 이곳에 표시됩니다."
                          t={t}
                        />
                      </li>
                    )}
                  </ul>
                  )}
                </div>
              </div>
            );
          return null;
        })
        )}
      </div>
    </div>
  );
}
