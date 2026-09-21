"use client";

import { useState } from "react";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { accountDisplayName } from "./AccountPicker";
import type { DirectoryMember, Profile } from "@/lib/types";

export type AuthorSelection =
  | { type: "profile"; profile: Profile }
  | { type: "manual"; email: string; displayName: string };

/**
 * 공지사항/뉴스 "작성자 변경"에서 쓰는 검색 위젯. AccountPicker(profiles만 검색)와 달리
 * 학교 명단(directory_members)에는 있지만 아직 한 번도 로그인 안 해서 profiles 행이
 * 없는 사람도 함께 검색되어 선택할 수 있다 — 글쓴이로 귀속시키는 건 그 사람이 실제로
 * 로그인할 수 있어야 하는 기능이 아니라 단순 표시(기록)이기 때문이다.
 *
 * (뱃지 직접 부여나 "계정 연결" 같은 다른 화면의 AccountPicker는 그대로 둔다 — 그
 * 기능들은 실제로 로그인 가능한 계정이 있어야 의미가 있어서, 여기와는 성격이 다르다.)
 *
 * 명단에는 있지만 이미 로그인해서 profiles 행도 있는 사람은 profiles 쪽 결과로만
 * 한 번 보여준다(중복 방지) — 호출부가 directoryMembers를 넘길 때 이미 그렇게
 * 걸러서 넘겨준다.
 */
export default function AuthorPicker({
  profiles,
  directoryMembers,
  linked,
  onLink,
  onUnlink,
}: {
  profiles: Profile[];
  directoryMembers: DirectoryMember[];
  linked: AuthorSelection | null;
  onLink: (sel: AuthorSelection) => void;
  onUnlink: () => void;
}) {
  const [query, setQuery] = useState("");
  const { t } = useHomeTheme();

  if (linked) {
    const name = linked.type === "profile" ? accountDisplayName(linked.profile) : linked.displayName;
    return (
      <div className="flex items-center gap-2 border border-border rounded-lg px-2.5 py-2">
        <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
          {name[0]}
        </div>
        <div className="flex-1 min-w-0 text-sm truncate">
          {name}
          {linked.type === "manual" && <span className="ml-1.5 text-[10px] font-bold text-gold border border-gold rounded px-1">미가입</span>}
        </div>
        <button type="button" onClick={onUnlink} className={`${t.adminBtnDanger} shrink-0`}>연결 해제</button>
      </div>
    );
  }

  const q = query.trim();
  const profileMatches = q
    ? profiles
        .filter((p) => (p.nickname || "").includes(q) || (p.name || "").includes(q) || p.email.includes(q))
        .slice(0, 8)
    : [];
  const directoryMatches = q
    ? directoryMembers
        .filter((m) => m.display_name.includes(q) || m.email.includes(q))
        .slice(0, 8)
    : [];

  return (
    <div className="relative">
      <input
        className={`${t.adminInput} w-full`}
        placeholder="이름 또는 이메일로 검색 (아직 가입 안 한 명단 구성원도 검색됩니다)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {(profileMatches.length > 0 || directoryMatches.length > 0) && (
        <div className="absolute left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
          {profileMatches.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onLink({ type: "profile", profile: p });
                setQuery("");
              }}
              className={`flex items-center gap-2 w-full text-left px-2.5 py-2 text-sm ${t.adminTableRowHover}`}
            >
              {p.profile_image ? (
                <img src={p.profile_image} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {accountDisplayName(p)[0]}
                </div>
              )}
              <span className="truncate">{accountDisplayName(p)}</span>
            </button>
          ))}
          {directoryMatches.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => {
                onLink({ type: "manual", email: m.email, displayName: m.display_name });
                setQuery("");
              }}
              className={`flex items-center gap-2 w-full text-left px-2.5 py-2 text-sm ${t.adminTableRowHover}`}
            >
              <div className="w-6 h-6 rounded-full bg-muted text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {m.display_name[0]}
              </div>
              <span className="truncate">{m.display_name}</span>
              <span className="text-[10px] font-bold text-gold border border-gold rounded px-1 shrink-0">미가입</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
