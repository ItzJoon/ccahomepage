"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SectionTitle from "@/components/SectionTitle";
import DetailBackLink from "@/components/DetailBackLink";
import ModerationPanel from "@/components/admin/ModerationPanel";
import { useMyRole } from "@/hooks/useMyRole";
import type { BadgeDef, DirectoryProfileView } from "@/lib/types";

const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };

export default function MemberProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DirectoryProfileView | null>(null);
  const [badges, setBadges] = useState<(BadgeDef & { earned_at: string })[]>([]);
  const { isAdmin, role } = useMyRole();
  // designer도 admin과 동일하게 프로필에서 경고/정지/영구차단 조치를 쓸 수 있다(reports
  // 페이지와 동일한 이슈 — RLS의 user_warnings_insert_admin 등이 is_designer()를 허용).
  const canModerate = isAdmin || role === "designer";

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: profileRow } = await supabase
        .from("directory_profile_view")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();
      if (!active) return;
      setProfile((profileRow as DirectoryProfileView) ?? null);

      if (profileRow) {
        const { data: badgeRows } = await supabase
          .from("user_badges")
          .select("earned_at, badges(*)")
          .eq("user_id", params.id)
          .order("earned_at");
        if (!active) return;
        setBadges(
          ((badgeRows as any[]) ?? [])
            .filter((r) => r.badges)
            .map((r) => ({ ...(r.badges as BadgeDef), earned_at: r.earned_at }))
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase, params.id]);

  if (loading) return null;

  if (!profile) {
    return (
      <div>
        <SectionTitle eyebrow="DIRECTORY" title="구성원 프로필" />
        <div className="bg-white border border-border rounded-xl p-8 text-center text-muted text-sm">
          존재하지 않거나 볼 수 없는 프로필입니다.{" "}
          <button onClick={() => router.back()} className="text-blue font-bold">
            구성원 조회로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const subLine =
    profile.member_type === "student"
      ? `${profile.grade}학년 ${profile.homeroom ? HOMEROOM_LABEL[profile.homeroom] : ""}`
      : profile.subject || "-";

  return (
    <div>
      <SectionTitle eyebrow="DIRECTORY" title="구성원 프로필" />
      <DetailBackLink href="/members" label="구성원 조회로" />

      <div className="bg-white border border-border rounded-2xl p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-[96px_1fr] gap-4 items-center">
          {profile.profile_image ? (
            <img
              src={profile.profile_image}
              alt="프로필 사진"
              className="w-24 h-24 rounded-full object-cover border border-border mx-auto sm:mx-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-navy text-white flex items-center justify-center font-bold text-2xl mx-auto sm:mx-0">
              {(profile.nickname || profile.display_name)[0]}
            </div>
          )}
          <div className="text-center sm:text-left">
            <div className="text-xl font-black">{profile.nickname || profile.display_name}</div>
            <div className="text-muted text-sm mt-0.5">
              {profile.display_name} · {profile.member_type === "student" ? "학생" : "교사"} · {subLine}
            </div>
            {profile.bio && <p className="text-sm mt-2">{profile.bio}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="text-xs font-bold tracking-widest text-gold uppercase mb-1">BADGES</div>
        <h3 className="mb-3">획득한 뱃지</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {badges.map((b) => (
            <div key={b.id} className="relative group flex flex-col items-center gap-1 text-center">
              <div className="text-3xl cursor-default">{b.icon}</div>
              <div className="text-[11px] text-muted leading-tight">{b.label}</div>
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 rounded-lg bg-navy text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg">
                <div className="font-bold mb-0.5">{b.label}</div>
                {b.description && <div className="text-[#C9D2E3]">{b.description}</div>}
              </div>
            </div>
          ))}
          {badges.length === 0 && (
            <div className="text-muted text-sm col-span-full text-center py-4">아직 획득한 뱃지가 없습니다.</div>
          )}
        </div>
      </div>

      {canModerate && (
        <div className="bg-white border border-border rounded-2xl p-5 mt-4">
          <div className="text-xs font-bold tracking-widest text-red uppercase mb-1">ADMIN</div>
          <h3 className="mb-3">관리자 조치</h3>
          <ModerationPanel targetUserId={profile.id} />
        </div>
      )}
    </div>
  );
}
