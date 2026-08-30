"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import ProposalsTab from "./ProposalsTab";
import EventsTab from "./EventsTab";
import ExecutiveCalendarTab from "./ExecutiveCalendarTab";
import RecordsTab from "./RecordsTab";
import type { Organization } from "@/lib/types";

export default function OrgActivitiesPage() {
  const [tab, setTab] = useState<"proposals" | "events" | "records" | "executive">("proposals");
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const [orgFilter, setOrgFilter] = useState("all");
  const [q, setQ] = useState("");
  const [isExecutive, setIsExecutive] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      // "학생회 임원회" 여부는 profiles.is_council 플래그로 관리한다(admin이 /admin/users
      // 에서 개별 지정). role과 독립적인 값이라 role 체크와 별도로 조회한다. superadmin은
      // is_council 여부와 무관하게 항상 볼 수 있어야 하는 최상위 권한이라 함께 예외 처리한다.
      const { data: me } = await supabase.from("profiles").select("is_council, role").eq("id", data.user.id).single();
      setIsExecutive(!!me?.is_council || me?.role === "superadmin");
    });
  }, [supabase]);

  return (
    <div>
      <SectionTitle eyebrow="ORGANIZATIONS" title="부서 활동" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "proposals" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setTab("proposals")}
          >
            안건함
          </button>
          <button
            className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "events" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setTab("events")}
          >
            부서 일정
          </button>
          <button
            className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "records" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setTab("records")}
          >
            활동기록
          </button>
          {isExecutive && (
            <button
              className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "executive" ? "bg-navy text-white" : "bg-white"}`}
              onClick={() => setTab("executive")}
            >
              임원회 캘린더
            </button>
          )}
        </div>
        {tab !== "executive" && (
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
          >
            <option value="all">전체 부서</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      {(tab === "proposals" || tab === "records") && (
        <div className="mb-3.5">
          <input
            className="w-full max-w-md border border-border rounded-lg px-3 py-2 text-sm"
            placeholder={tab === "proposals" ? "안건 제목 또는 내용 검색" : "기록 제목 또는 내용 검색"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}

      {tab === "proposals" && <ProposalsTab orgs={orgs} orgFilter={orgFilter} q={q} />}
      {tab === "events" && <EventsTab orgs={orgs} orgFilter={orgFilter} />}
      {tab === "records" && <RecordsTab orgs={orgs} orgFilter={orgFilter} q={q} />}
      {tab === "executive" && isExecutive && <ExecutiveCalendarTab orgs={orgs} />}
    </div>
  );
}
