import type { Post, PostType } from "@/lib/types";

export interface PostWithAttachments extends Post {
  attachments: { id: string; file_url: string; file_name: string; file_path: string | null }[];
  author: { name: string | null; nickname: string | null; email: string } | null;
}

export interface TeacherInfo {
  subjects: string[];
  homeroom: number | null;
  homeroomLabel: string | null;
}

export const emptyForm = {
  title: "",
  category: "일반",
  content: "",
  is_pinned: false,
  status: "published" as "published" | "scheduled" | "draft",
  publish_at: new Date().toISOString().slice(0, 10),
  video_source: null as "drive" | "upload" | null,
  video_url: "" as string | null,
  video_path: null as string | null,
  type: "notice" as PostType,
  target_subject: null as string | null,
  target_homeroom: null as number | null,
};

export function kindLabel(post: Pick<Post, "type" | "target_subject" | "target_homeroom">) {
  if (post.type === "subject_notice") return `교과·${post.target_subject}`;
  if (post.type === "homeroom_notice") return `학급·${post.target_homeroom}반`;
  return null;
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Supabase 무료 플랜은 전체 Storage 용량이 1GB라, 동영상 하나가 너무 크면 금방 찬다.
// 강제로 막지는 않고 안내만 하되, 너무 큰 파일은 업로드 자체를 막는다.
export const MAX_VIDEO_MB = 50;
export const GMAIL_DAILY_LIMIT = 500;
