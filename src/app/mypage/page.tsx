"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAutoCheckIn } from "@/hooks/useAutoCheckIn";
import SectionTitle from "@/components/SectionTitle";
import BadgeCelebration from "@/components/BadgeCelebration";
import CheckInToast from "@/components/CheckInToast";
import type { Profile } from "@/lib/types";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function MyPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const { streak, history, checkedToday, freezeCredits, loading, badges, earnedIds, toast, celebrate, dismissCelebrate } =
    useAutoCheckIn(userId ?? null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) {
      setProfile(data as Profile);
      setNickname(data.nickname ?? "");
      setBio(data.bio ?? "");
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ nickname: nickname.trim() || null, bio: bio.trim() || null })
      .eq("id", userId);
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
    loadProfile();
  };

  const uploadPhoto = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    setPhotoError(null);
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file);
    if (uploadError) {
      setPhotoError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("profile-photos").getPublicUrl(path);
    await supabase.from("profiles").update({ profile_image: pub.publicUrl }).eq("id", userId);
    await loadProfile();
    setUploading(false);
  };

  if (userId === undefined) return null;
  if (userId === null) {
    return (
      <div className="text-center py-14">
        <p className="text-muted mb-3">로그인 후 마이페이지를 이용할 수 있습니다.</p>
        <Link href="/login" className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2.5">
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle eyebrow="MY PAGE" title="마이페이지" />

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 mb-4">
        <div className="bg-white border border-border rounded-2xl p-5 text-center flex flex-col items-center gap-2">
          <div className="font-serif font-black text-4xl">{loading ? "-" : streak}</div>
          <div className="text-muted text-sm">연속 접속일수</div>
          {freezeCredits > 0 && (
            <div className="text-xs text-blue">❄️ 스트릭 프리즈 {freezeCredits}개 보유</div>
          )}
          {checkedToday && <span className="text-teal font-bold text-sm">오늘 접속 완료 ✓</span>}
        </div>
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="text-xs font-bold tracking-widest text-blue uppercase mb-1">VISIT HISTORY</div>
          <h3>최근 방문 기록 (최근 30일)</h3>
          <ul className="list-none m-0 p-0">
            {history.slice(0, 10).map((d) => (
              <li key={d} className="border-b border-border py-2.5 text-sm">
                {fmt(d)}
              </li>
            ))}
            {history.length === 0 && <div className="text-muted text-center py-6 text-sm">방문 기록이 없습니다.</div>}
          </ul>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5 mb-4">
        <div className="text-xs font-bold tracking-widest text-gold uppercase mb-1">BADGES</div>
        <h3 className="mb-3">획득한 뱃지</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {badges.map((b) => {
            const earned = earnedIds.has(b.id);
            return (
              <div key={b.id} className="relative group flex flex-col items-center gap-1 text-center">
                <div className={`flex flex-col items-center gap-1 ${earned ? "" : "opacity-30 grayscale"}`}>
                  <div className="text-3xl cursor-default">{b.icon}</div>
                  <div className="text-[11px] text-muted leading-tight">{b.label}</div>
                </div>
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 rounded-lg bg-navy text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg">
                  <div className="font-bold mb-0.5">{b.label}</div>
                  {b.description && <div className="text-[#C9D2E3]">{b.description}</div>}
                  <div className="text-gold mt-1 font-bold">
                    {b.award_type === "auto" ? `연속 ${b.streak_threshold}일 달성` : "관리자 확인 후 지급"}
                    {earned ? " ✓" : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {badges.length === 0 && <div className="text-muted text-sm col-span-full text-center py-4">등록된 뱃지가 없습니다.</div>}
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="text-xs font-bold tracking-widest text-blue uppercase mb-1">PROFILE</div>
        <h3 className="mb-3">프로필 설정</h3>
        <div className="grid grid-cols-1 sm:grid-cols-[96px_1fr] gap-4 items-start">
          <div className="flex flex-col items-center gap-2">
            {profile?.profile_image ? (
              <img src={profile.profile_image} alt="프로필 사진" className="w-24 h-24 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-navy text-white flex items-center justify-center font-bold text-2xl">
                {(profile?.nickname || profile?.name || profile?.email || "?")[0]}
              </div>
            )}
            <label className="text-xs font-bold border border-border rounded-lg px-3 py-1.5 cursor-pointer bg-white text-center">
              {uploading ? "업로드 중…" : "사진 변경"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                  e.target.value = "";
                }}
              />
            </label>
            {photoError && <span className="text-red text-xs text-center">{photoError}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted">표시 이름 (닉네임)</label>
            <input
              className="border border-border rounded-lg px-2.5 py-2 text-sm"
              value={nickname}
              maxLength={20}
              placeholder={profile?.name || "닉네임을 입력하세요"}
              onChange={(e) => setNickname(e.target.value)}
            />
            <label className="text-xs font-bold text-muted mt-2">자기소개 한 줄</label>
            <input
              className="border border-border rounded-lg px-2.5 py-2 text-sm"
              value={bio}
              maxLength={60}
              placeholder="한 줄 소개를 입력하세요"
              onChange={(e) => setBio(e.target.value)}
            />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={saveProfile} disabled={saving} className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2">
                {saving ? "저장 중…" : "저장"}
              </button>
              {savedMsg && <span className="text-teal text-sm font-bold">저장되었습니다 ✓</span>}
            </div>
          </div>
        </div>
      </div>

      {toast !== null && <CheckInToast streak={toast} />}
      {celebrate && <BadgeCelebration badge={celebrate} onClose={dismissCelebrate} />}
    </div>
  );
}
