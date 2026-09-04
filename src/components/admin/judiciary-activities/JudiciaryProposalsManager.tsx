"use client";

import AdminTable, { truncateCellProps, actionCellClass } from "../AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { JudiciaryProposal, JudiciaryProposalVote } from "@/lib/types";

const STATUS_OPTIONS: JudiciaryProposal["status"][] = ["review", "approved", "rejected", "completed"];
const STATUS_LABEL: Record<JudiciaryProposal["status"], string> = {
  review: "검토 중",
  approved: "승인",
  rejected: "반려",
  completed: "완료",
};
const STATUS_CLASS: Record<JudiciaryProposal["status"], string> = {
  review: "bg-[#FFF3DC] text-gold",
  approved: "bg-[#E4F5EE] text-teal",
  rejected: "bg-[#FDEBEC] text-red",
  completed: "bg-[#EAF0FB] text-blue",
};

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * 사법위원회 전용 안건함. 임원회 안건함(ProposalsManager, proposals 테이블)을 복사해서
 * 만들었지만 judiciary_proposals/judiciary_proposal_votes라는 완전히 별개의 테이블을
 * 쓴다 — 데이터도 RLS도 서로 공유하지 않는다. 사법위원회는 여러 부서를 모아 보여주는
 * 임원회와 달리 단일 조직이라 "소속 부서" 선택 UI가 없다. 열람 자체도 RLS에서
 * is_judiciary(사법위원회 소속) 또는 superadmin/designer로 막혀 있어 전체 공개하지 않는다.
 */
