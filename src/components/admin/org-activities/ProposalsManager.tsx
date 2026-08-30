"use client";

import AdminTable, { truncateCellProps } from "../AdminTable";
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
  const [myId, setMyId] = useState<string | null>(null);
  // 원래는 학생용 /org-activities 공개 페이지에서만 안건을 등록할 수 있었는데, 부서 활동이
  // 임원회 전용으로 바뀌면서 이 관리 화면(이 페이지에 들어올 수 있다는 것 자체가 이미
  // is_council 또는 superadmin이라는 뜻)에서도 바로 등록할 수 있게 추가했다.
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ org_id: "", title: "", summary: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setMyId(data.user.id);
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIAmAdmin(!!me && ["admin", "superadmin"].includes(me.role));
    });
  }, [supabase]);

  const submitNew = async () => {
    setError(null);
    if (!myId) return;
    if (!form.org_id || !form.title.trim() || !form.summary.trim()) {
      setError("소속 부서, 제목, 내용을 모두 입력해 주세요.");
      return;
    }
    const { error } = await supabase.from("proposals").insert({
      org_id: form.org_id,
      title: form.title,
      summary: form.summary,
      author_id: myId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ org_id: "", title: "", summary: "" });
    setWriting(false);
    reload();
  };

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
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">부서 활동 · 안건함 관리</h2>
          <button
            onClick={() => setWriting((v) => !v)}
            className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5"
          >
            {writing ? "닫기" : "+ 안건 추가"}
          </button>
        </div>
        <p className="text-muted mb-4 text-sm">
          등록된 안건과 찬반 투표 현황을 확인하고 상태를 바꿀 수 있습니다. 삭제는 admin 이상만 가능합니다.
        </p>
        {writing && (
          <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 mb-4">
            <label className="text-sm font-bold">소속 부서</label>
            <select
              className="border border-border rounded-lg px-3 py-2 text-sm"
              value={form.org_id}
              onChange={(e) => setForm({ ...form, org_id: e.target.value })}
            >
              <option value="">부서를 선택하세요</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <label className="text-sm font-bold mt-2">안건 제목</label>
            <input
              className="border border-border rounded-lg px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <label className="text-sm font-bold mt-2">안건 내용</label>
            <textarea
              rows={4}
              className="border border-border rounded-lg px-3 py-2 text-sm"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
            {error && <div className="text-red text-xs">{error}</div>}
            <button onClick={submitNew} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
              안건 등록
            </button>
          </div>
        )}
        <AdminTable>
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">부서</th>
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
                <td className="p-2.5 border-b border-border text-sm">
                  <span {...truncateCellProps(p.title)}>{p.title}</span>
                </td>
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
        </AdminTable>
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
