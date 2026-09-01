import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import ViewCounter from "@/components/ViewCounter";
import Linkify from "@/components/Linkify";
import BoardComments from "@/components/BoardComments";
import BoardPostActions from "@/components/BoardPostActions";
import ReportableName from "@/components/ReportableName";
import ReportButton from "@/components/ReportButton";
import DetailBackLink from "@/components/DetailBackLink";
import ImageLightbox from "@/components/ImageLightbox";
import LikeButton from "@/components/LikeButton";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default async function BoardDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  // profiles를 그대로 조인하면 다른 사람 이름/사진은 RLS에 막혀 비어오므로(본인 또는
  // editor 이상만 조회 가능), 안전하게 이름/사진만 반환하는 computed column을 대신 쓴다
  // (supabase/schema.sql 51번 참고).
  const [{ data: post }, profile] = await Promise.all([
    supabase.from("board_posts").select("*, author_name, author_avatar").eq("id", params.id).single(),
    getCurrentProfile(),
  ]);
  if (!post) {
    return <div className="text-muted text-center py-10">게시글을 찾을 수 없습니다(삭제되었거나 숨김 처리된 글일 수 있습니다).</div>;
  }

  const authorLabel = post.author_name || "탈퇴한 사용자";
  const canEditProfile = profile?.role === "admin" || profile?.role === "superadmin";

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <DetailBackLink href="/board" label="게시판으로" />
      <h1 className="text-2xl my-2">{post.title}</h1>
      <div className="flex items-center justify-between flex-wrap gap-2 text-muted text-sm mb-[18px]">
        <div className="flex items-center gap-1.5">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-[9px] font-bold">
              {authorLabel[0]}
            </span>
          )}
          {post.author_id ? (
            <ReportableName
              targetUserId={post.author_id}
              name={authorLabel}
              myId={profile?.id ?? null}
              context={`게시판 글: ${post.title}`}
              canEditProfile={canEditProfile}
            />
          ) : (
            authorLabel
          )}{" "}
          · {fmt(post.created_at)} ·{" "}
          <ViewCounter postId={post.id} initialCount={post.view_count ?? 0} contentType="board_post" />
        </div>
        <div className="flex items-center gap-3">
          <LikeButton targetType="board_post" targetId={post.id} likeCount={post.like_count ?? 0} userId={profile?.id ?? null} />
          <ReportButton
            targetType="board_post"
            targetId={post.id}
            authorId={post.author_id}
            myId={profile?.id ?? null}
            context={`게시판 글: ${post.title}`}
          />
          <BoardPostActions postId={post.id} authorId={post.author_id} myId={profile?.id ?? null} isAdmin={canEditProfile} />
        </div>
      </div>
      <div className="leading-8 whitespace-pre-wrap text-[15px]">
        <Linkify text={post.content} />
      </div>
      {post.image_url && (
        <ImageLightbox src={post.image_url} alt="첨부 이미지" className="max-w-full rounded-lg border border-border mt-4 object-contain" />
      )}
      <BoardComments postId={post.id} userId={profile?.id ?? null} />
    </div>
  );
}