export default function JudiciaryProposalsManager() {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const { rows: proposals, reload } = useRealtimeList<JudiciaryProposal>("judiciary_proposals", {
    orderBy: { column: "updated_at", ascending: false },
  });
  const { rows: votes } = useRealtimeList<JudiciaryProposalVote>("judiciary_proposal_votes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { myId, isAdmin: iAmAdmin, role } = useMyRole();
  const canModerateProposal = iAmAdmin || role === "designer";
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ title: "", summary: "" });
  const [error, setError] = useState<string | null>(null);

  const submitNew = async () => {
    setError(null);
    if (!myId) return;
    if (!form.title.trim() || !form.summary.trim()) {
      setError("제목과 내용을 모두 입력해 주세요.");
      return;
    }
    const { error } = await supabase.from("judiciary_proposals").insert({
      title: form.title,
      summary: form.summary,
      author_id: myId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ title: "", summary: "" });
    setWriting(false);
    reload();
  };

  const voteCount = (proposalId: string, vote: "yes" | "no") =>
    votes.filter((v) => v.proposal_id === proposalId && v.vote === vote).length;
  const myVote = (proposalId: string) => votes.find((v) => v.proposal_id === proposalId && v.user_id === myId);
  const castVote = async (proposalId: string, vote: "yes" | "no") => {
    if (!myId) return;
    const existing = myVote(proposalId);
    if (existing && existing.vote === vote) {
      await supabase.from("judiciary_proposal_votes").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("judiciary_proposal_votes").update({ vote }).eq("id", existing.id);
    } else {
      await supabase.from("judiciary_proposal_votes").insert({ proposal_id: proposalId, user_id: myId, vote });
    }
  };

  const changeStatus = async (id: string, status: JudiciaryProposal["status"]) => {
    if (!canModerateProposal) return;
    const { error } = await supabase
      .from("judiciary_proposals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 안건을 삭제하시겠습니까? 투표 기록도 함께 삭제됩니다.")) return;
    await supabase.from("judiciary_proposals").delete().eq("id", id);
    setSelectedId(null);
    reload();
  };

  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("judiciary_proposals").update({ is_hidden: !isHidden }).eq("id", id);
    reload();
  };

  const current = proposals.find((p) => p.id === selectedId);

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${current ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">사법위원회 · 안건함</h2>
          <button onClick={() => setWriting((v) => !v)} className={t.adminBtnPrimary}>
            {writing ? "닫기" : "+ 안건 추가"}
          </button>
        </div>
        <p className="text-muted mb-4 text-sm">
          등록된 안건에 찬성/반대 투표를 하고(1인 1표, 다시 누르면 취소·다른 쪽을 누르면 전환)
          현황을 확인할 수 있습니다. 상태 변경은 admin 이상, 삭제는 작성자 본인 또는 admin
          이상만 가능합니다.
        </p>
        {writing && (
          <div className={`${t.adminEditPanel} flex flex-col gap-1.5 mb-4`}>
            <label className="text-sm font-bold">안건 제목</label>
            <input className={t.adminInput} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label className="text-sm font-bold mt-2">안건 내용</label>
            <textarea
              rows={4}
              className={t.adminInput}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
            {error && <div className="text-red text-xs">{error}</div>}
            <button onClick={submitNew} className={`${t.adminBtnPrimary} mt-3 self-start`}>
              안건 등록
            </button>
          </div>
        )}
        <AdminTable>
          <thead>
            <tr>
              <th className={t.adminTableHeaderCell}>제목</th>
              <th className={`${t.adminTableHeaderCell} w-24`}>찬성/반대</th>
              <th className={`${t.adminTableHeaderCell} w-20`}>상태</th>
              <th className={`${t.adminTableHeaderCell} w-32`} />
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`cursor-pointer ${t.adminTableRowHover} ${selectedId === p.id ? t.adminTableRowActive : ""}`}
              >
                <td className={t.adminTableCell}>
                  <div className="flex items-center gap-1">
                    <span {...truncateCellProps(p.title)}>{p.title}</span>
                    {p.is_hidden && (
                      <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] text-muted">숨김</span>
                    )}
                  </div>
                </td>
                <td className={t.adminTableCell}>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => castVote(p.id, "yes")}
                      className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 border shrink-0 cursor-pointer transition-colors ${
                        myVote(p.id)?.vote === "yes"
                          ? "bg-teal text-white border-teal"
                          : "border-border bg-white hover:bg-[#E4F5EE] hover:border-teal hover:text-teal"
                      }`}
                    >
                      찬성 {voteCount(p.id, "yes")}
                    </button>
                    <button
                      onClick={() => castVote(p.id, "no")}
                      className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 border shrink-0 cursor-pointer transition-colors ${
                        myVote(p.id)?.vote === "no"
                          ? "bg-red text-white border-red"
                          : "border-border bg-white hover:bg-[#FDEBEC] hover:border-red hover:text-red"
                      }`}
                    >
                      반대 {voteCount(p.id, "no")}
                    </button>
                  </div>
                </td>
                <td className={t.adminTableCell}>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className={t.adminTableCell}>
                  <div className={actionCellClass}>
                    <button
                      className="text-blue text-xs font-bold shrink-0"
                      onClick={(e) => { e.stopPropagation(); toggleHidden(p.id, p.is_hidden); }}
                    >
                      {p.is_hidden ? "숨김 해제" : "숨김"}
                    </button>
                    {(myId === p.author_id || canModerateProposal) && (
                      <button
                        className={`${t.adminBtnDanger} shrink-0`}
                        onClick={(e) => { e.stopPropagation(); remove(p.id); }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
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
        <div className={`${t.adminEditPanel} sticky top-20`}>
          <h3>{current.title}</h3>
          <div className="text-xs text-muted mb-2">{fmt(current.created_at)}</div>
          <p className="text-sm whitespace-pre-wrap">{current.summary}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => castVote(current.id, "yes")}
              className={`text-xs font-bold rounded-lg px-3 py-1.5 border cursor-pointer transition-colors ${
                myVote(current.id)?.vote === "yes"
                  ? "bg-teal text-white border-teal"
                  : "border-border bg-white hover:bg-[#E4F5EE] hover:border-teal hover:text-teal"
              }`}
            >
              찬성 {voteCount(current.id, "yes")}
            </button>
            <button
              onClick={() => castVote(current.id, "no")}
              className={`text-xs font-bold rounded-lg px-3 py-1.5 border cursor-pointer transition-colors ${
                myVote(current.id)?.vote === "no"
                  ? "bg-red text-white border-red"
                  : "border-border bg-white hover:bg-[#FDEBEC] hover:border-red hover:text-red"
              }`}
            >
              반대 {voteCount(current.id, "no")}
            </button>
          </div>
          <label className="text-xs font-bold text-muted mt-3 block">상태 변경</label>
          {canModerateProposal ? (
            <select
              className={`${t.adminInput} w-full`}
              value={current.status}
              onChange={(e) => changeStatus(current.id, e.target.value as JudiciaryProposal["status"])}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted" title="상태 변경은 admin 이상만 가능합니다">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[current.status]}`}>
                {STATUS_LABEL[current.status]}
              </span>
              🔒 admin 이상만 변경 가능
            </div>
          )}
          <div className="flex items-center gap-2 mt-3.5 flex-wrap">
            <button onClick={() => toggleHidden(current.id, current.is_hidden)} className={t.adminBtnSecondary}>
              {current.is_hidden ? "숨김 해제" : "숨김"}
            </button>
            {(myId === current.author_id || canModerateProposal) ? (
              <button onClick={() => remove(current.id)} className={t.adminBtnSecondary}>
                삭제
              </button>
            ) : (
              <span className="text-muted text-xs self-center" title="삭제는 작성자 본인 또는 admin 이상만 가능합니다">🔒 삭제 불가</span>
            )}
            <button onClick={() => setSelectedId(null)} className={`${t.adminBtnSecondary} ml-auto`}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
