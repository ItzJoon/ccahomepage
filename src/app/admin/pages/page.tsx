"use client";

import AdminTable, { truncateCellProps } from "@/components/admin/AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { PageDoc } from "@/lib/types";

const empty = { title: "", content: "", menu_visible: true };

function slugify(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-\uac00-\ud7a3]/g, "");
}

export default function AdminPagesPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<PageDoc>("pages", { orderBy: { column: "order_index" } });
  const { t } = useHomeTheme();
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
          <AdminTable>
            <thead>
              <tr>
                <th className={t.adminTableHeaderCell}>페이지 제목</th>
                <th className={`${t.adminTableHeaderCell} w-24`}>메뉴 노출</th>
                <th className={`${t.adminTableHeaderCell} w-16`} />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className={t.adminTableCell}>
                    <div className="flex items-center gap-1.5">
                      <span {...truncateCellProps(p.title)}>{p.title}</span>
                      <span className="text-muted text-xs shrink-0">/pages/{p.slug}</span>
                    </div>
                  </td>
                  <td className={t.adminTableCell}>
                    <input type="checkbox" checked={p.menu_visible} onChange={() => toggleMenu(p)} />
                  </td>
                  <td className={t.adminTableCell}>
                    <button className={t.adminBtnDanger} onClick={() => remove(p.id)}>삭제</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">추가된 페이지가 없습니다.</td></tr>}
            </tbody>
          </AdminTable>
        </div>
        <div className={`${t.adminEditPanel} flex flex-col gap-1.5`}>
          <h3>새 페이지 추가</h3>
          <label className="text-xs font-bold text-muted mt-2">메뉴에 표시될 제목</label>
          <input className={t.adminInput} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 동아리 소개" />
          <label className="text-xs font-bold text-muted mt-2">페이지 내용</label>
          <textarea rows={6} className={t.adminInput} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <button onClick={add} className={`${t.adminBtnPrimary} mt-3.5 self-start`}>페이지 만들기</button>
        </div>
      </div>
    </div>
  );
}
