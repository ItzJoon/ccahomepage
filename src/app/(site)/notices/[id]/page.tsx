import { createClient } from "@/lib/supabase/server";
import Badge, { Pin } from "@/components/Badge";
import ViewCounter from "@/components/ViewCounter";
import DetailBackLink from "@/components/DetailBackLink";
import { noticeContentToSafeHtml } from "@/lib/sanitizeHtml";
import ImageGallery from "@/components/ImageGallery";
import AttachmentList from "@/components/AttachmentList";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default async function NoticeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: post } = await supabase.from("posts").select("*, author_name").eq("id", params.id).single();
  if (!post) {
    return <div className="text-muted text-center py-10">게시글을 찾을 수 없습니다.</div>;
  }

  const [{ data: attachments }, { data: gallery }] = await Promise.all([
    supabase.from("attachments").select("*").eq("post_id", params.id),
    supabase.from("post_gallery_images").select("image_url").eq("post_id", params.id).order("order_index"),
  ]);
  const galleryUrls = gallery && gallery.length > 0 ? gallery.map((g) => g.image_url) : post.image_url ? [post.image_url] : [];

  return (
    <div className="bg-surface border border-border rounded-2xl p-7">
      <DetailBackLink href="/notices" label="공지사항으로" />
      <div>
        <div className="flex items-center gap-2 flex-wrap my-2">
          {post.type === "subject_notice" ? (
            <Badge color="teal" className="shrink-0">교과·{post.target_subject}</Badge>
          ) : post.type === "homeroom_notice" ? (
            <Badge color="gold" className="shrink-0">학급·{post.target_homeroom}반</Badge>
          ) : (
            <Badge color="navy" className="shrink-0">{post.category}</Badge>
          )}
          {post.is_pinned && <Pin className="shrink-0" />}
          <h1 className="text-2xl m-0 min-w-0">{post.title}</h1>
        </div>
        <div className="text-muted text-sm mb-[18px]">
          {post.author_name || "-"} · {fmt(post.publish_at)} ·{" "}
          <ViewCounter postId={post.id} initialCount={post.view_count ?? 0} contentType="notice" />
        </div>
      </div>
      <div
        className="leading-8 text-[15px] [&_a]:text-blue [&_a]:underline [&_a]:break-all"
        dangerouslySetInnerHTML={{ __html: noticeContentToSafeHtml(post.content) }}
      />
      <ImageGallery
        urls={galleryUrls}
        className={galleryUrls.length === 1 ? "max-w-full rounded-lg border border-border mt-4 object-contain" : "mt-4"}
      />
      <AttachmentList attachments={attachments ?? []} />
    </div>
  );
}
