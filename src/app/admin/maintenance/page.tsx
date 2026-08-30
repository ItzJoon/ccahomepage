"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import type { SiteSettings } from "@/lib/types";

export default function AdminMaintenancePage() {
  const supabase = createClient();
  const { rows } = useRealtimeList<SiteSettings>("site_settings");
  const settings = rows.find((r) => r.id === "default");

  const { isAdmin: iAmAdmin } = useMyRole();
  const [form, setForm] = useState({ maintenance_mode: false, maintenance_message: "", maintenance_until: "" });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        maintenance_mode: settings.maintenance_mode,
        maintenance_message: settings.maintenance_message,
        maintenance_until: settings.maintenance_until || "",
      });
    }
  }, [settings]);

  const isDirty = !!settings && (
    form.maintenance_mode !== settings.maintenance_mode ||
    form.maintenance_message !== settings.maintenance_message ||
    form.maintenance_until !== (settings.maintenance_until || "")
  );

  const save = async () => {
    setSaving(true);
    await supabase
      .from("site_settings")
      .update({
        maintenance_mode: form.maintenance_mode,
        maintenance_message: form.maintenance_message,
        maintenance_until: form.maintenance_until || null,
      })
      .eq("id", "default");
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  if (!settings) return null;

  return (
    <div className="max-w-xl">
      <h2 className="text-[22px] mb-2">사이트 잠금</h2>
      <p className="text-muted mb-4 text-sm">
        켜면 admin/superadmin을 제외한 모든 사용자(비로그인 포함, editor도 포함)가 어떤 페이지에
        들어와도 <code>/maintenance</code> 안내 화면으로 이동합니다. admin 이상만 켜고 끌 수 있습니다.
      </p>

      <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5">
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
          className="border border-border rounded-lg px-2.5 py-2 text-sm disabled:bg-[#F7F8FB]"
          value={form.maintenance_message}
          onChange={(e) => setForm({ ...form, maintenance_message: e.target.value })}
        />

        <label className="text-xs font-bold text-muted mt-3">예정 종료일 (선택, 안내 화면에 표시됨)</label>
        <input
          type="date"
          disabled={!iAmAdmin}
          className="border border-border rounded-lg px-2.5 py-2 text-sm disabled:bg-[#F7F8FB]"
          value={form.maintenance_until}
          onChange={(e) => setForm({ ...form, maintenance_until: e.target.value })}
        />

        {iAmAdmin ? (
          <div className="flex items-center gap-2 mt-3.5">
            <button disabled={saving || !isDirty} onClick={save} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
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
