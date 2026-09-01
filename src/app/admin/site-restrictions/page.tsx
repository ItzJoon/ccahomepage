"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { SiteRestriction } from "@/lib/types";

/**
 * 수업시간 등 지정한 시간대 동안 학생 계정의 글쓰기(Q&A/게시판/안건함/투표)와
 * Q&A·게시판 열람을 막는 기능. 실제 차단은 RLS(supabase/schema.sql 92번의
 * is_student_restricted_now())와 middleware.ts(Q&A/게시판 열람 리다이렉트)가
 * 담당하고, 이 화면은 설정(켜짐 여부/시간)만 관리한다.
 *
 * windows를 jsonb 배열로 저장해두긴 했지만(나중에 교시별 여러 구간으로 확장하기
 * 위함), 지금은 배열의 첫 항목 하나만 이 화면에서 편집한다.
 */
export default function AdminSiteRestrictionsPage() {
  const supabase = createClient();
  const { rows } = useRealtimeList<SiteRestriction>("site_restrictions", {
    filter: (q) => q.eq("id", "default"),
  });
  const restriction = rows[0];
  const { myId, isSuperadmin } = useMyRole();
  const { t } = useHomeTheme();

  const [form, setForm] = useState({ is_enabled: false, start: "09:00", end: "16:30" });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (restriction) {
      setForm({
        is_enabled: restriction.is_enabled,
        start: restriction.windows[0]?.start ?? "09:00",
        end: restriction.windows[0]?.end ?? "16:30",
      });
    }
  }, [restriction]);

  const isDirty =
    !!restriction &&
    (form.is_enabled !== restriction.is_enabled ||
      form.start !== (restriction.windows[0]?.start ?? "09:00") ||
      form.end !== (restriction.windows[0]?.end ?? "16:30"));

  const save = async () => {
    setSaving(true);
    await supabase
      .from("site_restrictions")
      .update({
        is_enabled: form.is_enabled,
        windows: [{ start: form.start, end: form.end }],
        updated_by: myId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  if (!restriction) return null;

  return (
    <div className="max-w-xl">
      <h2 className="text-[22px] mb-2">사이트 제한</h2>
      <p className="text-muted mb-4 text-sm">
        켜면 지정한 시간대 동안 학생 계정은 Q&A/게시판을 아예 열람할 수 없고, 안건함
        안건 등록·투표를 포함한 글쓰기가 모두 막힙니다. teacher/editor/admin/developer
        등 관리 권한이 있는 역할은 이 시간에도 예외 없이 그대로 이용할 수 있습니다.
      </p>

      <div className={`${t.adminEditPanel} flex flex-col gap-1.5`}>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            disabled={!isSuperadmin}
            checked={form.is_enabled}
            onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
          />
          수업시간 제한 켜기
          {form.is_enabled && <span className="text-red text-xs font-bold">● 현재 켜짐</span>}
        </label>

        <div className="flex items-center gap-3 mt-3">
          <div>
            <label className="text-xs font-bold text-muted block mb-1">시작 시각</label>
            <input
              type="time"
              disabled={!isSuperadmin}
              className={`${t.adminInput} disabled:bg-[#F7F8FB]`}
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted block mb-1">종료 시각</label>
            <input
              type="time"
              disabled={!isSuperadmin}
              className={`${t.adminInput} disabled:bg-[#F7F8FB]`}
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </div>
        </div>

        {isSuperadmin ? (
          <div className="flex items-center gap-2 mt-3.5">
            <button
              disabled={saving || !isDirty}
              onClick={save}
              className={`${t.adminBtnPrimary} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
            {savedMsg && <span className="text-teal text-sm font-bold">저장되었습니다 ✓</span>}
          </div>
        ) : (
          <p className="text-muted text-xs mt-3.5">🔒 사이트 제한 설정 변경은 developer(superadmin)만 가능합니다.</p>
        )}
      </div>
    </div>
  );
}
