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
  is_council: boolean;
  is_judiciary: boolean;
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

export type PostType = "notice" | "news" | "subject_notice" | "homeroom_notice";

export interface Post {
  id: string;
  type: PostType;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  status: "draft" | "scheduled" | "published";
  publish_at: string;
  author_id: string | null;
  view_count: number;
  created_at: string;
  video_source: "drive" | "upload" | null;
  video_url: string | null;
  video_path: string | null;
  target_subject: string | null;
  target_homeroom: number | null;
}

export interface StudentSubject {
  id: string;
  user_id: string;
  subject: string;
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
  created_by: string | null;
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
  award_type: "auto" | "manual" | "date";
  streak_threshold: number | null;
  date_condition: "before" | "after" | "on" | "between" | null;
  date_condition_value: string | null;
  date_condition_value_end: string | null;
  order_index: number;
  is_active: boolean;
  is_secret: boolean;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  celebrated: boolean;
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

export interface Proposal {
  id: string;
  org_id: string;
  title: string;
  summary: string;
  author_id: string | null;
  status: "review" | "approved" | "rejected" | "completed";
  created_at: string;
  updated_at: string;
}

export interface ProposalVote {
  id: string;
  proposal_id: string;
  user_id: string;
  vote: "yes" | "no";
  created_at: string;
}

export interface OrgEvent {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  location: string | null;
  category: "meeting" | "event" | "deadline" | "general";
  start_at: string;
  end_at: string;
  created_by: string | null;
  created_at: string;
}

export interface OrgRecord {
  id: string;
  org_id: string;
  category: "notice" | "activity" | "minutes";
  title: string;
  content: string;
  author_id: string | null;
  created_at: string;
}

export interface SiteSettings {
  id: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  maintenance_until: string | null;
  restrict_external_checkin: boolean;
  updated_at: string;
}

export interface SiteTheme {
  id: string;
  theme: string;
  updated_at: string;
  updated_by: string | null;
}

export type MemberType = "student" | "teacher" | "other";

export interface DirectoryMember {
  id: string;
  email: string;
  member_type: MemberType;
  display_name: string;
  grade: "10" | "11" | "12" | null;
  homeroom: 1 | 2 | 3 | null;
  homeroom_label: string | null;
  subject: string | null;
  leadership_role: string | null;
  is_allowed: boolean;
  created_at: string;
}

export interface DirectoryProfileView {
  id: string;
  name: string | null;
  nickname: string | null;
  bio: string | null;
  profile_image: string | null;
  email: string;
  member_type: MemberType;
  display_name: string;
  grade: "10" | "11" | "12" | null;
  homeroom: 1 | 2 | 3 | null;
  homeroom_label: string | null;
  subject: string | null;
}

export type LoginAccessStatus = "pending" | "approved" | "blocked";

export interface LoginAccessRequest {
  id: string;
  email: string;
  attempted_at: string;
  status: LoginAccessStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export type AuditAction = "insert" | "update" | "delete";

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction;
  target_table: string | null;
  target_id: string | null;
  before_data: Record<string, any> | null;
  after_data: Record<string, any> | null;
  created_at: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface BoardPost {
  id: string;
  author_id: string | null;
  title: string;
  content: string;
  view_count: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string | null;
  content: string;
  created_at: string;
}

export type ReportTargetType = "profile" | "board_post" | "board_comment";
export type ReportStatus = "pending" | "reviewed" | "dismissed";

export interface Report {
  id: string;
  reporter_id: string | null;
  target_type: ReportTargetType;
  target_id: string;
  context: string | null;
  reason: string | null;
  status: ReportStatus;
  created_at: string;
}
