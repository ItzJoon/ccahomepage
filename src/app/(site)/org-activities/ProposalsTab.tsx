"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useWriteRestriction } from "@/hooks/useWriteRestriction";
import Linkify from "@/components/Linkify";
import { STATUS_CLASS, STATUS_LABEL, fmt } from "./helpers";
import type { Organization, Proposal, ProposalVote } from "@/lib/types";

export default function ProposalsTab({ orgs, orgFilter, q }: { orgs: Organization[]; orgFilter: string; q: string }) {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ org_id: "", title: "", summary: "" });
  const [error, setError] = useState<string | null>(null);
  const { isRestricted, message } = useWriteRestriction();

  const { rows: proposals } = useRealtimeList<Proposal>("proposals", {
    orderBy: { column: "updated_at", ascending: false },
  });
  const { rows: votes } = useRealtimeList<ProposalVote>("proposal_votes");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";

  const list = proposals
    .filter((p) => orgFilter === "all" || p.org_id === orgFilter)
    .filter((p) => !q.trim() || p.title.includes(q) || p.summary.includes(q));

  const myVote = (proposalId: string) => votes.find((v) => v.proposal_id === proposalId && v.user_id === userId);
  const voteCount = (proposalId: string, vote: "yes" | "no") =>
    votes.filter((v) => v.proposal_id === proposalId && v.vote === vote).length;

  const castVote = async (proposalId: string, vote: "yes" | "no") => {
    if (!userId) return;
    if (isRestricted) {
      alert(message);
      return;
    }
    const existing = myVote(proposalId);
    if (existing && existing.vote === vote) {
      await supabase.from("proposal_votes").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("proposal_votes").update({ vote }).eq("id", existing.id);
    } else {
      await supabase.from("proposal_votes").insert({ proposal_id: proposalId, user_id: userId, vote });
    }
  };

  const submit = async () => {
    setError(null);
    if (!userId) {
      setError("로그인 후 안건을 등록할 수 있습니다.");
      return;
    }
    if (isRestricted) {
      setError(message);
      return;
    }
    if (!form.org_id || !form.title.trim() || !form.summary.trim()) {
      setError("소속 부서, 제목, 내용을 모두 입력해 주세요.");
      return;
    }
    const { error } = await supabase.from("proposals").insert({
      org_id: form.org_id,
      title: form.title,
      summary: form.summary,
      author_id: userId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ org_id: "", title: "", summary: "" });
    setWriting(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setWriting((v) => !v)}
          className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5"
        >
          {writing ? "닫기" : "+ 안건 제안"}
        </button>
      </div>

      {writing && (
        <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 mb-4">
          {userId === null && (
            <div className="text-sm bg-[#FFF7E6] rounded-lg p-3 mb-2">로그인 후 안건을 등록할 수 있습니다.</div>
          )}
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
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            안건 등록
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {list.map((p) => {
          const mine = myVote(p.id);
          return (
            <div key={p.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                <h3 className="text-base m-0">{p.title}</h3>
              </div>
              <div className="text-muted text-xs mb-2">{orgName(p.org_id)} · {fmt(p.created_at)}</div>
              <p className="text-sm whitespace-pre-wrap"><Linkify text={p.summary} /></p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={() => castVote(p.id, "yes")}
                  disabled={!userId}
                  className={`text-xs font-bold rounded-lg px-3 py-1.5 border transition-colors ${
                    mine?.vote === "yes"
                      ? "bg-teal text-white border-teal"
                      : "border-border bg-white hover:bg-[#E4F5EE] hover:border-teal hover:text-teal"
                  } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-border disabled:hover:text-inherit cursor-pointer`}
                >
                  찬성 {voteCount(p.id, "yes")}
                </button>
                <button
                  onClick={() => castVote(p.id, "no")}
                  disabled={!userId}
                  className={`text-xs font-bold rounded-lg px-3 py-1.5 border transition-colors ${
                    mine?.vote === "no"
                      ? "bg-red text-white border-red"
                      : "border-border bg-white hover:bg-[#FDEBEC] hover:border-red hover:text-red"
                  } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-border disabled:hover:text-inherit cursor-pointer`}
                >
                  반대 {voteCount(p.id, "no")}
                </button>
                {!userId && <span className="text-muted text-xs">로그인하면 투표할 수 있어요</span>}
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="text-muted text-center py-8 text-sm">
            {q.trim() ? "검색 결과가 없습니다." : "등록된 안건이 없습니다."}
          </div>
        )}
      </div>
    </div>
  );
}
