"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import AdminTable, { truncateCellProps, actionCellClass } from "@/components/admin/AdminTable";
import type { PatchNote, PatchNoteItem, PatchNoteCategory } from "@/lib/types";

interface Row extends PatchNote {
  patch_note_items: PatchNoteItem[];
}

const CATEGORY_LABEL: Record<PatchNoteCategory, string> = {
  feature: "신규 기능",
  improvement: "개선",
  fix: "버그 수정",
};

interface ItemForm {
  categories: PatchNoteCategory[];
  content: string;
}

const emptyForm = () => ({
  version: "",
  title: "",
  published_at: new Date().toISOString().slice(0, 10),
  items: [{ categories: ["feature"] as PatchNoteCategory[], content: "" }] as ItemForm[],
});

/**
 * developer(superadmin) 전용 패치노트 관리 화면. "게시하기"를 누르는 순간 is_published가
 * true로 바뀌고, DB 트리거(notify_patch_note_published, supabase/schema.sql 96번)가
 * 전체 사용자에게 헤더 알림(🔔)을 자동으로 만들어주고, PatchNotePopup 컴포넌트가
 * 로그인한 모든 사용자 화면에 자동으로 전체 내용 모달을 띄운다 — 여기서 따로 처리할
 * 필요 없음(체크박스로 선택하는 게 아니라 게시하면 항상 뜬다).
 */
