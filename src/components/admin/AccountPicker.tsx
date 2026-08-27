"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";

export const accountDisplayName = (p: Profile) => p.nickname || p.name || p.email;

/**
 * 로그인된 사용자를 이름/이메일로 검색해 연결하는 공용 위젯.
 * 구성원 관리(/admin/members), 조직 관리(/admin/organizations)의 구성원 추가 폼에서 공유해서 쓴다.
 */
export default function AccountPicker({
  profiles,
  linkedProfile,
  onLink,
  onUnlink,
}: {
  profiles: Profile[];
  linkedProfile: Profile | null;
  onLink: (p: Profile) => void;
  onUnlink: () => void;
}) {
  const [query, setQuery] = useState("");

  if (linkedProfile) {
    return (
      <div className="flex items-center gap-2 border border-border rounded-lg px-2.5 py-2">
        {linkedProfile.profile_image ? (
          <img src={linkedProfile.profile_image} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
            {accountDisplayName(linkedProfile)[0]}
          </div>
        )}
        <div className="flex-1 min-w-0 text-sm truncate">{accountDisplayName(linkedProfile)}</div>
        <button type="button" onClick={onUnlink} className="text-red text-xs font-bold shrink-0">연결 해제</button>
      </div>
    );
  }

  const filtered = query.trim()
    ? profiles
        .filter(
          (p) =>
            (p.nickname || "").includes(query) ||
            (p.name || "").includes(query) ||
            p.email.includes(query)
        )
        .slice(0, 8)
    : [];

  return (
    <div className="relative">
      <input
        className="border border-border rounded-lg px-2.5 py-2 text-sm w-full"
        placeholder="이름 또는 이메일로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-10 max-h-52 overflow-auto">
          {filtered.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onLink(p);
                setQuery("");
              }}
              className="flex items-center gap-2 w-full text-left px-2.5 py-2 text-sm hover:bg-[#F2F4F8]"
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
        </div>
      )}
    </div>
  );
}
