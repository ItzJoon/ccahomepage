"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import ProfileQuickEditModal from "@/components/ProfileQuickEditModal";
import type { HomeThemeKey } from "@/lib/homeTheme";
import type { Profile } from "@/lib/types";

export default function AdminHeader({ profile, initialThemeKey }: { profile: Profile; initialThemeKey?: HomeThemeKey }) {
  const { t } = useHomeTheme(initialThemeKey);
  const router = useRouter();
  const supabase = createClient();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // developer(=superadmin, 화면 표시명만 바뀜 — 권한은 그대로) 전용 미리보기.
  // 실제 role은 그대로 superadmin으로 유지한 채(로그아웃/재로그인 없이) 사이트 헤더가
  // student 권한으로 보이는 것처럼 렌더링하는 쿠키만 심는다 — (site)/layout.tsx가 이
  // 쿠키를 읽어 Header에 내려줄 profile을 표시용으로만 바꿔치기한다. developer는 사이트
  // 잠금 모드 예외 대상이라(middleware.ts) 잠금 중에도 그대로 접속되므로, 이 미리보기도
  // 잠금과 무관하게 항상 동작한다.
  const startStudentPreview = () => {
    document.cookie = "preview_as_student=1; path=/; max-age=86400";
    router.push("/");
  };

  // 드롭다운 바깥을 클릭하면 닫히게 한다(메인 화면 헤더의 프로필 메뉴와 동일한 동작).
  useEffect(() => {
    if (!profileMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [profileMenuOpen]);

  // 관리자 목록 화면에서 다른 사람 이름은 "닉네임(실명)"으로 보여주지만, 본인 이름을 본인이
  // 보는 이 헤더 드롭다운에서까지 실명을 괄호로 덧붙일 필요는 없어서 여기만 닉네임만 쓴다.
  const displayName = profile.nickname || profile.name || profile.email;
  // is_council만 있고 관리자 role이 없는 계정(예: role=student)은 /admin(대시보드)에는
  // 못 들어가고 /admin/org-activities/*만 볼 수 있다 — 로고를 눌렀을 때 막힌 곳으로
  // 보내 튕겨나가지 않도록, 이 계정에게는 로고도 그리로 연결한다.
  const hasAdminRole = ["editor", "admin", "superadmin", "designer"].includes(profile.role);
  const homeHref = hasAdminRole ? "/admin" : "/admin/org-activities";

  return (
    <>
      <header className={`sticky top-0 z-20 ${t.headerBg} ${t.headerText} ${t.headerBorder}`}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3 px-5 py-3 flex-wrap">
          <Link href={homeHref} className={`font-bold text-lg flex items-center gap-2 shrink-0 ${t.logoFont}`}>
            <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" />
            <span className="whitespace-nowrap">{hasAdminRole ? "학생자치회 관리자" : "학생자치회 임원회"}</span>
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/" className={`text-sm px-3 py-1.5 shrink-0 whitespace-nowrap ${t.authBtn}`}>
              홈페이지로 돌아가기
            </Link>
            {profile.role === "superadmin" && (
              <button
                onClick={startStudentPreview}
                className={`text-sm px-3 py-1.5 shrink-0 whitespace-nowrap ${t.authBtn}`}
              >
                학생 화면 보기
              </button>
            )}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((v) => !v)}
                className={`text-sm font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap ${t.profileTrigger}`}
              >
                {displayName} ▾
              </button>
              {profileMenuOpen && (
                <div className={`absolute right-0 top-full mt-2 w-48 py-1.5 z-30 ${t.profileDropdown}`}>
                  <Link
                    href="/mypage"
                    onClick={() => setProfileMenuOpen(false)}
                    className={`block px-4 py-2 text-sm ${t.profileDropdownItem}`}
                  >
                    마이페이지
                  </Link>
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setQuickEditOpen(true);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm ${t.profileDropdownItem}`}
                  >
                    닉네임 · 소개 수정
                  </button>
                  <button
                    onClick={signOut}
                    className={`block w-full text-left px-4 py-2 text-sm ${t.profileDropdownDanger}`}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {quickEditOpen && (
        <ProfileQuickEditModal
          userId={profile.id}
          initialNickname={profile.nickname || ""}
          initialBio={profile.bio || ""}
          initialProfileImage={profile.profile_image}
          onClose={() => setQuickEditOpen(false)}
        />
      )}
    </>
  );
}
