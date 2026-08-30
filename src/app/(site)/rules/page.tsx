"use client";

import { useState } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import type { RuleDoc } from "@/lib/types";

export default function RulesPage() {
  const { rows } = useRealtimeList<RuleDoc>("rules", {
    select: "*, attachments(*)",
    orderBy: { column: "order_index" },
  });
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | null>(null);

  const list = rows.filter((r) => r.title.includes(q) || r.content.includes(q));
  const rule = list.find((r) => r.id === active) || list[0];

  return (
    <div>
      <SectionTitle eyebrow="RULES" title="학생생활규정" />
      <div className="mb-3.5">
        <input
          className="w-full max-w-md border border-border rounded-lg px-3 py-2 text-sm"
          placeholder="규정 제목 또는 본문 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <ul className="list-none m-0 p-0 bg-white border border-border rounded-xl overflow-hidden h-fit">
          {list.map((r) => (
            <li
              key={r.id}
              className={`px-3.5 py-3 border-b border-border cursor-pointer text-sm ${
                rule?.id === r.id ? "bg-[#EAF0FB]" : "hover:bg-[#EAF0FB]"
              }`}
              onClick={() => setActive(r.id)}
            >
              <Badge color="navy">{r.category}</Badge> {r.title}
            </li>
          ))}
          {list.length === 0 && <li className="text-muted text-center py-6 text-sm">검색 결과가 없습니다.</li>}
        </ul>
        <div className="bg-white border border-border rounded-xl p-5.5">
          {rule ? (
            <>
              <h2>{rule.title}</h2>
              <pre className="whitespace-pre-wrap font-sans leading-8 text-sm"><Linkify text={rule.content} /></pre>
              {rule.attachments && rule.attachments.length > 0 && (
                <div className="mt-5 p-3.5 bg-bg rounded-xl">
                  <div className="font-bold text-xs mb-1.5">첨부파일</div>
                  {rule.attachments.map((a) => (
                    <a key={a.id} href={a.file_url} className="block text-sm py-1 text-blue">
                      📎 {a.file_name}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-muted text-center py-8 text-sm">규정을 선택해주세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}
