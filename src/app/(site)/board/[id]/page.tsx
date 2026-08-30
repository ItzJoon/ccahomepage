import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import ViewCounter from "@/components/ViewCounter";
import Linkify from "@/components/Linkify";
import BoardComments from "@/components/BoardComments";
import BoardPostActions from "@/components/BoardPostActions";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default async function BoardDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: post }, profile] = await Promise.all([
    supabase.from("board_posts").select("*, author:profiles(name, nickname, profile_image)").eq("id", params.id).single(),
    getCurrentProfile(),
  ]);
  if (!post) {
    return <div className="text-muted text-center py-10">게시글을 찾을 수 없습니다(삭제되었거나 숨김 처리된 글일 수 있습니다).</div>;
  }

  const authorLabel = post.author?.nickname || post.author?.name || "탈퇴한 사용자";

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <Link href="/board" className="text-blue font-bold text-sm mb-3.5 inline-block">
        ← 목록으로
      </Link>
      <h1 className="text-2xl my-2">{post.title}</h1>
      <div className="flex items-center justify-between flex-wrap gap-2 text-muted text-sm mb-[18px]">
        <div className="flex items-center gap-1.5">
          {post.author?.profile_image ? (
            <img src={post.author.profile_image} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-[9px] font-bold">
              {authorLabel[0]}
            </span>
          )}
          {authorLabel} · {fmt(post.created_at)} ·{" "}
          <ViewCounter postId={post.id} initialCount={post.view_count ?? 0} rpc="increment_board_view_count" />
        </div>
        <BoardPostActions postId={post.id} authorId={post.author_id} myId={profile?.id ?? null} />
      </div>
      <div className="leading-8 whitespace-pre-wrap text-[15px]">
        <Linkify text={post.content} />
      </div>
      <BoardComments postId={post.id} userId={profile?.id ?? null} />
    </div>
  );
}
