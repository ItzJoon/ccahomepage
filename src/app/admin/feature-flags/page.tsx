"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyRole } from "@/hooks/useMyRole";
import type { FeatureFlag } from "@/lib/types";

const LABELS: Record<string, { label: string; description: string }> = {
  notices: { label: "공지사항", description: "학생 화면의 공지사항 메뉴(목록/상세) 전체" },
  organizations: { label: "학생자치회 소개", description: "학생 화면의 학생자치회 소개(부서 목록/상세) 메뉴 전체" },
  members: { label: "구성원", description: "학생 화면의 구성원(학교 전체 명단) 메뉴 전체" },
  calendar: { label: "일정", description: "학생 화면의 일정 메뉴(목록/상세) 전체" },
  news: { label: "뉴스", description: "학생 화면의 뉴스 메뉴(목록/상세) 전체" },
  rules: { label: "생활규정", description: "학생 화면의 생활규정 메뉴 전체" },
  qna: { label: "Q&A", description: "학생 화면의 Q&A 메뉴(질문 등록/열람) 전체" },
  board: { label: "게시판", description: "학생 화면의 게시판 메뉴(글/댓글 작성 및 열람) 전체" },
};

export default function AdminFeatureFlagsPage() {
  const supabase = createClient();
  // feature_flags는 기본키가 id가 아니라 key라서 useRealtimeList(항상 id 기준)를 쓰지
  // 않고 직접 조회한다. 자주 바뀌는 값이 아니라 실시간 구독까지는 필요 없다.
  const [rows, setRows] = useState<FeatureFlag[]>([]);
  const { myId, isSuperadmin, role, loading: roleLoading } = useMyRole();
  // designer(조회 전용)는 superadmin 전용 화면도 볼 수 있어야 하므로 경고 배너에서는
  // 제외한다(실제 조작 차단은 DesignerModeGate가 담당).
  const canView = isSuperadmin || role === "designer";
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("feature_flags").select("*").order("key");
    setRows((data as FeatureFlag[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (key: string, enabled: boolean) => {
    if (!myId) return;
    setSaving(key);
    await supabase
      .from("feature_flags")
      .update({ enabled, updated_at: new Date().toISOString(), updated_by: myId })
      .eq("key", key);
    await load();
    setSaving(null);
  };

  return (
    <div>
      <h2 className="text-[22px] mb-2">기능 활성화 스위치</h2>
      <p className="text-muted mb-4">
        메뉴 전체를 학생 화면에서 통째로 켜고 끕니다. 끄면 메뉴 자체가 안 보이고 URL로
        직접 들어와도 접근이 막힙니다. superadmin만 바꿀 수 있습니다.
      </p>

      {!roleLoading && !canView && (
        <div className="bg-[#FFF3DC] text-gold text-sm rounded-lg p-3 mb-4">
          이 화면은 superadmin만 이용할 수 있습니다.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {rows.map((flag) => {
          const info = LABELS[flag.key] ?? { label: flag.key, description: "" };
          return (
            <div key={flag.key} className="bg-white border border-border rounded-xl p-4">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  disabled={!isSuperadmin || saving === flag.key}
                  checked={flag.enabled}
                  onChange={(e) => toggle(flag.key, e.target.checked)}
                />
                {info.label}
                {!flag.enabled && <span className="text-red text-xs font-bold">● 꺼짐</span>}
              </label>
              <p className="text-muted text-xs mt-1.5 mb-0">{info.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
