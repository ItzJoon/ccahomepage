"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { Organization, Proposal, ProposalVote } from "@/lib/types";

const STATUS_OPTIONS: Proposal["status"][] = ["review", "approved", "rejected", "completed"];
const STATUS_LABEL: Record<Proposal["status"], string> = {
  review: "검토 중",
  approved: "승인",
  rejected: "반려",
  completed: "완료",
};
const STATUS_CLASS: Record<Proposal["status"], string> = {
  review: "bg-[#FFF3DC] text-gold",
  approved: "bg-[#E4F5EE] text-teal",
  rejected: "bg-[#FDEBEC] text-red",
  completed: "bg-[#EAF0FB] text-blue",
};

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function ProposalsManager() {
  const supabase = createClient();
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: proposals, reload } = useRealtimeList<Proposal>("proposals", {
    orderBy: { column: "updated_at", ascending: false },
  });
  const { rows: votes } = useRealtimeList<ProposalVote>("proposal_votes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iAmAdmin, setIAmAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIAmAdmin(!!me && ["admin", "superadmin"].includes(me.role));
    });
  }, [supabase]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";
  const voteCount = (proposalId: string, vote: "yes" | "no") =>
    votes.filter((v) => v.proposal_id === proposalId && v.vote === vote).length;

  const changeStatus = async (id: string, status: Proposal["status"]) => {
    await supabase.from("proposals").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 안건을 삭제하시겠습니까? 투표 기록도 함께 삭제됩니다.")) return;
    await supabase.from("proposals").delete().eq("id", id);
    setSelectedId(null);
    reload();
  };

  const current = proposals.find((p) => p.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <h2 className="text-[22px] mb-4">조직 활동 · 안건함 관리</h2>
        <p className="text-muted mb-4 text-sm">
          학생들이 등록한 안건과 찬반 투표 현황을 확인하고 상태를 바꿀 수 있습니다. 삭제는 admin 이상만 가능합니다.
        </p>
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">조직</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">찬성/반대</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">상태</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`cursor-pointer hover:bg-[#F2F4F8] ${selectedId === p.id ? "bg-[#EAF0FB]" : ""}`}
              >
                <td className="p-2.5 border-b border-border text-sm">{p.title}</td>
                <td className="p-2.5 border-b border-border text-sm">{orgName(p.org_id)}</td>
                <td className="p-2.5 border-b border-border text-sm">
                  {voteCount(p.id, "yes")} / {voteCount(p.id, "no")}
                </td>
                <td className="p-2.5 border-b border-border">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr><td colSpan={4} className="text-muted text-center py-8 text-sm">등록된 안건이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {current && (
        <div className="bg-white border border-border rounded-xl p-[18px] sticky top-20">
          <h3>{current.title}</h3>
          <div className="text-xs text-muted mb-2">{orgName(current.org_id)} · {fmt(current.created_at)}</div>
          <p className="text-sm whitespace-pre-wrap">{current.summary}</p>
          <div className="text-sm font-bold mt-2.5">
            찬성 {voteCount(current.id, "yes")} · 반대 {voteCount(current.id, "no")}
          </div>
          <label className="text-xs font-bold text-muted mt-3 block">상태 변경</label>
          <select
            className="border border-border rounded-lg px-2.5 py-2 text-sm w-full"
            value={current.status}
            onChange={(e) => changeStatus(current.id, e.target.value as Proposal["status"])}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <div className="flex gap-2 mt-3.5">
            {iAmAdmin ? (
              <button onClick={() => remove(current.id)} className="text-red text-xs font-bold border border-border rounded-lg px-4 py-2">
                삭제
              </button>
            ) : (
              <span className="text-muted text-xs self-center" title="삭제는 admin 이상만 가능합니다">🔒 삭제 불가</span>
            )}
            <button onClick={() => setSelectedId(null)} className="border border-border text-sm rounded-lg px-4 py-2 ml-auto">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
