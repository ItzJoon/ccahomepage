import type { PatchNoteCategory } from "@/lib/types";

// 화면에 보여줄 때는 항상 신규 기능 > 개선 > 버그 수정 순으로 묶는다. 한 항목이 여러
// 카테고리에 중첩 선택된 경우, 그중 가장 우선순위 높은 카테고리를 기준으로 정렬한다.
const CATEGORY_PRIORITY: Record<PatchNoteCategory, number> = { feature: 0, improvement: 1, fix: 2 };

function categoryRank(categories: PatchNoteCategory[]): number {
  return Math.min(...categories.map((c) => CATEGORY_PRIORITY[c]));
}

/**
 * 저장된 순서(order_index)는 관리자가 입력한 순서 그대로 유지한다 — 이 함수는 화면에
 * 보여줄 때만(학생용 목록/상세, 팝업) 카테고리 우선순위 순으로 다시 정렬한다. 같은
 * 우선순위 안에서는 Array.sort의 안정 정렬 특성 덕분에 인자로 받은 원래 순서(보통
 * order_index 기준으로 미리 정렬된 배열)가 그대로 유지된다.
 */
export function sortPatchNoteItemsForDisplay<T extends { categories: PatchNoteCategory[] }>(items: T[]): T[] {
  return [...items].sort((a, b) => categoryRank(a.categories) - categoryRank(b.categories));
}

export function sortCategoriesForDisplay(categories: PatchNoteCategory[]): PatchNoteCategory[] {
  return [...categories].sort((a, b) => CATEGORY_PRIORITY[a] - CATEGORY_PRIORITY[b]);
}

/**
 * 직전에 "게시된" 패치노트의 버전을 기준으로 다음 버전을 제안한다. 신규 기능이 하나라도
 * 있으면 마이너를 올리고 패치는 0으로 리셋(v1.0.5 -> v1.1.0), 없으면(개선/버그 수정만)
 * 패치만 올린다(v1.0.5 -> v1.0.6). 메이저는 여기서 절대 자동으로 올리지 않는다 —
 * 그건 항상 관리자가 직접 정하는 값이다. 기존 버전 문자열의 "v" 접두사나 형식이
 * 조금 달라도(예: "1.0.5") 숫자 3개만 뽑아서 계산하므로 안전하다.
 */
export function computeNextPatchNoteVersion(latestVersion: string | null, hasFeature: boolean): string {
  const match = (latestVersion ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  const major = match ? Number(match[1]) : 1;
  const minor = match ? Number(match[2]) : 0;
  const patch = match ? Number(match[3]) : 0;
  return hasFeature ? `v${major}.${minor + 1}.0` : `v${major}.${minor}.${patch + 1}`;
}
