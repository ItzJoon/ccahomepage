export type Role = "student" | "teacher" | "sub_editor" | "editor" | "admin" | "superadmin";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  nickname: string | null;
  bio: string | null;
  role: Role;
  profile_image: string | null;
  freeze_credits: number;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  role_description: string | null;
  order_index: number;
  is_active: boolean;
}

export interface Member {
  id: string;
  org_id: string;
  user_id: string | null;
  name: string;
  position: string | null;
  photo_url: string | null;
  bio: string | null;
  order_index: number;
}

export interface Post {
  id: string;
  type: "notice" | "news";
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  status: "draft" | "scheduled" | "published";
  publish_at: string;
  author_id: string | null;
  view_count: number;
  created_at: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  category: string;
}

export interface RuleDoc {
  id: string;
  title: string;
  category: string;
  content: string;
  updated_at: string;
}

export interface Question {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  is_private: boolean;
  author_display_name: string | null;
  status: "pending" | "answered";
  created_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  content: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: "info" | "urgent";
  display_type: "banner" | "popup";
  duration_minutes: number | null;
  popup_active: boolean;
  sent_by: string | null;
  sent_at: string;
}

export interface MainBlock {
  id: string;
  label: string;
  is_visible: boolean;
  order_index: number;
}

export interface BadgeDef {
  id: string;
  code: string;
  label: string;
  description: string | null;
  icon: string;
  award_type: "auto" | "manual";
  streak_threshold: number | null;
  order_index: number;
  is_active: boolean;
  is_secret: boolean;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface PageDoc {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  is_published: boolean;
  menu_visible: boolean;
  order_index: number;
}
