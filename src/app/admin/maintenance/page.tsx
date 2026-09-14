"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useList } from "@/hooks/useList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { todayKST } from "@/lib/date";
import type { SiteSettings } from "@/lib/types";

export default function AdminMaintenancePage() {
  const supabase = createClient();
  const { rows, reload } = useList<SiteSettings>("site_settings");
  const settings = rows.find((r) => r.id === "default");

  const { isAdmin: iAmAdmin, role } = useMyRole();
  const isDesigner = role === "designer";
  const { t } = useHomeTheme();
  const [form, setForm] = useState({
    maintenance_mode: false,
    maintenance_message: "",
    maintenance_until: "",
    maintenance_until_unknown: false,
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        maintenance_mode: settings.maintenance_mode,
        maintenance_message: settings.maintenance_message,
        maintenance_until: settings.maintenance_until || "",
        maintenance_until_unknown: settings.maintenance_until_unknown,
      });
    }
  }, [settings]);

  const isDirty = !!settings && (
    form.maintenance_mode !== settings.maintenance_mode ||
    form.maintenance_message !== settings.maintenance_message ||
    form.maintenance_until !== (settings.maintenance_until || "") ||
    form.maintenance_until_unknown !== settings.maintenance_until_unknown
  );

  const save = async () => {
    setSaving(true);
    // 사이트 잠금 중에는 학생들이 실제로 체크인을 할 수 없으므로(관리자 발행 화면
    // 대신 점검 안내만 보임) Vercel 사용량 한도 초과 같은 사이트 전체 장애와 똑같이
    // 연속 접속(streak)이 끊길 위험이 있다 — 잠금을 켜고 끄는 시점에 맞춰
    // site_outages(schema.sql 127번) 기간을 자동으로 열고/닫아서, 관리자가 SQL을
    // 따로 실행하지 않아도 이 버튼 하나로 streak가 보호되게 한다.
    const turningOn = form.maintenance_mode && !settings?.maintenance_mode;
    const turningOff = !form.maintenance_mode && settings?.maintenance_mode;
    await supabase
      .from("site_settings")
      .update({
        maintenance_mode: form.maintenance_mode,
        maintenance_message: form.maintenance_message,
        // "미정"과 특정 날짜는 동시에 표시할 이유가 없으므로 서로 배타적으로 저장한다.
        maintenance_until: form.maintenance_until_unknown ? null : form.maintenance_until || null,
        maintenance_until_unknown: form.maintenance_until_unknown,
      })
      .eq("id", "default");
    if (turningOn) {
      await supabase.from("site_outages").insert({ started_at: todayKST(), note: "사이트 잠금(관리자 점검 모드)" });
    } else if (turningOff) {
      await supabase.from("site_outages").update({ ended_at: todayKST() }).is("ended_at", null);
    }
    setSaving(false);
    setSavedMsg(true);
    reload(); // realtime이 아니므로 저장 후 기준값(isDirty 비교 대상)을 직접 갱신
    setTimeout(() => setSavedMsg(false), 2000);
  };

  if (!settings) return null;

  return (
    <div className="max-w-xl">
      <h2 className="text-[22px] mb-2">사이트 잠금</h2>
      <p className="text-muted mb-4 text-sm">
        켜면 admin/developer를 제외한 모든 사용자(비로그인 포함, editor도 포함)가 어떤 페이지에
        들어와도 <code>/maintenance</code> 안내 화면으로 이동합니다. admin 이상만 켜고 끌 수 있습니다.
        잠금 중에는 아무도 체크인을 할 수 없어서, 켜고 끄는 동안은 연속 접속(streak)이
        끊기지 않도록 자동으로 보호됩니다.
      </p>

      <div className={`${t.adminEditPanel} flex flex-col gap-1.5`}>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            disabled={!iAmAdmin}
            checked={form.maintenance_mode}
            onChange={(e) => setForm({ ...form, maintenance_mode: e.target.checked })}
          />
          사이트 잠금 켜기
          {form.maintenance_mode && <span className="text-red text-xs font-bold">● 현재 잠금 상태</span>}
        </label>

        <label className="text-xs font-bold text-muted mt-3">안내 문구</label>
        <textarea
          rows={3}
          disabled={!iAmAdmin}
          className={`${t.adminInput} disabled:bg-[#F7F8FB] dark:disabled:bg-white/5`}
          value={form.maintenance_message}
          onChange={(e) => setForm({ ...form, maintenance_message: e.target.value })}
        />

        <label className="text-xs font-bold text-muted mt-3">예정 종료일 (선택, 안내 화면에 표시됨)</label>
        <input
          type="date"
          disabled={!iAmAdmin || form.maintenance_until_unknown}
          className={`${t.adminInput} disabled:bg-[#F7F8FB] dark:disabled:bg-white/5`}
          value={form.maintenance_until}
          onChange={(e) => setForm({ ...form, maintenance_until: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm mt-1.5">
          <input
            type="checkbox"
            disabled={!iAmAdmin}
            checked={form.maintenance_until_unknown}
            onChange={(e) =>
              setForm({ ...form, maintenance_until_unknown: e.target.checked, maintenance_until: "" })
            }
          />
          종료일 미정 (Vercel 사용량 한도 초과처럼 언제 끝날지 모를 때)
        </label>

        {iAmAdmin || isDesigner ? (
          <div className="flex items-center gap-2 mt-3.5">
            <button disabled={!iAmAdmin || saving || !isDirty} onClick={save} className={`${t.adminBtnPrimary} disabled:opacity-40 disabled:cursor-not-allowed`}>
              {saving ? "저장 중…" : "저장"}
            </button>
            {savedMsg && <span className="text-teal text-sm font-bold">저장되었습니다 ✓</span>}
          </div>
        ) : (
          <p className="text-muted text-xs mt-3.5">🔒 사이트 잠금 설정 변경은 admin 이상만 가능합니다.</p>
        )}
      </div>
    </div>
  );
}
