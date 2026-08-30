import type { OrgEvent, OrgRecord, Proposal } from "@/lib/types";

export const STATUS_LABEL: Record<Proposal["status"], string> = {
  review: "검토 중",
  approved: "승인",
  rejected: "반려",
  completed: "완료",
};
export const STATUS_CLASS: Record<Proposal["status"], string> = {
  review: "bg-[#FFF3DC] text-gold",
  approved: "bg-[#E4F5EE] text-teal",
  rejected: "bg-[#FDEBEC] text-red",
  completed: "bg-[#EAF0FB] text-blue",
};

export const EVENT_CATEGORY_LABEL: Record<OrgEvent["category"], string> = {
  meeting: "회의",
  event: "행사",
  deadline: "마감",
  general: "일반",
};

export const RECORD_CATEGORY_LABEL: Record<OrgRecord["category"], string> = {
  notice: "공지",
  activity: "활동",
  minutes: "회의록",
};
export const RECORD_CATEGORY_COLOR: Record<OrgRecord["category"], "navy" | "teal" | "gold"> = {
  notice: "navy",
  activity: "teal",
  minutes: "gold",
};

export function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${fmt(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
