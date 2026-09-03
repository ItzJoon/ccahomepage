"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { useHomeTheme } from "@/hooks/useHomeTheme";

const FONT_SIZES = [
  { label: "기본", value: "" },
  { label: "작게", value: "13px" },
  { label: "크게", value: "20px" },
  { label: "아주 크게", value: "26px" },
];

/**
 * 공지사항 본문 전용 리치 텍스트 에디터. 굵게/기울임/글씨 크기만 지원한다 —
 * StarterKit의 나머지 기능(제목, 목록, 인용, 코드블록 등)은 요구 범위 밖이라 꺼둔다.
 * 링크는 버튼 없이 자동 감지(autolink)만 켜서, 기존 게시판 등에 있던 "본문 URL
 * 자동 하이퍼링크" 기능을 그대로 잇는다(그쪽은 렌더링 시점에 텍스트를 훑어 링크로
 * 바꾸지만, 여기는 HTML을 저장하므로 입력 시점에 실제 <a> 태그로 저장해둔다).
 */
export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const { t } = useHomeTheme();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: {
          autolink: true,
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TextStyle,
      FontSize,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "text-sm leading-6 focus:outline-none min-h-[140px] px-3 py-2" },
    },
  });

  // 다른 글을 선택해서 form.content가 통째로 바뀌면(예: 목록에서 다른 공지를 클릭)
  // 에디터 내용도 같이 갱신한다 — 매 타이핑마다(onUpdate) 여기로 다시 돌아오는 걸
  // 막기 위해, 지금 에디터가 들고 있는 HTML과 다를 때만 setContent한다.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `text-xs font-bold rounded-lg px-2.5 py-1 border ${active ? t.adminToggleActive : t.adminToggleIdle}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-border bg-bg px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
        >
          굵게
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
        >
          기울임
        </button>
        <select
          className="text-xs font-bold rounded-lg px-2 py-1 border border-border bg-white"
          value={(editor.getAttributes("textStyle").fontSize as string | undefined) ?? ""}
          onChange={(e) => {
            const size = e.target.value;
            if (size) editor.chain().focus().setFontSize(size).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
        >
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
