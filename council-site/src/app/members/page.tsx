"use client";

import { useState } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import type { Member, Organization } from "@/lib/types";

const COLOR_VAR: Record<string, string> = {
  navy: "var(--navy)",
  teal: "var(--teal)",
  red: "var(--red)",
  gold: "var(--gold)",
};

export default function MembersPage() {
  const { rows: orgs } = useRealtimeList<Organization>("organizations", {
    orderBy: { column: "order_index" },
  });
  const { rows: members } = useRealtimeList<Member>("members", {
    orderBy: { column: "order_index" },
  });
  const [filter, setFilter] = useState("전체");

  const orgById = Object.fromEntries(orgs.map((o) => [o.id, o]));
  const list = members.filter((m) => (filter === "전체" ? true : m.org_id === filter));

  return (
    <div>
      <SectionTitle eyebrow="PEOPLE" title="구성원 소개" />
      <div className="mb-3.5">
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="전체">전체 조직</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {list.map((m) => {
          const org = orgById[m.org_id];
          return (
            <div key={m.id} className="bg-white border border-border rounded-xl p-4 text-center">
              <div
                className="rounded-full text-white flex items-center justify-center font-bold mx-auto mb-2.5"
                style={{ background: COLOR_VAR[org?.color] || COLOR_VAR.navy, width: 52, height: 52 }}
              >
                {m.name[0]}
              </div>
              <div className="font-bold">{m.name}</div>
              <div className="text-blue text-sm mb-1">{m.position}</div>
              {org && <Badge color={org.color}>{org.name}</Badge>}
              <div className="text-muted text-xs mt-1.5">{m.bio}</div>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-muted text-center py-8 text-sm col-span-4">구성원이 없습니다.</div>}
      </div>
    </div>
  );
}
