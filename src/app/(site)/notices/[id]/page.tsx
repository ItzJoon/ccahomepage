import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Badge, { Pin } from "@/components/Badge";
import ViewCounter from "@/components/ViewCounter";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default async function NoticeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", params.id).single();
  if (!post) {
    return <div className="text-muted text-center py-10">게시글을 찾을 수 없습니다.</div>;
  }

  const { data: attachments } = await supabase
    .from("attachments")
    .select("*")
    .eq("post_id", params.id);

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <Link href="/notices" className="text-blue font-bold text-sm mb-3.5 inline-block">
        ← 목록으로
      </Link>
      <div>
        {post.type === "subject_notice" ? (
          <Badge color="teal">교과·{post.target_subject}</Badge>
        ) : post.type === "homeroom_notice" ? (
          <Badge color="gold">학급·{post.target_homeroom}반</Badge>
        ) : (
          <Badge color="navy">{post.category}</Badge>
        )}{" "}
        {post.is_pinned && <Pin />}
        <h1 className="text-2xl my-2">{post.title}</h1>
        <div className="text-muted text-sm mb-[18px]">
          {fmt(post.publish_at)} · <ViewCounter postId={post.id} initialCount={post.view_count ?? 0} />
        </div>
      </div>
      <div className="leading-8 whitespace-pre-wrap text-[15px]">{post.content}</div>
      {attachments && attachments.length > 0 && (
        <div className="mt-5 p-3.5 bg-bg rounded-xl">
          <div className="font-bold text-xs mb-1.5">첨부파일</div>
          {attachments.map((a) => (
            <a key={a.id} href={a.file_url} className="block text-sm py-1 text-blue">
              📎 {a.file_name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
