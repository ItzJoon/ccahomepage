"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { PageDoc } from "@/lib/types";

const empty = { title: "", content: "", menu_visible: true };

function slugify(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-\uac00-\ud7a3]/g, "");
}

export default function AdminPagesPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<PageDoc>("pages", { orderBy: { column: "order_index" } });
  const [form, setForm] = useState({ ...empty });

  const add = async () => {
    if (!form.title.trim()) return;
    await supabase.from("pages").insert({
      title: form.title,
      content: form.content,
      menu_visible: form.menu_visible,
      is_published: true,
      slug: slugify(form.title) || crypto.randomUUID().slice(0, 8),
      order_index: rows.length + 1,
    });
    setForm({ ...empty });
    reload();
  };

  const toggleMenu = async (p: PageDoc) => {
    await supabase.from("pages").update({ menu_visible: !p.menu_visible }).eq("id", p.id);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("pages").delete().eq("id", id);
    reload();
  };

  return (
    <div>
      <h2 className="text-[22px] mb-2">페이지 / 메뉴 빌더</h2>
      <p className="text-muted mb-4">
        코딩 없이 새 페이지를 만들고 학생용 사이트 상단 메뉴에 즉시 추가할 수 있습니다. (설문조사·투표 등 향후 기능도 같은 방식으로 확장됩니다.)
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
        <div className="min-w-0">
          <table className="w-full border-collapse bg-white">
            <thead>
              <tr>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2">페이지 제목</th>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">메뉴 노출</th>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="p-2.5 border-b border-border text-sm">{p.title} <span className="text-muted text-xs">/pages/{p.slug}</span></td>
                  <td className="p-2.5 border-b border-border">
                    <input type="checkbox" checked={p.menu_visible} onChange={() => toggleMenu(p)} />
                  </td>
                  <td className="p-2.5 border-b border-border">
                    <button className="text-red text-xs font-bold" onClick={() => remove(p.id)}>삭제</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">추가된 페이지가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5">
          <h3>새 페이지 추가</h3>
          <label className="text-xs font-bold text-muted mt-2">메뉴에 표시될 제목</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 동아리 소개" />
          <label className="text-xs font-bold text-muted mt-2">페이지 내용</label>
          <textarea rows={6} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <button onClick={add} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 mt-3.5 self-start">페이지 만들기</button>
        </div>
      </div>
    </div>
  );
}