export default function AdminPatchNotesPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<Row>("patch_notes", {
    select: "*, patch_note_items(*)",
    orderBy: { column: "published_at", ascending: false },
  });
  const { myId, isSuperadmin } = useMyRole();
  const { t } = useHomeTheme();

  const [openId, setOpenId] = useState<string | null | "new">(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startNew = () => {
    setForm(emptyForm());
    setOpenId("new");
  };

  const startEdit = (n: Row) => {
    setForm({
      version: n.version ?? "",
      title: n.title,
      published_at: n.published_at.slice(0, 10),
      items: n.patch_note_items
        .sort((a, b) => a.order_index - b.order_index)
        .map((i) => ({ categories: i.categories, content: i.content })),
    });
    setOpenId(n.id);
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { categories: ["feature"], content: "" }] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, patch: Partial<ItemForm>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const toggleItemCategory = (idx: number, category: PatchNoteCategory, checked: boolean) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === idx
          ? { ...it, categories: checked ? [...it.categories, category] : it.categories.filter((c) => c !== category) }
          : it
      ),
    }));

  // 항목(items)은 patch_note_items에 별도 저장돼 있고 다른 테이블에서 참조하지 않으므로,
  // 수정할 때마다 통째로 지우고 폼 내용으로 다시 채우는 방식이 항목별 추가/삭제/순서
  // 변경을 각각 추적하는 것보다 훨씬 단순하다.
  const saveItems = async (patchNoteId: string) => {
    await supabase.from("patch_note_items").delete().eq("patch_note_id", patchNoteId);
    const validItems = form.items.filter((i) => i.content.trim() && i.categories.length > 0);
    if (validItems.length === 0) return;
    await supabase.from("patch_note_items").insert(
      validItems.map((i, idx) => ({ patch_note_id: patchNoteId, categories: i.categories, content: i.content.trim(), order_index: idx }))
    );
  };

  const validate = () => {
    if (!form.title.trim()) return "제목을 입력해 주세요.";
    if (!form.published_at) return "게시일을 입력해 주세요.";
    if (form.items.every((i) => !i.content.trim())) return "최소 한 개의 항목 내용을 입력해 주세요.";
    if (form.items.some((i) => i.content.trim() && i.categories.length === 0))
      return "내용이 있는 항목은 카테고리를 최소 하나 선택해 주세요.";
    return null;
  };

  // 임시저장(draft) — is_published는 건드리지 않는다(새 글이면 false로 시작, 이미
  // 게시된 글이면 게시 상태 그대로 유지한 채 내용만 고친다).
  const saveDraft = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSaving(true);
    if (openId === "new") {
      const { data, error } = await supabase
        .from("patch_notes")
        .insert({ version: form.version || null, title: form.title, published_at: form.published_at, author_id: myId, is_published: false })
        .select("id")
        .single();
      if (!error && data) await saveItems(data.id);
    } else if (openId) {
      await supabase
        .from("patch_notes")
        .update({ version: form.version || null, title: form.title, published_at: form.published_at })
        .eq("id", openId);
      await saveItems(openId);
    }
    setSaving(false);
    setOpenId(null);
    reload();
  };

  // 게시하기 — is_published를 true로 바꾼다. 헤더 알림(전체 사용자)과 화면 가운데
  // 자동 팝업 둘 다 DB 트리거/PatchNotePopup 컴포넌트가 알아서 처리하므로 여기서는
  // is_published만 바꾸면 된다.
  const publish = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSaving(true);
    let noteId = typeof openId === "string" && openId !== "new" ? openId : null;
    if (openId === "new") {
      const { data, error } = await supabase
        .from("patch_notes")
        .insert({ version: form.version || null, title: form.title, published_at: form.published_at, author_id: myId, is_published: true })
        .select("id")
        .single();
      if (!error && data) {
        noteId = data.id;
        await saveItems(data.id);
      }
    } else if (noteId) {
      await supabase
        .from("patch_notes")
        .update({ version: form.version || null, title: form.title, published_at: form.published_at, is_published: true })
        .eq("id", noteId);
      await saveItems(noteId);
    }
    setSaving(false);
    setOpenId(null);
    reload();
  };

  const togglePublished = async (n: Row) => {
    await supabase.from("patch_notes").update({ is_published: !n.is_published }).eq("id", n.id);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 패치노트를 삭제하시겠습니까?")) return;
    await supabase.from("patch_notes").delete().eq("id", id);
    reload();
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR");

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${openId ? "lg:grid-cols-[1fr_420px]" : ""}`}>
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[22px] m-0">패치노트 관리</h2>
          <button onClick={startNew} className={t.adminBtnPrimary}>+ 새 패치노트</button>
        </div>
        <AdminTable>
          <thead>
            <tr>
              <th className={t.adminTableHeaderCell}>버전 · 제목</th>
              <th className={`${t.adminTableHeaderCell} w-28`}>게시일</th>
              <th className={`${t.adminTableHeaderCell} w-20`}>노출</th>
              <th className={`${t.adminTableHeaderCell} w-24`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} onClick={() => startEdit(n)} className={`cursor-pointer ${t.adminTableRowHover}`}>
                <td className={t.adminTableCell}>
                  <span {...truncateCellProps(`${n.version ? `${n.version} · ` : ""}${n.title}`)}>{n.version ? `${n.version} · ` : ""}{n.title}</span>
                </td>
                <td className={`${t.adminTableCell} text-muted`}>{fmt(n.published_at)}</td>
                <td className={t.adminTableCell} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={n.is_published} onChange={() => togglePublished(n)} />
                </td>
                <td className={t.adminTableCell} onClick={(e) => e.stopPropagation()}>
                  <div className={actionCellClass}>
                    <button onClick={() => remove(n.id)} className={t.adminBtnDanger}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="text-muted text-center py-8 text-sm">등록된 패치노트가 없습니다.</td></tr>
            )}
          </tbody>
        </AdminTable>
      </div>

      {openId && (
        <div className={`${t.adminEditPanel} flex flex-col gap-1.5 sticky top-20`}>
          <div className="flex items-center justify-between">
            <h3 className="m-0">{openId === "new" ? "새 패치노트" : "패치노트 수정"}</h3>
            <button type="button" onClick={() => setOpenId(null)} className="text-muted text-xl leading-none">✕</button>
          </div>
          <label className="text-xs font-bold text-muted mt-2">버전 (선택)</label>
          <input className={t.adminInput} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="예: v1.2.0" />
          <label className="text-xs font-bold text-muted mt-2">제목</label>
          <input className={t.adminInput} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">게시일</label>
          <input type="date" className={t.adminInput} value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} />

          <label className="text-xs font-bold text-muted mt-2">항목 (카테고리는 중첩 선택 가능)</label>
          <div className="flex flex-col gap-3">
            {form.items.map((item, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  {(Object.keys(CATEGORY_LABEL) as PatchNoteCategory[]).map((c) => (
                    <label key={c} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={item.categories.includes(c)}
                        onChange={(e) => toggleItemCategory(idx, c, e.target.checked)}
                      />
                      {CATEGORY_LABEL[c]}
                    </label>
                  ))}
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red text-xs font-bold ml-auto">삭제</button>
                  )}
                </div>
                <textarea
                  rows={2}
                  className={t.adminInput}
                  value={item.content}
                  onChange={(e) => updateItem(idx, { content: e.target.value })}
                  placeholder="변경 내용"
                />
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="text-blue text-xs font-bold w-fit mt-1">+ 항목 추가</button>

          <p className="text-muted text-xs mt-3">
            게시하면 헤더 알림(🔔)이 쌓이는 것과 동시에, 로그인한 모든 사용자 화면에
            자동으로 전체 내용이 담긴 팝업이 뜹니다(한 번 닫으면 그 사용자에게는
            다시 뜨지 않습니다).
          </p>

          {error && <div className="text-red text-xs">{error}</div>}
          <div className="flex gap-2 mt-3.5 flex-wrap">
            <button disabled={saving || !isSuperadmin} onClick={saveDraft} className={`${t.adminBtnSecondary} disabled:opacity-40`}>
              임시저장
            </button>
            <button disabled={saving || !isSuperadmin} onClick={publish} className={`${t.adminBtnPrimary} disabled:opacity-40`}>
              게시하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
