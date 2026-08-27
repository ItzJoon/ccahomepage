import PostManager from "@/components/admin/PostManager";

export default function AdminNoticesPage() {
  return <PostManager type="notice" label="공지사항" hasSchedulePin />;
}
