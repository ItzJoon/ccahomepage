import PostManager from "@/components/admin/PostManager";

export default function AdminNewsPage() {
  return <PostManager type="news" label="뉴스" hasSchedulePin={false} />;
}
