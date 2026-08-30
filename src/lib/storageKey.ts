// Supabase Storage 오브젝트 키에 한글/공백/특수문자가 섞이면 업로드 시 "Invalid key"
// 오류가 난다. 원본 파일명을 그대로 키에 쓰지 않고, 확장자만 뽑아서 영문/숫자/하이픈으로만
// 이뤄진 안전한 키를 만든다. 화면에 보여줘야 하는 원본 파일명은 호출하는 쪽에서 별도
// 컬럼(예: attachments.file_name)에 그대로 저장한다.
export function safeStorageKey(originalFileName: string, prefix?: string): string {
  const dotIndex = originalFileName.lastIndexOf(".");
  const rawExt = dotIndex >= 0 ? originalFileName.slice(dotIndex + 1) : "";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "");
  // 같은 밀리초에 여러 파일이 한꺼번에 올라가도(여러 첨부파일 동시 선택 등) 키가 겹치지
  // 않도록 짧은 랜덤 문자열을 덧붙인다.
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const base = prefix ? `${prefix}-${unique}` : unique;
  return ext ? `${base}.${ext}` : base;
}
