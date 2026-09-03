"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { useHomeTheme } from "@/hooks/useHomeTheme";

const DEFAULT_FONT_SIZE = 14;
const FONT_SIZE_STEP = 2;
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 32;

function currentFontSizePx(editor: Editor): number {
  const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE;
}

function stepFontSize(editor: Editor, delta: number) {
  const next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, currentFontSizePx(editor) + delta));
  editor.chain().focus().setFontSize(`${next}px`).run();
}

// 구글 문서와 같은 단축키(Mac: Cmd+Shift+ , / . , Windows/Linux: Ctrl+Shift+ , / .) 로
// 글씨 크기를 한 단계씩 줄이고 늘린다 — "Mod"가 플랫폼에 맞게 Cmd/Ctrl로 자동 치환된다.
const FontSizeShortcuts = Extension.create({
  name: "fontSizeShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-.": () => {
        stepFontSize(this.editor, FONT_SIZE_STEP);
        return true;
      },
      "Mod-Shift-,": () => {
        stepFontSize(this.editor, -FONT_SIZE_STEP);
        return true;
      },
    };
  },
});

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
      FontSizeShortcuts,
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
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            title="글씨 작게 (Cmd/Ctrl+Shift+,)"
            onClick={() => stepFontSize(editor, -FONT_SIZE_STEP)}
            className={btnClass(false)}
          >
            가-
          </button>
          <span className="text-xs text-muted w-9 text-center tabular-nums">{currentFontSizePx(editor)}px</span>
          <button
            type="button"
            title="글씨 크게 (Cmd/Ctrl+Shift+.)"
            onClick={() => stepFontSize(editor, FONT_SIZE_STEP)}
            className={btnClass(false)}
          >
            가+
          </button>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
