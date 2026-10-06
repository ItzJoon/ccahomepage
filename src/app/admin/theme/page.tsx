"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { homeThemeStyles, THEME_LABELS } from "@/lib/homeTheme";

const THEME_KEYS = Object.keys(homeThemeStyles) as (keyof typeof homeThemeStyles)[];

// 카드 미리보기용 색상 견본(테마 객체 값에서 그대로 뽑을 수 없는 값들이 많아 직접 정의)
const SWATCHES: Record<string, string[]> = {
  apple: ["#2563eb", "#f2f2f7", "#111827"],
};

export default function AdminThemePage() {
  const supabase = createClient();
  // 이 화면 전용으로 site_theme을 따로(비실시간) 조회하면, 그 구독이 아직 로딩 중인
  // 짧은 순간 DEFAULT_HOME_THEME로 잘못 폴백해 "엉뚱한 테마가 현재 적용중"으로 잠깐
  // 보였다가 실제 값으로 바뀌는 깜빡임이 생긴다(실제로 classic/green을 지우기 전엔 이
  // 화면을 열 때마다 "클래식 적용중"이 잠깐 떴다). admin 레이아웃이 이미 realtime으로
  // 구독해 AdminThemeContext에 올려둔 "살아있는" 값을 그대로 재사용하면(다른 모든 관리자
  // 화면과 동일한 패턴), 첫 렌더부터 정확한 값으로 그려지고 테마를 바꾼 즉시(realtime)
  // 반영되어 수동 reload()도 필요 없다.
  const { themeKey: currentKey } = useHomeTheme();

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
        developer만 바꿀 수 있습니다.
      </p>

      {!roleLoading && !canView && (
        <div className="bg-[#FFF3DC] dark:bg-white/10 text-gold text-sm rounded-lg p-3 mb-4">
          이 화면은 developer만 이용할 수 있습니다.
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
              className={`text-left bg-surface border rounded-xl p-4 transition-shadow disabled:cursor-not-allowed ${
                active ? "border-navy dark:border-white/40 shadow-md" : "border-border hover:shadow-sm"
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
