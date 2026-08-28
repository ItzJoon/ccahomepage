"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import AccountPicker, { accountDisplayName } from "@/components/admin/AccountPicker";
import type { BadgeDef, Profile } from "@/lib/types";

const empty = {
  code: "",
  label: "",
  description: "",
  icon: "🏅",
  award_type: "auto" as "auto" | "manual",
  streak_threshold: 3,
  order_index: 0,
  is_active: true,
};

const sortKey = (b: BadgeDef) => b.streak_threshold ?? Infinity;

export default function AdminBadgesPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<BadgeDef>("badges", { orderBy: { column: "order_index" } });
  const { rows: profiles } = useRealtimeList<Profile>("profiles", { orderBy: { column: "created_at", ascending: false } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });

  const [grantUser, setGrantUser] = useState<Profile | null>(null);
  const [grantBadgeId, setGrantBadgeId] = useState("");
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  const startNew = () => {
    setForm({ ...empty, order_index: rows.length + 1 });
    setEditing("new");
  };
  const startEdit = (b: BadgeDef) => {
    setForm({
      code: b.code,
      label: b.label,
      description: b.description || "",
      icon: b.icon,
      award_type: b.award_type,
      streak_threshold: b.streak_threshold ?? 3,
      order_index: b.order_index,
      is_active: b.is_active,
    });
    setEditing(b.id);
  };

  const save = async () => {
    if (!form.code.trim() || !form.label.trim()) return;
    if (form.award_type === "auto" && form.streak_threshold <= 0) return;
    const payload = {
      code: form.code,
      label: form.label,
      description: form.description,
      icon: form.icon,
      award_type: form.award_type,
      streak_threshold: form.award_type === "auto" ? form.streak_threshold : null,
      order_index: form.order_index,
      is_active: form.is_active,
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
      setGrantUser(null);
      setGrantBadgeId("");
    }
    setTimeout(() => setGrantMsg(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">뱃지 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 뱃지 추가</button>
        </div>
        <p className="text-muted mb-4 text-sm">
          지급 방식이 "자동"이면 연속 접속일수가 조건에 도달하는 즉시 학생에게 자동 지급됩니다.
          "수동"은 자동으로 지급되지 않고, 아래 "뱃지 직접 부여"에서 관리자가 달성을 확인한 뒤 원하는 학생에게 지급합니다.
          비활성화하면 신규 지급(자동/수동 모두)만 멈추고, 이미 받은 학생의 뱃지는 유지됩니다.
        </p>
        <table className="w-full border-collapse bg-white">
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
                  <div className="font-bold">{b.label}</div>
                  <div className="text-muted text-xs">{b.description}</div>
                </td>
                <td className="p-2.5 border-b border-border text-sm">
                  {b.award_type === "auto" ? `연속 ${b.streak_threshold}일` : "수동 부여"}
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
        </table>

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
              >
                <option value="">뱃지를 선택하세요</option>
                {[...rows].sort((a, b) => sortKey(a) - sortKey(b)).map((b) => (
                  <option key={b.id} value={b.id}>{b.icon} {b.label}</option>
                ))}
              </select>
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
          <label className="text-xs font-bold text-muted mt-2">설명</label>
          <textarea rows={2} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <label className="text-xs font-bold text-muted mt-2">지급 방식</label>
          <select
            className="border border-border rounded-lg px-2.5 py-2 text-sm"
            value={form.award_type}
            onChange={(e) => setForm({ ...form, award_type: e.target.value as "auto" | "manual" })}
          >
            <option value="auto">자동 (연속 접속일수 조건 도달 시)</option>
            <option value="manual">수동 (관리자가 달성 확인 후 직접 부여)</option>
          </select>

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
          {form.award_type === "manual" && (
            <p className="text-muted text-xs">저장 후 왼쪽 "뱃지 직접 부여"에서 학생을 골라 지급하세요.</p>
          )}

          <label className="flex items-center gap-2 text-sm mt-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            활성화 (학생에게 지급)
          </label>
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
