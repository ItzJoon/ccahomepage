"use client";

import { useMemo, useState } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useTrackPageVisit } from "@/hooks/useTrackPageVisit";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import type { RuleDoc } from "@/lib/types";

function anchorId(ruleId: string) {
  return `rule-${ruleId}`;
}

function scrollToRule(ruleId: string) {
  const el = document.getElementById(anchorId(ruleId));
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function RulesPage() {
  useTrackPageVisit("rules"); // "탐험가" 뱃지용 방문 기록
  const { rows } = useRealtimeList<RuleDoc>("rules", {
    select: "*, attachments(*)",
    orderBy: { column: "order_index" },
  });
  const [q, setQ] = useState("");

  const filtered = q
    ? rows.filter((r) => r.title.includes(q) || r.content.includes(q) || r.category.includes(q))
    : rows;

  // 검색 중이 아닐 때 좌측에 보여줄 목차 — 장(章)/절(節)이 바뀌는 첫 조항의 id로 점프한다.
  const categoryLinks = useMemo(() => {
    const seen = new Set<string>();
    const list: { category: string; ruleId: string }[] = [];
    for (const r of rows) {
      if (!seen.has(r.category)) {
        seen.add(r.category);
        list.push({ category: r.category, ruleId: r.id });
      }
    }
    return list;
  }, [rows]);

  return (
    <div>
      <SectionTitle eyebrow="RULES" title="학생생활규정" />
      <div className="mb-3.5">
        <input
          className="w-full max-w-md border border-border rounded-lg px-3 py-2 text-sm"
          placeholder="조항 제목 또는 본문 검색 (예: 두발, 제20조)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-start">
        <ul className="list-none m-0 p-0 bg-white border border-border rounded-xl overflow-hidden h-fit md:sticky md:top-20 md:max-h-[75vh] overflow-y-auto">
          {q === ""
            ? categoryLinks.map((c) => (
                <li key={c.category}>
                  <button
                    type="button"
                    onClick={() => scrollToRule(c.ruleId)}
                    className="w-full text-left px-3.5 py-3 border-b border-border text-sm hover:bg-[#EAF0FB]"
                  >
                    {c.category}
                  </button>
                </li>
              ))
            : filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => scrollToRule(r.id)}
                    className="w-full text-left px-3.5 py-3 border-b border-border text-sm hover:bg-[#EAF0FB]"
                  >
                    <Badge color="navy">{r.category}</Badge> {r.title}
                  </button>
                </li>
              ))}
          {q !== "" && filtered.length === 0 && (
            <li className="text-muted text-center py-6 text-sm">검색 결과가 없습니다.</li>
          )}
        </ul>
        <div className="bg-white border border-border rounded-2xl p-7 flex flex-col gap-7">
          {(q === "" ? rows : filtered).map((r, i, arr) => {
            const isNewCategory = i === 0 || arr[i - 1].category !== r.category;
            return (
              <div key={r.id} id={anchorId(r.id)} className="scroll-mt-24">
                {isNewCategory && (
                  <h2 className="text-lg font-black text-navy border-b border-border pb-2 mb-3">{r.category}</h2>
                )}
                <h3 className="mb-2">{r.title}</h3>
                <pre className="whitespace-pre-wrap font-sans leading-8 text-sm">
                  <Linkify text={r.content} />
                </pre>
                {r.attachments && r.attachments.length > 0 && (
                  <div className="mt-3 p-3 bg-bg rounded-xl">
                    <div className="font-bold text-xs mb-1.5">첨부파일</div>
                    {r.attachments.map((a) => (
                      <a key={a.id} href={a.file_url} className="block text-sm py-1 text-blue">
                        📎 {a.file_name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="text-muted text-center py-8 text-sm">등록된 규정이 없습니다.</div>
          )}
          {q !== "" && filtered.length === 0 && rows.length > 0 && (
            <div className="text-muted text-center py-8 text-sm">검색 결과가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
