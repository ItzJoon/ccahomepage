import PdfInlineViewer from "@/components/PdfInlineViewer";

interface AttachmentItem {
  id: string;
  file_url: string;
  file_name: string;
}

function isPdf(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf");
}

/**
 * 공지/뉴스/일정/규정 등 여러 화면에서 각자 복붙돼 있던 "첨부파일" 블록을 하나로 모은
 * 공용 컴포넌트. PDF는 클릭 없이 바로 펼쳐서 보여주고(PdfInlineViewer), 그 외 형식은
 * 기존처럼 클릭해서 다운로드하는 링크로 그대로 둔다. 서버 컴포넌트에서 그대로
 * <AttachmentList .../>로 자식 렌더링하면 되고 이 파일 자체는 "use client"가 아니다
 * (PdfInlineViewer만 브라우저 전용이라 그쪽에서 처리).
 */
export default function AttachmentList({ attachments }: { attachments: AttachmentItem[] }) {
  if (!attachments || attachments.length === 0) return null;
  const pdfs = attachments.filter((a) => isPdf(a.file_name));
  const others = attachments.filter((a) => !isPdf(a.file_name));

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
