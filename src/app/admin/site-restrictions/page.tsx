"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { SiteRestriction, SiteRestrictionWindow } from "@/lib/types";

const DEFAULT_WINDOWS: SiteRestrictionWindow[] = [{ label: "", start: "09:00", end: "16:30" }];

/**
 * 수업시간 등 지정한 시간대 동안 학생 계정의 글쓰기(Q&A/게시판/안건함/투표)와
 * Q&A·게시판 열람을 막는 기능. 실제 차단은 RLS(supabase/schema.sql 92번의
 * is_student_restricted_now())와 middleware.ts(Q&A/게시판 열람 리다이렉트)가
 * 담당하고, 이 화면은 설정(켜짐 여부/교시별 시간대 목록)만 관리한다.
 *
 * windows는 처음부터 jsonb 배열로 설계해서 교시별로 여러 구간을 등록할 수 있고,
 * 뒷단(is_now_in_restricted_window, useWriteRestriction, middleware)은 이미
 * 배열 전체를 순회하며 하나라도 걸리면 제한하도록 돼 있어 여기서 UI만 확장한다.
 */
export default function AdminSiteRestrictionsPage() {
  const supabase = createClient();
  const { rows } = useRealtimeList<SiteRestriction>("site_restrictions", {
    filter: (q) => q.eq("id", "default"),
  });
  const restriction = rows[0];
  const { myId, isSuperadmin } = useMyRole();
  const { t } = useHomeTheme();

  const [isEnabled, setIsEnabled] = useState(false);
  const [windows, setWindows] = useState<SiteRestrictionWindow[]>(DEFAULT_WINDOWS);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (restriction) {
      setIsEnabled(restriction.is_enabled);
      setWindows(restriction.windows.length > 0 ? restriction.windows : DEFAULT_WINDOWS);
    }
  }, [restriction]);

  const isDirty =
    !!restriction &&
    (isEnabled !== restriction.is_enabled || JSON.stringify(windows) !== JSON.stringify(restriction.windows));

  const updateWindow = (idx: number, patch: Partial<SiteRestrictionWindow>) => {
    setWindows((ws) => ws.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  };

  const addWindow = () => {
    setWindows((ws) => [...ws, { label: "", start: "09:00", end: "10:00" }]);
  };

  const removeWindow = (idx: number) => {
    setWindows((ws) => ws.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (windows.length === 0) return;
    setSaving(true);
    await supabase
      .from("site_restrictions")
      .update({
        is_enabled: isEnabled,
        windows,
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
    <div className="max-w-2xl">
      <h2 className="text-[22px] mb-2">사이트 제한</h2>
      <p className="text-muted mb-4 text-sm">
        켜면 아래 등록된 시간대 중 하나라도 해당될 때 학생 계정은 Q&A/게시판을 아예
        열람할 수 없고, 안건함 안건 등록·투표를 포함한 글쓰기가 모두 막힙니다.
        교시별로 여러 구간을 등록할 수 있습니다(예: 1교시 09:00~10:00, 2교시
        10:10~11:10). teacher/editor/admin/developer 등 관리 권한이 있는 역할은
        이 시간에도 예외 없이 그대로 이용할 수 있습니다.
      </p>

      <div className={`${t.adminEditPanel} flex flex-col gap-1.5`}>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            disabled={!isSuperadmin}
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
          />
          수업시간 제한 켜기
          {isEnabled && <span className="text-red text-xs font-bold">● 현재 켜짐</span>}
        </label>

        <label className="text-xs font-bold text-muted mt-3">제한 시간대 목록</label>
        <div className="flex flex-col gap-2">
          {windows.map((w, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="예: 1교시"
                disabled={!isSuperadmin}
                className={`${t.adminInput} disabled:bg-[#F7F8FB] w-24`}
                value={w.label ?? ""}
                onChange={(e) => updateWindow(idx, { label: e.target.value })}
              />
              <input
                type="time"
                disabled={!isSuperadmin}
                className={`${t.adminInput} disabled:bg-[#F7F8FB]`}
                value={w.start}
                onChange={(e) => updateWindow(idx, { start: e.target.value })}
              />
              <span className="text-muted text-sm">~</span>
              <input
                type="time"
                disabled={!isSuperadmin}
                className={`${t.adminInput} disabled:bg-[#F7F8FB]`}
                value={w.end}
                onChange={(e) => updateWindow(idx, { end: e.target.value })}
              />
              {isSuperadmin && windows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeWindow(idx)}
                  className="text-red text-xs font-bold shrink-0"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>

        {isSuperadmin && (
          <button type="button" onClick={addWindow} className="text-blue text-xs font-bold w-fit mt-1">
            + 시간대 추가
          </button>
        )}

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
