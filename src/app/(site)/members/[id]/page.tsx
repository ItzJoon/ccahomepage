"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SectionTitle from "@/components/SectionTitle";
import DetailBackLink from "@/components/DetailBackLink";
import ModerationPanel from "@/components/admin/ModerationPanel";
import ProfileQuickEditModal from "@/components/ProfileQuickEditModal";
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
  const [editingProfile, setEditingProfile] = useState(false);
  const { isAdmin, isSuperadmin, myId, role } = useMyRole();
  // designer도 admin과 동일하게 프로필에서 경고/정지/영구차단 조치를 쓸 수 있다(reports
  // 페이지와 동일한 이슈 — RLS의 user_warnings_insert_admin 등이 is_designer()를 허용).
  const canModerate = isAdmin || role === "designer";
  // 히든 뱃지(secret_tier)는 "이 프로필의 주인이 획득했는지"가 아니라 "지금 보고 있는
  // 나(뷰어)도 이미 그 뱃지를 획득했는지"로 공개 여부를 가려야 한다 — 안 그러면 남의
  // 프로필에서 아직 내가 못 찾은 히든 뱃지의 이름/설명이 그대로 노출돼 버린다(실제 신고된
  // 버그). 마이페이지와 동일한 기준(secret_tier + 본인 earnedIds)을 여기서도 적용한다.
  const [viewerEarnedIds, setViewerEarnedIds] = useState<Set<string>>(new Set());

  const loadProfile = async () => {
    const { data: profileRow } = await supabase
      .from("directory_profile_view")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    setProfile((profileRow as DirectoryProfileView) ?? null);
    return profileRow;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const profileRow = await loadProfile();
      if (!active) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, params.id]);

  useEffect(() => {
    if (!myId) return;
    let active = true;
    supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", myId)
      .then(({ data }) => {
        if (active) setViewerEarnedIds(new Set((data ?? []).map((r) => r.badge_id)));
      });
    return () => {
      active = false;
    };
  }, [myId, supabase]);

  if (loading) return null;

  if (!profile) {
    return (
      <div>
        <SectionTitle eyebrow="DIRECTORY" title="구성원 프로필" />
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted text-sm">
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

  // 여기 badges는 이미 이 프로필 주인이 "실제로 획득한" 뱃지만 담고 있으므로(위 로딩
  // 코드 참고) 등급과 무관하게 전부 목록에 넣는다 — 등급별 표시 차등(실루엣/미스터리
  // 이미지)은 아래 렌더링에서만 처리한다(예전엔 슈퍼시크릿을 목록에서 아예 뺐는데,
  // 이제는 "타인에게는 존재는 보이되 정체만 완전히 가리는" 쪽으로 바뀌었다).
  const visibleBadges = badges;

  return (
    <div>
      <SectionTitle eyebrow="DIRECTORY" title="구성원 프로필" />
      <DetailBackLink href="/members" label="구성원 조회로" />

      <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
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
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <div className="text-xl font-black">{profile.nickname || profile.display_name}</div>
              {isAdmin && (
                <button onClick={() => setEditingProfile(true)} className="text-blue text-xs font-bold shrink-0">
                  닉네임 · 소개 수정
                </button>
              )}
            </div>
            <div className="text-muted text-sm mt-0.5">
              {profile.display_name} · {profile.member_type === "student" ? "학생" : "교사"} · {subLine}
            </div>
            {profile.bio && <p className="text-sm mt-2">{profile.bio}</p>}
          </div>
        </div>
      </div>

      {editingProfile && (
        <ProfileQuickEditModal
          userId={profile.id}
          initialNickname={profile.nickname ?? ""}
          initialBio={profile.bio ?? ""}
          initialProfileImage={profile.profile_image}
          onClose={() => {
            setEditingProfile(false);
            loadProfile();
          }}
        />
      )}

      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="text-xs font-bold tracking-widest text-gold uppercase mb-1">BADGES</div>
        <h3 className="mb-3">획득한 뱃지</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {visibleBadges.map((b) => {
            const viewerUnlocked = isSuperadmin || viewerEarnedIds.has(b.id);
            // 시크릿(뷰어가 아직 못 찾은 히든 뱃지) — 이 프로필 주인이 획득했다는 사실은
            // 보이되 실루엣 처리하고 이름/설명은 가린다(호버 시 관리자가 입력한 힌트만
            // 짧게 보여준다). 슈퍼시크릿은 실루엣조차 안 보이게 연기 속에 잠긴 것처럼
            // 완전히 가리고, 힌트도 절대 노출하지 않는다(호버 툴팁 자체를 렌더링하지 않음) —
            // 이게 시크릿과 슈퍼시크릿을 가르는 핵심 차이다.
            const secretLocked = b.secret_tier === "secret" && !viewerUnlocked;
            const superSecretLocked = b.secret_tier === "super_secret" && !viewerUnlocked;
            return (
              <div key={b.id} className="relative group flex flex-col items-center gap-1 text-center">
                {superSecretLocked ? (
                  <div
                    className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-[#0f0f12] shadow-[0_0_14px_6px_rgba(0,0,0,0.55)]"
                    aria-hidden
                  >
                    <span
                      className="absolute -inset-2 animate-badge-smoke rounded-full blur-[5px]"
                      style={{ background: "radial-gradient(circle at 35% 40%, rgba(210,210,220,0.6), transparent 60%)" }}
                    />
                    <span
                      className="absolute -inset-2 animate-badge-smoke-2 rounded-full blur-[5px]"
                      style={{ background: "radial-gradient(circle at 65% 65%, rgba(160,160,175,0.55), transparent 55%)" }}
                    />
                    <span className="relative z-10 text-white text-[10px] font-bold">?</span>
                  </div>
                ) : (
                  <div className={`text-3xl cursor-default ${secretLocked ? "brightness-0" : ""}`}>{b.icon}</div>
                )}
                <div className="text-[11px] text-muted leading-tight">{secretLocked || superSecretLocked ? "???" : b.label}</div>
                {!superSecretLocked && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 rounded-lg bg-navy text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg">
                    {secretLocked ? (
                      <div className="font-bold">{b.hint_text || "???? (히든 뱃지)"}</div>
                    ) : (
                      <>
                        <div className="font-bold mb-0.5">{b.label}</div>
                        {b.description && <div className="text-[#C9D2E3]">{b.description}</div>}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {visibleBadges.length === 0 && (
            <div className="text-muted text-sm col-span-full text-center py-4">아직 획득한 뱃지가 없습니다.</div>
          )}
        </div>
      </div>

      {canModerate && (
        <div className="bg-surface border border-border rounded-2xl p-5 mt-4">
          <div className="text-xs font-bold tracking-widest text-red uppercase mb-1">ADMIN</div>
          <h3 className="mb-3">관리자 조치</h3>
          <ModerationPanel targetUserId={profile.id} />
        </div>
      )}
    </div>
  );
}
