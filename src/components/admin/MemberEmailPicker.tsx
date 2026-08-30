"use client";

import { useState } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { DirectoryMember } from "@/lib/types";

/**
 * 이메일 발송 대상을 "직접 입력"할 때 쓰는 위젯. 이메일 주소를 손으로 치는 대신,
 * 구성원 관리에서 계정을 연결할 때 쓰는 AccountPicker와 같은 방식으로 이름을 검색해서
 * 고르면 실제 이메일이 함께 붙어서 선택된다(오타로 잘못된 주소에 보내는 사고 방지).
 * directory_members(학교 명단)를 검색 대상으로 쓴다 — 로그인 여부와 무관하게 이름/이메일이
 * 있는 전체 학생·교사가 대상이라 이 화면(대상 직접 지정)과 가장 잘 맞는다.
 */
export default function MemberEmailPicker({
  selected,
  onChange,
}: {
  selected: DirectoryMember[];
  onChange: (members: DirectoryMember[]) => void;
}) {
  const { rows } = useRealtimeList<DirectoryMember>("directory_members");
  const [query, setQuery] = useState("");

  const selectedEmails = new Set(selected.map((m) => m.email));
  const filtered = query.trim()
    ? rows.filter((m) => !selectedEmails.has(m.email) && (m.display_name.includes(query) || m.email.includes(query))).slice(0, 8)
    : [];

  const add = (m: DirectoryMember) => {
    onChange([...selected, m]);
    setQuery("");
  };
  const remove = (email: string) => onChange(selected.filter((m) => m.email !== email));

  return (
    <div className="flex flex-col gap-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((m) => (
            <span key={m.email} className="bg-[#F2F4F8] rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5">
              {m.display_name} <span className="text-muted">({m.email})</span>
              <button type="button" onClick={() => remove(m.email)} className="text-muted">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          className="border border-border rounded-lg px-2.5 py-2 text-xs w-full"
          placeholder="이름 또는 이메일로 검색해서 추가"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-10 max-h-52 overflow-auto">
            {filtered.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => add(m)}
                className="flex flex-col w-full text-left px-2.5 py-1.5 text-xs hover:bg-[#F2F4F8]"
              >
                <span className="font-bold">{m.display_name}</span>
                <span className="text-muted">{m.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
