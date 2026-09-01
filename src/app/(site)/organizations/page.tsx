"use client";

import { useState } from "react";
import Link from "next/link";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import type { Organization } from "@/lib/types";

const COLOR_VAR: Record<string, string> = {
  navy: "var(--navy)",
  teal: "var(--teal)",
  red: "var(--red)",
  gold: "var(--gold)",
};

export default function OrganizationsPage() {
  const { rows } = useRealtimeList<Organization>("organizations", {
    orderBy: { column: "order_index" },
  });
  const [q, setQ] = useState("");

  const list = rows
    .filter((o) => o.is_active)
    .filter(
      (o) =>
        !q.trim() ||
        o.name.includes(q) ||
        (o.description ?? "").includes(q) ||
        (o.role_description ?? "").includes(q)
    );
  const councilList = list.filter((o) => o.category !== "judiciary");
  const judiciaryList = list.filter((o) => o.category === "judiciary");

  const renderGrid = (items: Organization[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((o) => (
        <Link
          href={`/organizations/${o.slug}`}
          key={o.id}
          className="bg-white border border-border rounded-xl p-5 block hover:shadow-md"
          style={{ borderTop: `5px solid ${COLOR_VAR[o.color] || COLOR_VAR.navy}` }}
        >
          <div className="font-bold text-lg mb-2">{o.name}</div>
          <p className="text-muted text-sm">{o.description}</p>
          <span className="text-blue font-bold text-sm">자세히 보기 →</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <SectionTitle eyebrow="ABOUT" title="학생자치회 소개" />
      <p className="text-muted mb-4">
        학생자치회는 여러 부서로 구성되어 학생들의 자율적인 학교생활을 지원합니다.
      </p>
      <div className="mb-3.5">
        <input
          className="w-full max-w-md border border-border rounded-lg px-3 py-2 text-sm"
          placeholder="부서 이름 또는 소개 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {list.length === 0 ? (
        <div className="text-muted text-center py-8 text-sm">
          {q.trim() ? "검색 결과가 없습니다." : "등록된 부서가 없습니다."}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {councilList.length > 0 && (
            <div>
              <h3 className="text-base font-bold mb-3">학생자치회 (임원회)</h3>
              {renderGrid(councilList)}
            </div>
          )}
          {judiciaryList.length > 0 && (
            <div>
              <h3 className="text-base font-bold mb-3">사법위원회</h3>
              {renderGrid(judiciaryList)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
