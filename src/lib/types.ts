export type Role = "student" | "editor" | "admin" | "superadmin";

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
  streak_threshold: number;
  order_index: number;
  is_active: boolean;
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
