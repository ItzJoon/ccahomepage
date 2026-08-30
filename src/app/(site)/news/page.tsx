"use client";

import Link from "next/link";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import type { Post } from "@/lib/types";

interface Row extends Post {
  author_name: string | null;
}

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function NewsPage() {
  // author_name은 profiles를 그대로 조인하면 다른 사람 이름이 RLS에 막혀 비어오므로,
  // 안전하게 이름만 반환하는 computed column을 대신 쓴다(supabase/schema.sql 51번 참고).
  const { rows } = useRealtimeList<Row>("posts", {
    select: "*, author_name",
    filter: (q) => q.eq("type", "news").eq("status", "published"),
    orderBy: { column: "created_at", ascending: false },
  });

  return (
    <div>
      <SectionTitle eyebrow="NEWS" title="학생자치회 뉴스" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rows.map((n) => (
          <Link href={`/news/${n.id}`} key={n.id} className="border border-border rounded-xl p-4 block bg-white hover:border-blue">
            <div className="text-teal font-bold text-xs mb-1.5">{n.category}</div>
            <div className="font-bold mb-2">{n.title}</div>
            <p className="text-sm text-muted line-clamp-3 m-0">{n.content}</p>
            <div className="mt-2.5 text-xs text-muted">{n.author_name || "-"} · {fmt(n.created_at)}</div>
          </Link>
        ))}
        {rows.length === 0 && <div className="text-muted text-center py-8 text-sm col-span-3">등록된 뉴스가 없습니다.</div>}
      </div>
    </div>
  );
}
