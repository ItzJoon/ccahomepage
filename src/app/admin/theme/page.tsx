"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { homeThemeStyles, THEME_LABELS, DEFAULT_HOME_THEME, isHomeThemeKey } from "@/lib/homeTheme";
import type { SiteTheme } from "@/lib/types";

const THEME_KEYS = Object.keys(homeThemeStyles) as (keyof typeof homeThemeStyles)[];

// 카드 미리보기용 색상 견본(테마 객체 값에서 그대로 뽑을 수 없는 값들이 많아 직접 정의)
const SWATCHES: Record<string, string[]> = {
  classic: ["#16233F", "#2C4A7C", "#B8790F"],
  green: ["#111111", "#1D6F42", "#4ABA78"],
  apple: ["#2563eb", "#f2f2f7", "#111827"],
};

export default function AdminThemePage() {
  const supabase = createClient();
  const { rows } = useRealtimeList<SiteTheme>("site_theme");
  const current = rows.find((r) => r.id === "default");
  const currentKey = current && isHomeThemeKey(current.theme) ? current.theme : DEFAULT_HOME_THEME;

  const { myId, isSuperadmin, role, loading: roleLoading } = useMyRole();
  // designer(조회 전용)는 superadmin 전용 화면도 볼 수 있어야 하므로 경고 배너에서는
  // 제외한다(실제 조작 차단은 DesignerModeGate가 담당).
  const canView = isSuperadmin || role === "designer";
  const [saving, setSaving] = useState<string | null>(null);

  const applyTheme = async (key: string) => {
    if (!myId || key === currentKey) return;
    setSaving(key);
    await supabase
      .from("site_theme")
      .update({ theme: key, updated_at: new Date().toISOString(), updated_by: myId })
      .eq("id", "default");
    setSaving(null);
  };

  return (
    <div>
      <h2 className="text-[22px] mb-2">테마</h2>
      <p className="text-muted mb-4">
        헤더·푸터·홈 화면의 디자인을 선택합니다. 고르는 즉시 모든 방문자 화면에 실시간으로 반영됩니다.
        superadmin만 바꿀 수 있습니다.
      </p>

      {!roleLoading && !canView && (
        <div className="bg-[#FFF3DC] text-gold text-sm rounded-lg p-3 mb-4">
          이 화면은 superadmin만 이용할 수 있습니다.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {THEME_KEYS.map((key) => {
          const info = THEME_LABELS[key];
          const active = key === currentKey;
          return (
            <button
              key={key}
              disabled={!isSuperadmin || saving !== null}
              onClick={() => applyTheme(key)}
              className={`text-left bg-white border rounded-xl p-4 transition-shadow disabled:cursor-not-allowed ${
                active ? "border-navy shadow-md" : "border-border hover:shadow-sm"
              }`}
            >
              <div className="flex gap-1.5 mb-3">
                {(SWATCHES[key] ?? []).map((c) => (
                  <span key={c} className="w-6 h-6 rounded-full border border-border" style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold">{info.label}</span>
                {active && <span className="text-teal text-xs font-bold">● 현재 적용중</span>}
                {saving === key && <span className="text-muted text-xs">적용 중…</span>}
              </div>
              <p className="text-muted text-xs m-0">{info.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
