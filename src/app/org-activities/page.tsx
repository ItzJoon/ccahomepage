"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import type { Organization, Proposal, ProposalVote } from "@/lib/types";

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

export default function OrgActivitiesPage() {
  const [tab, setTab] = useState<"proposals" | "events" | "records">("proposals");
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const [orgFilter, setOrgFilter] = useState("all");

  return (
    <div>
      <SectionTitle eyebrow="ORGANIZATIONS" title="조직 활동" />
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
            조직 일정
          </button>
          <button
            className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "records" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setTab("records")}
          >
            활동기록
          </button>
        </div>
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        >
          <option value="all">전체 조직</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {tab === "proposals" && <ProposalsTab orgs={orgs} orgFilter={orgFilter} />}
      {tab === "events" && <div className="text-muted text-center py-14 text-sm">조직 일정 탭은 곧 추가됩니다.</div>}
      {tab === "records" && <div className="text-muted text-center py-14 text-sm">활동기록 탭은 곧 추가됩니다.</div>}
    </div>
  );
}

function ProposalsTab({ orgs, orgFilter }: { orgs: Organization[]; orgFilter: string }) {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ org_id: "", title: "", summary: "" });
  const [error, setError] = useState<string | null>(null);

  const { rows: proposals } = useRealtimeList<Proposal>("proposals", {
    orderBy: { column: "updated_at", ascending: false },
  });
  const { rows: votes } = useRealtimeList<ProposalVote>("proposal_votes");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";

  const list = orgFilter === "all" ? proposals : proposals.filter((p) => p.org_id === orgFilter);

  const myVote = (proposalId: string) => votes.find((v) => v.proposal_id === proposalId && v.user_id === userId);
  const voteCount = (proposalId: string, vote: "yes" | "no") =>
    votes.filter((v) => v.proposal_id === proposalId && v.vote === vote).length;

  const castVote = async (proposalId: string, vote: "yes" | "no") => {
    if (!userId) return;
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
    if (!form.org_id || !form.title.trim() || !form.summary.trim()) {
      setError("소속 조직, 제목, 내용을 모두 입력해 주세요.");
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
          <label className="text-sm font-bold">소속 조직</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.org_id}
            onChange={(e) => setForm({ ...form, org_id: e.target.value })}
          >
            <option value="">조직을 선택하세요</option>
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
              <p className="text-sm whitespace-pre-wrap">{p.summary}</p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={() => castVote(p.id, "yes")}
                  disabled={!userId}
                  className={`text-xs font-bold rounded-lg px-3 py-1.5 border ${
                    mine?.vote === "yes" ? "bg-teal text-white border-teal" : "border-border bg-white"
                  } disabled:opacity-40`}
                >
                  찬성 {voteCount(p.id, "yes")}
                </button>
                <button
                  onClick={() => castVote(p.id, "no")}
                  disabled={!userId}
                  className={`text-xs font-bold rounded-lg px-3 py-1.5 border ${
                    mine?.vote === "no" ? "bg-red text-white border-red" : "border-border bg-white"
                  } disabled:opacity-40`}
                >
                  반대 {voteCount(p.id, "no")}
                </button>
                {!userId && <span className="text-muted text-xs">로그인하면 투표할 수 있어요</span>}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 안건이 없습니다.</div>}
      </div>
    </div>
  );
}
