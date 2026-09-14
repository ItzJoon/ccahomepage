import PdfInlineViewer from "@/components/PdfInlineViewer";

interface AttachmentItem {
  id: string;
  file_url: string;
  file_name: string;
  display_mode?: "viewer" | "download" | null;
}

function isPdf(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf");
}

/**
 * 공지/뉴스/일정/규정 등 여러 화면에서 각자 복붙돼 있던 "첨부파일" 블록을 하나로 모은
 * 공용 컴포넌트. PDF는 기본적으로 클릭 없이 바로 펼쳐서 보여주지만(PdfInlineViewer),
 * 작성자가 "다운로드만"으로 지정했으면(display_mode='download') 뷰어를 아예 마운트하지
 * 않고 그 외 형식과 동일하게 파일명+다운로드 링크로만 보여준다(display_mode 컬럼이 없던
 * 기존 행은 기본값 'viewer'라 이전과 동일하게 동작). 서버 컴포넌트에서 그대로
 * <AttachmentList .../>로 자식 렌더링하면 되고 이 파일 자체는 "use client"가 아니다
 * (PdfInlineViewer만 브라우저 전용이라 그쪽에서 처리).
 */
export default function AttachmentList({ attachments }: { attachments: AttachmentItem[] }) {
  if (!attachments || attachments.length === 0) return null;
  const pdfs = attachments.filter((a) => isPdf(a.file_name) && a.display_mode !== "download");
  const others = attachments.filter((a) => !isPdf(a.file_name) || a.display_mode === "download");

  return (
    <div className="mt-5">
      {others.length > 0 && (
        <div className="p-3.5 bg-bg rounded-xl">
          <div className="font-bold text-xs mb-1.5">첨부파일</div>
          {others.map((a) => (
            <a key={a.id} href={a.file_url} className="block text-sm py-1 text-blue">
              📎 {a.file_name}
            </a>
          ))}
        </div>
      )}
      {pdfs.map((a) => (
        <PdfInlineViewer key={a.id} url={a.file_url} fileName={a.file_name} />
      ))}
    </div>
  );
}
