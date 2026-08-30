// 게시판/Q&A/공지 등 글 작성 중 브라우저에 임시저장해서, 페이지를 벗어났다가
// 다시 들어와도 초안을 복원할 수 있게 하는 공용 유틸. 서버에는 저장하지 않는다
// (등록 완료 전까지는 아무에게도 안 보여야 하는 초안이라 로컬에만 둔다).
const PREFIX = "draft_";

export function saveDraft(key: string, data: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // 저장 공간이 꽉 찼거나 프라이빗 모드 등으로 실패해도 글쓰기 자체는 계속 가능해야 하므로 무시한다.
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // no-op
  }
}
