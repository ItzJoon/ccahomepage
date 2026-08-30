"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SectionTitle from "@/components/SectionTitle";
import type { BoardPost, EventItem, Organization, OrgRecord, Post, Proposal, Question, RuleDoc } from "@/lib/types";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

function snippet(text: string, len = 80) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

// 안건함/활동기록은 둘 다 /org-activities 안에서만 볼 수 있고 개별 상세 페이지가 없어서
// (Q&A와 동일한 이유로) 검색 결과에서는 "조직 활동" 하나로 묶어서 보여준다.
interface OrgActivityItem {
  id: string;
  kind: "proposal" | "record";
  title: string;
  body: string;
  created_at: string;
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [loading, setLoading] = useState(false);
  const [notices, setNotices] = useState<Post[]>([]);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [rules, setRules] = useState<RuleDoc[]>([]);
  const [orgActivities, setOrgActivities] = useState<OrgActivityItem[]>([]);

  useEffect(() => {
    setInput(q);
    if (!q.trim()) {
      setNotices([]);
      setBoardPosts([]);
      setQuestions([]);
      setEvents([]);
      setOrgs([]);
      setRules([]);
      setOrgActivities([]);
      return;
    }
    // PostgREST or() 필터 문법에서 콤마/괄호가 특별한 의미를 가지므로 제거해 안전하게 만든다.
    const safeQ = q.replace(/[,()]/g, "");
    const supabase = createClient();
    setLoading(true);
    Promise.all([
      supabase
        .from("posts")
        .select("*")
        .in("type", ["notice", "news", "subject_notice", "homeroom_notice"])
        .or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("board_posts")
        .select("*")
        .or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("questions")
        .select("*")
        .or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("events")
        .select("*")
        .or(`title.ilike.%${safeQ}%,description.ilike.%${safeQ}%`)
        .order("start_at", { ascending: false })
        .limit(20),
      supabase
        .from("organizations")
        .select("*")
        .or(`name.ilike.%${safeQ}%,description.ilike.%${safeQ}%,role_description.ilike.%${safeQ}%`)
        .order("order_index")
        .limit(20),
      supabase
        .from("rules")
        .select("*")
        .or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("proposals")
        .select("*")
        .or(`title.ilike.%${safeQ}%,summary.ilike.%${safeQ}%`)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("org_records")
        .select("*")
        .or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`)
        .order("created_at", { ascending: false })
        .limit(15),
    ]).then(([n, b, qs, ev, og, rl, pr, rec]) => {
      // RLS가 이미 열람 가능한 것만 돌려주므로(숨김/비공개/교과·학급 대상 아닌 것 등
      // 자동 제외), 여기서 추가로 필터링할 필요는 없다.
      setNotices((n.data as any) ?? []);
      setBoardPosts((b.data as any) ?? []);
      setQuestions((qs.data as any) ?? []);
      setEvents((ev.data as any) ?? []);
      setOrgs((og.data as any) ?? []);
      setRules((rl.data as any) ?? []);
      const proposalItems: OrgActivityItem[] = ((pr.data as Proposal[]) ?? []).map((p) => ({
        id: p.id,
        kind: "proposal",
        title: p.title,
        body: p.summary,
        created_at: p.created_at,
      }));
      const recordItems: OrgActivityItem[] = ((rec.data as OrgRecord[]) ?? []).map((r) => ({
        id: r.id,
        kind: "record",
        title: r.title,
        body: r.content,
        created_at: r.created_at,
      }));
      setOrgActivities(
        [...proposalItems, ...recordItems].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      );
      setLoading(false);
    });
  }, [q]);

  const submit = () => {
    if (input.trim()) router.push(`/search?q=${encodeURIComponent(input.trim())}`);
  };

  const total =
    notices.length + boardPosts.length + questions.length + events.length + orgs.length + rules.length + orgActivities.length;

  return (
    <div>
      <SectionTitle eyebrow="SEARCH" title="통합 검색" />
      <div className="flex gap-2.5 mb-5">
        <input
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm"
          placeholder="공지사항, 뉴스, 게시판, Q&A, 일정 등 사이트 전체를 한 번에 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button onClick={submit} className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2">
          검색
        </button>
      </div>

      {!q.trim() && <div className="text-muted text-center py-10 text-sm">검색어를 입력해 주세요.</div>}
      {q.trim() && loading && <div className="text-muted text-center py-10 text-sm">검색 중…</div>}
      {q.trim() && !loading && total === 0 && (
        <div className="text-muted text-center py-10 text-sm">"{q}"에 대한 검색 결과가 없습니다.</div>
      )}

      {q.trim() && !loading && total > 0 && (
        <div className="flex flex-col gap-6">
          {notices.length > 0 && (
            <section>
              <h3 className="text-base font-bold mb-2">공지/뉴스 ({notices.length}건)</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {notices.map((n) => (
                  <li key={n.id} className="bg-white border border-border rounded-lg p-3">
                    <Link href={n.type === "news" ? `/news/${n.id}` : `/notices/${n.id}`} className="font-bold text-sm">
                      {n.title}
                    </Link>
                    <p className="text-muted text-xs mt-1 mb-0">{snippet(n.content)} · {fmt(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {boardPosts.length > 0 && (
            <section>
              <h3 className="text-base font-bold mb-2">게시판 ({boardPosts.length}건)</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {boardPosts.map((p) => (
                  <li key={p.id} className="bg-white border border-border rounded-lg p-3">
                    <Link href={`/board/${p.id}`} className="font-bold text-sm">
                      {p.title}
                    </Link>
                    <p className="text-muted text-xs mt-1 mb-0">{snippet(p.content)} · {fmt(p.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {questions.length > 0 && (
            <section>
              <h3 className="text-base font-bold mb-2">Q&amp;A ({questions.length}건)</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {questions.map((qq) => (
                  <li key={qq.id} className="bg-white border border-border rounded-lg p-3">
                    <Link href="/qna" className="font-bold text-sm">
                      {qq.title}
                    </Link>
                    <p className="text-muted text-xs mt-1 mb-0">{snippet(qq.content)} · {fmt(qq.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {events.length > 0 && (
            <section>
              <h3 className="text-base font-bold mb-2">일정 ({events.length}건)</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {events.map((ev) => (
                  <li key={ev.id} className="bg-white border border-border rounded-lg p-3">
                    <Link href={`/events/${ev.id}`} className="font-bold text-sm">
                      {ev.title}
                    </Link>
                    <p className="text-muted text-xs mt-1 mb-0">
                      {ev.description ? `${snippet(ev.description)} · ` : ""}
                      {fmt(ev.start_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {orgs.length > 0 && (
            <section>
              <h3 className="text-base font-bold mb-2">학생자치회 소개 ({orgs.length}건)</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {orgs.map((o) => (
                  <li key={o.id} className="bg-white border border-border rounded-lg p-3">
                    <Link href={`/organizations/${o.slug}`} className="font-bold text-sm">
                      {o.name}
                    </Link>
                    {(o.description || o.role_description) && (
                      <p className="text-muted text-xs mt-1 mb-0">{snippet(o.description || o.role_description || "")}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {rules.length > 0 && (
            <section>
              <h3 className="text-base font-bold mb-2">생활규정 ({rules.length}건)</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {rules.map((r) => (
                  <li key={r.id} className="bg-white border border-border rounded-lg p-3">
                    <Link href="/rules" className="font-bold text-sm">
                      {r.title}
                    </Link>
                    <p className="text-muted text-xs mt-1 mb-0">{snippet(r.content)} · {fmt(r.updated_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {orgActivities.length > 0 && (
            <section>
              <h3 className="text-base font-bold mb-2">조직 활동 ({orgActivities.length}건)</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {orgActivities.map((a) => (
                  <li key={`${a.kind}-${a.id}`} className="bg-white border border-border rounded-lg p-3">
                    <Link href="/org-activities" className="font-bold text-sm">
                      [{a.kind === "proposal" ? "안건" : "활동기록"}] {a.title}
                    </Link>
                    <p className="text-muted text-xs mt-1 mb-0">{snippet(a.body)} · {fmt(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
