"use client";

import AdminTable, { truncateCellProps, actionCellClass } from "@/components/admin/AdminTable";
import { AdminCardList, AdminCard, AdminCardTitle, AdminCardMeta, AdminCardFooter, AdminCardAction } from "@/components/admin/AdminCard";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useList } from "@/hooks/useList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import ImageUpload from "@/components/ImageUpload";
import { adminDisplayName } from "@/lib/displayName";
import type { SpecialEvent, UniformCheck, DirectoryMember } from "@/lib/types";

const EVENT_TYPE_LABEL: Record<SpecialEvent["event_type"], string> = {
  uniform_check: "출석 체크형(교복 챌린지 등)",
};

const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

const empty = {
  title: "",
  description: "",
  poster_image_url: "",
  event_type: "uniform_check" as SpecialEvent["event_type"],
  start_date: todayStr(),
  end_date: todayStr(),
};

export default function AdminEventsSpecialPage() {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const { myId, isEditorUp } = useMyRole();
  const { rows, reload } = useList<SpecialEvent>("special_events", { orderBy: { column: "start_date", ascending: false } });
  const { rows: directory } = useList<DirectoryMember>("directory_members");

  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [initialForm, setInitialForm] = useState({ ...empty });
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  // 체크 현황 감사용 — 날짜 하나 골라서(기본 오늘) 그 날짜의 반별 체크 현황을 본다.
  const [auditDate, setAuditDate] = useState(todayStr());
  const [auditChecks, setAuditChecks] = useState<UniformCheck[]>([]);
  const [checkerNames, setCheckerNames] = useState<Record<string, string>>({});
  const [auditLoading, setAuditLoading] = useState(false);

  // 학생 directory_members에서 실제 존재하는 (학년,반) 조합만 뽑아 "우리 학교에 있는 반
  // 목록"으로 쓴다 — 하드코딩하지 않아서 나중에 반 구성이 바뀌어도 그대로 따라간다.
  const classes = useMemo(() => {
    const set = new Map<string, { grade: string; homeroom: number }>();
    directory
      .filter((d) => d.member_type === "student" && d.grade && d.homeroom)
      .forEach((d) => set.set(`${d.grade}-${d.homeroom}`, { grade: d.grade as string, homeroom: d.homeroom as number }));
    return Array.from(set.values()).sort((a, b) => a.grade.localeCompare(b.grade) || a.homeroom - b.homeroom);
  }, [directory]);

  const loadAudit = async (eventId: string, date: string) => {
    setAuditLoading(true);
    const { data } = await supabase
      .from("uniform_checks")
      .select("*")
      .eq("event_id", eventId)
      .eq("check_date", date);
    const checks = (data as UniformCheck[]) ?? [];
    setAuditChecks(checks);
    const ids = Array.from(new Set(checks.map((c) => c.checked_by).filter((x): x is string => !!x)));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, name, nickname, email").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => (map[p.id] = adminDisplayName(p)));
      setCheckerNames(map);
    } else {
      setCheckerNames({});
    }
    setAuditLoading(false);
  };

  useEffect(() => {
    if (editing && editing !== "new") loadAudit(editing, auditDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, auditDate]);

  const startNew = () => {
    setForm({ ...empty });
    setInitialForm({ ...empty });
    setEditing("new");
  };
  const startEdit = (e: SpecialEvent) => {
    const next = {
      title: e.title,
      description: e.description || "",
      poster_image_url: e.poster_image_url || "",
      event_type: e.event_type,
      start_date: e.start_date,
      end_date: e.end_date,
    };
    setForm(next);
    setInitialForm(next);
    setAuditDate(todayStr());
    setEditing(e.id);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = { ...form, poster_image_url: form.poster_image_url || null, description: form.description || null };
    if (editing === "new") {
      await supabase.from("special_events").insert({ ...payload, created_by: myId });
    } else if (editing) {
      await supabase.from("special_events").update(payload).eq("id", editing);
    }
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 이벤트를 삭제하시겠습니까? 관련 체크 기록도 함께 삭제됩니다.")) return;
    await supabase.from("special_events").delete().eq("id", id);
    setEditing(null);
    reload();
  };

  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("special_events").update({ is_hidden: !isHidden }).eq("id", id);
    reload();
  };

  // editor 이상이 체크 기록을 직접 정정 — 기존 행이 있으면 update, 없으면(그 반 대의원이
  // 아직 체크를 안 한 날짜) 관리자가 대신 처음 기록하는 셈이라 insert. checked_by는
  // INSERT 시점에 stamp_uniform_check_author 트리거가 auth.uid()(=이 관리자)로 자동
  // 채우고, UPDATE는 그 트리거가 안 걸려 원래 대의원 id가 그대로 보존된다.
  const correctCheck = async (grade: string, homeroom: number, allWearing: boolean) => {
    if (!editing || editing === "new") return;
    const existing = auditChecks.find((c) => c.grade === grade && c.homeroom === homeroom);
    if (existing) {
      await supabase.from("uniform_checks").update({ all_wearing: allWearing }).eq("id", existing.id);
    } else {
      await supabase.from("uniform_checks").insert({ event_id: editing, grade, homeroom, check_date: auditDate, all_wearing: allWearing });
    }
    loadAudit(editing, auditDate);
  };

  const formPanel = (
    <div className={`${t.adminEditPanel} flex flex-col gap-1.5 sm:sticky sm:top-20`}>
      <h3>{editing === "new" ? "새 이벤트" : "이벤트 수정"}</h3>
      <label className="text-xs font-bold text-muted mt-2">제목</label>
      <input className={t.adminInput} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <label className="text-xs font-bold text-muted mt-2">설명</label>
      <textarea rows={3} className={t.adminInput} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <label className="text-xs font-bold text-muted mt-2">포스터 이미지</label>
      {myId && (
        <ImageUpload
          userId={myId}
          value={form.poster_image_url || null}
          onChange={(url) => setForm({ ...form, poster_image_url: url || "" })}
          bucket="attachments"
        />
      )}
      <label className="text-xs font-bold text-muted mt-2">유형</label>
      <select
        className={t.adminInput}
        value={form.event_type}
        onChange={(e) => setForm({ ...form, event_type: e.target.value as SpecialEvent["event_type"] })}
      >
        {Object.entries(EVENT_TYPE_LABEL).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
      <label className="text-xs font-bold text-muted mt-2">시작일</label>
      <input type="date" className={t.adminInput} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
      <label className="text-xs font-bold text-muted mt-2">종료일</label>
      <input type="date" className={t.adminInput} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
      <div className="flex gap-2 mt-3.5">
        <button onClick={save} disabled={!isDirty} className={`${t.adminBtnPrimary} disabled:opacity-40 disabled:cursor-not-allowed`}>저장</button>
        <button onClick={() => setEditing(null)} className={t.adminBtnSecondary}>취소</button>
        <button onClick={() => editing && editing !== "new" && remove(editing)} className="text-red text-sm font-bold ml-auto">삭제</button>
      </div>

      {editing && editing !== "new" && form.event_type === "uniform_check" && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="font-bold text-sm m-0">체크 현황 감사</h4>
            <input type="date" className={`${t.adminInput} text-xs`} value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
          </div>
          {auditLoading ? (
            <p className="text-muted text-xs">불러오는 중…</p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
              {classes.map((c) => {
                const check = auditChecks.find((x) => x.grade === c.grade && x.homeroom === c.homeroom);
                return (
                  <li key={`${c.grade}-${c.homeroom}`} className="flex items-center justify-between gap-2 text-xs border border-border rounded-lg px-2.5 py-2">
                    <div>
                      <div className="font-bold">{c.grade}학년 {c.homeroom}반</div>
                      {check ? (
                        <div className="text-muted">
                          {checkerNames[check.checked_by ?? ""] ?? "-"} · {new Date(check.checked_at).toLocaleString("ko-KR")}
                        </div>
                      ) : (
                        <div className="text-gold font-bold">미체크</div>
                      )}
                    </div>
                    {isEditorUp && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => correctCheck(c.grade, c.homeroom, true)}
                          className={`rounded-lg px-2 py-1 font-bold ${check?.all_wearing === true ? "bg-teal text-white" : "border border-border"}`}
                        >
                          전원 착용
                        </button>
                        <button
                          onClick={() => correctCheck(c.grade, c.homeroom, false)}
                          className={`rounded-lg px-2 py-1 font-bold ${check?.all_wearing === false ? "bg-red text-white" : "border border-border"}`}
                        >
                          미착용자 있음
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${editing ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">이벤트 관리</h2>
          <button onClick={startNew} className={t.adminBtnPrimary}>+ 새 이벤트</button>
        </div>
        <AdminCardList>
          {rows.map((e) => (
            <AdminCard
              key={e.id}
              onClick={() => (editing === e.id ? setEditing(null) : startEdit(e))}
              faded={!!e.is_hidden}
              selected={editing === e.id}
              detail={editing === e.id ? formPanel : undefined}
            >
              <AdminCardTitle>{e.title}</AdminCardTitle>
              <AdminCardMeta>
                <span>{e.start_date} ~ {e.end_date}</span>
                <span>· {EVENT_TYPE_LABEL[e.event_type]}</span>
              </AdminCardMeta>
              <AdminCardFooter>
                <div>{e.is_hidden && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] dark:bg-white/10 text-muted">숨김</span>}</div>
                <div className="flex items-center gap-1.5">
                  <AdminCardAction onClick={() => toggleHidden(e.id, e.is_hidden)}>{e.is_hidden ? "숨김 해제" : "숨김"}</AdminCardAction>
                  <AdminCardAction danger onClick={() => remove(e.id)}>삭제</AdminCardAction>
                </div>
              </AdminCardFooter>
            </AdminCard>
          ))}
          {rows.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 이벤트가 없습니다.</div>}
        </AdminCardList>
        <AdminTable hasCardFallback>
          <thead>
            <tr>
              <th className={t.adminTableHeaderCell}>제목</th>
              <th className={`${t.adminTableHeaderCell} w-28`}>기간</th>
              <th className={`${t.adminTableHeaderCell} w-32`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} onClick={() => startEdit(e)} className={`cursor-pointer ${t.adminTableRowHover} ${editing === e.id ? t.adminTableRowActive : ""}`}>
                <td className={t.adminTableCell}>
                  <div className="flex items-center gap-1">
                    <span {...truncateCellProps(e.title)}>{e.title}</span>
                    {e.is_hidden && (
                      <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] dark:bg-white/10 text-muted">숨김</span>
                    )}
                  </div>
                </td>
                <td className={t.adminTableCell}>{e.start_date} ~ {e.end_date}</td>
                <td className={t.adminTableCell}>
                  <div className={actionCellClass}>
                    <button
                      className="text-blue text-xs font-bold shrink-0"
                      onClick={(ev) => { ev.stopPropagation(); toggleHidden(e.id, e.is_hidden); }}
                    >
                      {e.is_hidden ? "숨김 해제" : "숨김"}
                    </button>
                    <button className={`${t.adminBtnDanger} shrink-0`} onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">등록된 이벤트가 없습니다.</td></tr>}
          </tbody>
        </AdminTable>
      </div>
      {editing && <div className={editing !== "new" ? "hidden sm:block" : ""}>{formPanel}</div>}
    </div>
  );
}
