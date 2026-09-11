"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SectionTitle from "@/components/SectionTitle";
import AdminTable from "@/components/admin/AdminTable";
import type { RankingRow } from "@/lib/types";

const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };
const TOP_N = 50;

type Tab = "streak" | "badges";

function subLine(r: RankingRow) {
  if (r.member_type === "student") return `${r.grade}학년 ${r.homeroom ? HOMEROOM_LABEL[r.homeroom] : ""}`;
  return r.subject || "-";
}

export default function RankingsPage() {
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("streak");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setMyId(data.user?.id ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    if (!signedIn) return;
    setLoading(true);
    const rpc = tab === "streak" ? "get_streak_ranking" : "get_badge_count_ranking";
    supabase.rpc(rpc).then(({ data }) => {
      setRows((data as RankingRow[]) ?? []);
      setLoading(false);
    });
  }, [tab, signedIn, supabase]);

  if (signedIn === false) {
    return (
      <div>
        <SectionTitle eyebrow="RANKING" title="랭킹" />
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted text-sm">
          로그인한 학교 구성원만 열람할 수 있습니다.{" "}
          <Link href="/login" className="text-blue font-bold">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  const top = rows.slice(0, TOP_N);
  const mine = rows.find((r) => r.user_id === myId);
  const mineInTop = !!mine && top.some((r) => r.user_id === myId);
  const valueLabel = tab === "streak" ? "일" : "개";
  const valueHeader = tab === "streak" ? "최고 연속 접속" : "보유 뱃지 수";

  return (
    <div>
      <SectionTitle eyebrow="RANKING" title="랭킹" />
      <p className="text-muted mb-4 text-sm">
        역대 최고 연속 접속일수와 보유 뱃지 수 기준 순위입니다. 이름을 누르면 그 구성원의 프로필로 이동합니다.
      </p>

      <div className="flex border border-border rounded-lg overflow-hidden w-fit mb-4">
        <button
          type="button"
          onClick={() => setTab("streak")}
          className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "streak" ? "bg-navy text-white" : "bg-surface text-muted"}`}
        >
          연속 접속일수
        </button>
        <button
          type="button"
          onClick={() => setTab("badges")}
          className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "badges" ? "bg-navy text-white" : "bg-surface text-muted"}`}
        >
          뱃지 보유 수
        </button>
      </div>

      <AdminTable>
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16">순위</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-32">학년·반</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-32">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r) => {
            const isMe = r.user_id === myId;
            return (
              <tr key={r.user_id} className={isMe ? "bg-[#EAF0FB] dark:bg-white/10" : "hover:bg-[#F2F4F8] dark:hover:bg-white/10"}>
                <td className="p-2.5 border-b border-border font-bold">{r.rank}</td>
                <td className="p-2.5 border-b border-border">
                  <Link href={`/members/${r.user_id}`} className="font-semibold hover:text-blue">
                    {r.display_name}
                    {isMe && <span className="text-blue text-xs font-bold ml-1.5">(나)</span>}
                  </Link>
                </td>
                <td className="p-2.5 border-b border-border text-sm text-muted">{subLine(r)}</td>
                <td className="p-2.5 border-b border-border font-bold">
                  {r.value}
                  {valueLabel}
                </td>
              </tr>
            );
          })}
          {!loading && top.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted text-center py-8 text-sm">
                표시할 순위가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </AdminTable>

      {mine && !mineInTop && (
        <div className="mt-3 text-sm text-muted">
          내 순위: <span className="text-navy dark:text-white font-bold">{mine.rank}위</span> ({mine.value}
          {valueLabel})
        </div>
      )}
    </div>
  );
}
