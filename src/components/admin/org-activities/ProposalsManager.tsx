"use client";

import AdminTable, { truncateCellProps, actionCellClass } from "../AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
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
  const { t } = useHomeTheme();
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: proposals, reload } = useRealtimeList<Proposal>("proposals", {
    orderBy: { column: "updated_at", ascending: false },
  });
  const { rows: votes } = useRealtimeList<ProposalVote>("proposal_votes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { myId, isAdmin: iAmAdmin, isEditorUp: iAmEditorUp } = useMyRole();
  // 원래는 학생용 /org-activities 공개 페이지에서만 안건을 등록할 수 있었는데, 부서 활동이
  // 임원회 전용으로 바뀌면서 이 관리 화면(이 페이지에 들어올 수 있다는 것 자체가 이미
  // is_council 또는 superadmin이라는 뜻)에서도 바로 등록할 수 있게 추가했다.
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ org_id: "", title: "", summary: "" });
  const [error, setError] = useState<string | null>(null);

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
  // 학생용 /org-activities 안건함(ProposalsTab)과 동일한 방식 — 같은 버튼을 다시 누르면
  // 취소, 다른 버튼을 누르면 전환, 그 외엔 새로 투표. proposal_votes의
  // unique(proposal_id, user_id) 제약이 DB 레벨에서 1인 1표를 보장한다.
  const myVote = (proposalId: string) => votes.find((v) => v.proposal_id === proposalId && v.user_id === myId);
  const castVote = async (proposalId: string, vote: "yes" | "no") => {
    if (!myId) return;
    const existing = myVote(proposalId);
    if (existing && existing.vote === vote) {
      await supabase.from("proposal_votes").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("proposal_votes").update({ vote }).eq("id", existing.id);
    } else {
      await supabase.from("proposal_votes").insert({ proposal_id: proposalId, user_id: myId, vote });
    }
  };

  // 안건 상태(검토중/승인/반려/완료) 변경은 admin 이상만 할 수 있다 — 이 화면 자체는
  // is_council(임원회)이면 role과 무관하게 들어올 수 있게 됐지만, 공식 처리 결과를
  // 확정하는 상태 변경은 그보다 좁은 admin 이상 권한으로 유지한다(DB 트리거로도 강제됨).
  const changeStatus = async (id: string, status: Proposal["status"]) => {
    if (!iAmAdmin) return;
    const { error } = await supabase.from("proposals").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 안건을 삭제하시겠습니까? 투표 기록도 함께 삭제됩니다.")) return;
    await supabase.from("proposals").delete().eq("id", id);
    setSelectedId(null);
    reload();
  };

  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("proposals").update({ is_hidden: !isHidden }).eq("id", id);
    reload();
  };

  const current = proposals.find((p) => p.id === selectedId);

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${current ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">부서 활동 · 안건함 관리</h2>
          <button
            onClick={() => setWriting((v) => !v)}
            className={t.adminBtnPrimary}
          >
            {writing ? "닫기" : "+ 안건 추가"}
          </button>
        </div>
        <p className="text-muted mb-4 text-sm">
          등록된 안건에 찬성/반대 투표를 하고(1인 1표, 다시 누르면 취소·다른 쪽을 누르면 전환)
          현황을 확인할 수 있습니다. 상태 변경은 admin 이상, 숨김은 editor 이상, 삭제는 작성자
          본인 또는 admin 이상만 가능합니다.
        </p>
        {writing && (
          <div className={`${t.adminEditPanel} flex flex-col gap-1.5 mb-4`}>
            <label className="text-sm font-bold">소속 부서</label>
            <select
              className={t.adminInput}
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
              className={t.adminInput}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
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
              <th className={`${t.adminTableHeaderCell} w-28`}>부서</th>
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
                <td className={t.adminTableCell}>{orgName(p.org_id)}</td>
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
                    {iAmEditorUp && (
                      <button
                        className="text-blue text-xs font-bold shrink-0"
                        onClick={(e) => { e.stopPropagation(); toggleHidden(p.id, p.is_hidden); }}
                      >
                        {p.is_hidden ? "숨김 해제" : "숨김"}
                      </button>
                    )}
                    {(myId === p.author_id || iAmAdmin) && (
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
              <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 안건이 없습니다.</td></tr>
            )}
          </tbody>
        </AdminTable>
      </div>
      {current && (
        <div className={`${t.adminEditPanel} sticky top-20`}>
          <h3>{current.title}</h3>
          <div className="text-xs text-muted mb-2">{orgName(current.org_id)} · {fmt(current.created_at)}</div>
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
          {iAmAdmin ? (
            <select
              className={`${t.adminInput} w-full`}
              value={current.status}
              onChange={(e) => changeStatus(current.id, e.target.value as Proposal["status"])}
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
            {iAmEditorUp && (
              <button
                onClick={() => toggleHidden(current.id, current.is_hidden)}
                className={t.adminBtnSecondary}
              >
                {current.is_hidden ? "숨김 해제" : "숨김"}
              </button>
            )}
            {(myId === current.author_id || iAmAdmin) ? (
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
