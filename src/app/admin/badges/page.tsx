"use client";

import AdminTable from "@/components/admin/AdminTable";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import AccountPicker, { accountDisplayName } from "@/components/admin/AccountPicker";
import type { BadgeDef, Profile } from "@/lib/types";

const empty = {
  code: "",
  label: "",
  description: "",
  icon: "🏅",
  award_type: "auto" as "auto" | "manual" | "date",
  streak_threshold: 3,
  date_condition: "before" as "before" | "after" | "on" | "between",
  date_condition_value: "",
  date_condition_value_end: "",
  order_index: 0,
  is_active: true,
  is_secret: false,
};

const dateConditionLabel: Record<"before" | "after" | "on" | "between", string> = {
  before: "이전에 로그인",
  after: "이후에 로그인",
  on: "당일에 로그인",
  between: "사이에 로그인",
};

const sortKey = (b: BadgeDef) => b.streak_threshold ?? Infinity;

export default function AdminBadgesPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<BadgeDef>("badges", { orderBy: { column: "order_index" } });
  const { rows: profiles } = useRealtimeList<Profile>("profiles", { orderBy: { column: "created_at", ascending: false } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [initialForm, setInitialForm] = useState({ ...empty });
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const [grantUser, setGrantUser] = useState<Profile | null>(null);
  const [grantUserEarnedIds, setGrantUserEarnedIds] = useState<Set<string>>(new Set());
  const [grantBadgeId, setGrantBadgeId] = useState("");
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  useEffect(() => {
    setGrantBadgeId("");
    if (!grantUser) {
      setGrantUserEarnedIds(new Set());
      return;
    }
    supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", grantUser.id)
      .then(({ data }) => setGrantUserEarnedIds(new Set((data ?? []).map((d) => d.badge_id))));
  }, [grantUser, supabase]);

  const grantableBadges = [...rows].sort((a, b) => sortKey(a) - sortKey(b)).filter((b) => !grantUserEarnedIds.has(b.id));

  const startNew = () => {
    const next = { ...empty, order_index: rows.length + 1 };
    setForm(next);
    setInitialForm(next);
    setEditing("new");
  };
  const startEdit = (b: BadgeDef) => {
    const next = {
      code: b.code,
      label: b.label,
      description: b.description || "",
      icon: b.icon,
      award_type: b.award_type,
      streak_threshold: b.streak_threshold ?? 3,
      date_condition: b.date_condition ?? "before",
      date_condition_value: b.date_condition_value ?? "",
      date_condition_value_end: b.date_condition_value_end ?? "",
      order_index: b.order_index,
      is_active: b.is_active,
      is_secret: b.is_secret,
    };
    setForm(next);
    setInitialForm(next);
    setEditing(b.id);
  };

  const save = async () => {
    if (!form.code.trim() || !form.label.trim()) return;
    if (form.award_type === "auto" && form.streak_threshold <= 0) return;
    if (form.award_type === "date" && !form.date_condition_value) return;
    if (form.award_type === "date" && form.date_condition === "between" && !form.date_condition_value_end) return;
    const payload = {
      code: form.code,
      label: form.label,
      description: form.description,
      icon: form.icon,
      award_type: form.award_type,
      streak_threshold: form.award_type === "auto" ? form.streak_threshold : null,
      date_condition: form.award_type === "date" ? form.date_condition : null,
      date_condition_value: form.award_type === "date" ? form.date_condition_value : null,
      date_condition_value_end: form.award_type === "date" && form.date_condition === "between" ? form.date_condition_value_end : null,
      order_index: form.order_index,
      is_active: form.is_active,
      is_secret: form.is_secret,
    };
    if (editing === "new") await supabase.from("badges").insert(payload);
    else if (editing) await supabase.from("badges").update(payload).eq("id", editing);
    setEditing(null);
    reload();
  };

  const toggleActive = async (b: BadgeDef) => {
    await supabase.from("badges").update({ is_active: !b.is_active }).eq("id", b.id);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 뱃지를 삭제하면 이미 획득한 학생 기록도 함께 삭제됩니다. 계속할까요?")) return;
    await supabase.from("badges").delete().eq("id", id);
    reload();
  };

  const grantBadge = async () => {
    if (!grantUser || !grantBadgeId) return;
    const { error } = await supabase.from("user_badges").insert({ user_id: grantUser.id, badge_id: grantBadgeId });
    setGrantMsg(error ? (error.code === "23505" ? "이미 이 학생에게 지급된 뱃지입니다." : "지급에 실패했습니다.") : "뱃지를 지급했습니다.");
    if (!error) {
      // 학생 선택은 유지해서, 같은 학생에게 다른 뱃지도 이어서 줄 수 있게 한다.
      setGrantUserEarnedIds((prev) => new Set([...prev, grantBadgeId]));
      setGrantBadgeId("");
    }
    setTimeout(() => setGrantMsg(null), 3000);
  };

  const revokeBadge = async (badgeId: string) => {
    if (!grantUser) return;
    if (!confirm("이 학생에게서 이 뱃지를 회수할까요?")) return;
    const { error } = await supabase.from("user_badges").delete().eq("user_id", grantUser.id).eq("badge_id", badgeId);
    if (!error) {
      setGrantUserEarnedIds((prev) => {
        const next = new Set(prev);
        next.delete(badgeId);
        return next;
      });
      setGrantMsg("뱃지를 회수했습니다.");
      setTimeout(() => setGrantMsg(null), 3000);
    }
  };

  const grantUserEarnedBadges = [...rows]
    .sort((a, b) => sortKey(a) - sortKey(b))
    .filter((b) => grantUserEarnedIds.has(b.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">뱃지 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 뱃지 추가</button>
        </div>
        <p className="text-muted mb-4 text-sm">
          지급 방식이 "자동"이면 연속 접속일수가 조건에 도달하는 즉시 학생에게 자동 지급됩니다.
          "날짜 조건"이면 특정 날짜 이전/이후/당일에 로그인(체크인)하는 순간 자동 지급됩니다.
          "수동"은 자동으로 지급되지 않고, 아래 "뱃지 직접 부여"에서 관리자가 달성을 확인한 뒤 원하는 학생에게 지급합니다.
          비활성화하면 학생 화면 노출과 자동 지급만 멈추고, "뱃지 직접 부여"로는 계속 줄 수 있습니다
          (이미 받은 학생의 뱃지는 항상 유지됩니다). "시크릿"으로 설정하면 획득하기 전까지 학생 목록에
          아예 보이지 않다가, 지급받는 순간 드러납니다.
        </p>
        <AdminTable>
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-14">아이콘</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">조건</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">상태</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => sortKey(a) - sortKey(b)).map((b) => (
              <tr key={b.id} onClick={() => startEdit(b)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === b.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border text-xl">{b.icon}</td>
                <td className="p-2.5 border-b border-border text-sm">
                  <div className="font-bold flex items-center gap-1">
                    {b.label}
                    {b.is_secret && <span className="text-[10px] font-bold text-blue border border-blue rounded px-1">시크릿</span>}
                  </div>
                  <div className="text-muted text-xs">{b.description}</div>
                </td>
                <td className="p-2.5 border-b border-border text-sm">
                  {b.award_type === "auto"
                    ? `연속 ${b.streak_threshold}일`
                    : b.award_type === "date"
                    ? b.date_condition === "between"
                      ? `${b.date_condition_value}~${b.date_condition_value_end} 사이 로그인`
                      : `${b.date_condition_value} ${dateConditionLabel[b.date_condition ?? "before"]}`
                    : "수동 부여"}
                </td>
                <td className="p-2.5 border-b border-border">
                  <button
                    className={`text-xs font-bold ${b.is_active ? "text-teal" : "text-muted"}`}
                    onClick={(e) => { e.stopPropagation(); toggleActive(b); }}
                  >
                    {b.is_active ? "활성" : "비활성"}
                  </button>
                </td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={(e) => { e.stopPropagation(); remove(b.id); }}>삭제</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 뱃지가 없습니다.</td></tr>}
          </tbody>
        </AdminTable>

        <div className="bg-white border border-border rounded-xl p-[18px] mt-5">
          <h3 className="mb-1">뱃지 직접 부여</h3>
          <p className="text-muted text-xs mb-3">학생을 검색해 원하는 뱃지를 바로 지급합니다. 자동 지급 뱃지도 예외적으로 직접 줄 수 있습니다.</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start">
            <div>
              <label className="text-xs font-bold text-muted block mb-1">학생 선택</label>
              <AccountPicker
                profiles={profiles}
                linkedProfile={grantUser}
                onLink={(p) => setGrantUser(p)}
                onUnlink={() => setGrantUser(null)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">뱃지 선택</label>
              <select
                className="border border-border rounded-lg px-2.5 py-2 text-sm w-full"
                value={grantBadgeId}
                onChange={(e) => setGrantBadgeId(e.target.value)}
                disabled={!grantUser || grantableBadges.length === 0}
              >
                <option value="">
                  {!grantUser ? "학생을 먼저 선택하세요" : grantableBadges.length === 0 ? "모든 뱃지를 이미 획득했습니다" : "뱃지를 선택하세요"}
                </option>
                {grantableBadges.map((b) => (
                  <option key={b.id} value={b.id}>{b.icon} {b.label}</option>
                ))}
              </select>
              {grantUser && (
                <p className="text-muted text-[11px] mt-1">
                  {grantUser.nickname || grantUser.name || grantUser.email}님이 아직 못 받은 뱃지만 표시됩니다.
                </p>
              )}
            </div>
            <button
              onClick={grantBadge}
              disabled={!grantUser || !grantBadgeId}
              className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-40 sm:mt-[22px]"
            >
              부여
            </button>
          </div>
          {grantMsg && <p className="text-sm mt-2 font-bold text-teal">{grantMsg}</p>}

          {grantUser && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-sm font-bold mb-2">
                {grantUser.nickname || grantUser.name || grantUser.email}님이 보유한 뱃지
              </h4>
              {grantUserEarnedBadges.length === 0 ? (
                <p className="text-muted text-xs">아직 획득한 뱃지가 없습니다.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {grantUserEarnedBadges.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 bg-[#F7F8FB] rounded-lg px-3 py-2">
                      <span className="text-sm flex items-center gap-1.5">
                        <span className="text-lg">{b.icon}</span>
                        {b.label}
                      </span>
                      <button onClick={() => revokeBadge(b.id)} className="text-red text-xs font-bold shrink-0">회수</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "뱃지 추가" : "뱃지 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">코드 (영문, 고유값)</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="예: streak_14" />
          <label className="text-xs font-bold text-muted mt-2">아이콘 (이모지 1자)</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">뱃지 이름</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />

          <label className="text-xs font-bold text-muted mt-2">지급 방식</label>
          <select
            className="border border-border rounded-lg px-2.5 py-2 text-sm"
            value={form.award_type}
            onChange={(e) => setForm({ ...form, award_type: e.target.value as "auto" | "manual" | "date" })}
          >
            <option value="auto">자동 (연속 접속일수 조건 도달 시)</option>
            <option value="date">날짜 조건 (특정 날짜 이전/이후/당일 로그인)</option>
            <option value="manual">수동 (자유 조건, 관리자가 확인 후 직접 부여)</option>
          </select>

          <label className="text-xs font-bold text-muted mt-2">
            {form.award_type === "manual" ? "달성 조건 (자유롭게 작성)" : "설명"}
          </label>
          <textarea
            rows={2}
            className="border border-border rounded-lg px-2.5 py-2 text-sm"
            placeholder={form.award_type === "manual" ? "예: ○○ 선생님과 진로 상담 완료하기" : undefined}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          {form.award_type === "auto" && (
            <>
              <label className="text-xs font-bold text-muted mt-2">달성 조건 (연속 접속 일수)</label>
              <input
                type="number"
                min={1}
                className="border border-border rounded-lg px-2.5 py-2 text-sm"
                value={form.streak_threshold}
                onChange={(e) => setForm({ ...form, streak_threshold: Number(e.target.value) })}
              />
            </>
          )}
          {form.award_type === "date" && (
            <>
              <label className="text-xs font-bold text-muted mt-2">달성 조건 (날짜)</label>
              <select
                className="border border-border rounded-lg px-2.5 py-2 text-sm"
                value={form.date_condition}
                onChange={(e) => setForm({ ...form, date_condition: e.target.value as "before" | "after" | "on" | "between" })}
              >
                <option value="before">특정 날짜 이전에 로그인</option>
                <option value="after">특정 날짜 이후에 로그인</option>
                <option value="on">특정 날짜에 로그인</option>
                <option value="between">특정 기간 사이에 로그인</option>
              </select>
              {form.date_condition === "between" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="border border-border rounded-lg px-2.5 py-2 text-sm flex-1"
                    value={form.date_condition_value}
                    onChange={(e) => setForm({ ...form, date_condition_value: e.target.value })}
                  />
                  <span className="text-muted text-xs">~</span>
                  <input
                    type="date"
                    className="border border-border rounded-lg px-2.5 py-2 text-sm flex-1"
                    value={form.date_condition_value_end}
                    onChange={(e) => setForm({ ...form, date_condition_value_end: e.target.value })}
                  />
                </div>
              ) : (
                <input
                  type="date"
                  className="border border-border rounded-lg px-2.5 py-2 text-sm"
                  value={form.date_condition_value}
                  onChange={(e) => setForm({ ...form, date_condition_value: e.target.value })}
                />
              )}
              <p className="text-muted text-xs">
                {form.date_condition === "between"
                  ? "시작일과 종료일 모두 포함해서, 체크인(접속) 날짜가 그 사이면 자동 지급됩니다."
                  : "체크인(접속) 시점에 조건을 만족하면 그 즉시 자동 지급됩니다."}
              </p>
            </>
          )}
          {form.award_type === "manual" && (
            <p className="text-muted text-xs">저장 후 왼쪽 "뱃지 직접 부여"에서 학생을 골라 지급하세요.</p>
          )}

          <label className="flex items-center gap-2 text-sm mt-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            활성화 (지급 가능 상태로 켜기)
          </label>
          <label className="flex items-center gap-2 text-sm mt-1">
            <input type="checkbox" checked={form.is_secret} onChange={(e) => setForm({ ...form, is_secret: e.target.checked })} />
            시크릿 (획득 전까지 학생에게 숨김)
          </label>
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} disabled={!isDirty} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
