import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import DetailBackLink from "@/components/DetailBackLink";
import AttachmentList from "@/components/AttachmentList";
import ImageGallery from "@/components/ImageGallery";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

/** 구글 드라이브 공유 링크(.../file/d/FILE_ID/view...)를 임베드 가능한 preview 링크로 바꾼다. */
function toDriveEmbedUrl(url: string) {
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return url;
}

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: post } = await supabase.from("posts").select("*, author_name").eq("id", params.id).eq("type", "news").single();
  if (!post) return <div className="text-muted text-center py-10">기사를 찾을 수 없습니다.</div>;

  const [{ data: attachments }, { data: gallery }] = await Promise.all([
    supabase.from("attachments").select("*").eq("post_id", params.id),
    supabase.from("post_gallery_images").select("image_url").eq("post_id", params.id).order("order_index"),
  ]);
  const galleryUrls = gallery && gallery.length > 0 ? gallery.map((g) => g.image_url) : post.image_url ? [post.image_url] : [];

  return (
    <div className="bg-surface border border-border rounded-2xl p-7">
      <DetailBackLink href="/news" label="뉴스로" />
      <div className="flex items-center gap-2 flex-wrap my-2">
        <Badge color="teal" className="shrink-0">{post.category}</Badge>
        <h1 className="text-2xl m-0 min-w-0">{post.title}</h1>
      </div>
      <div className="text-muted text-sm mb-[18px]">{post.author_name || "-"} · {fmt(post.created_at)}</div>
      <div className="leading-8 whitespace-pre-wrap text-[15px]"><Linkify text={post.content} /></div>
      {post.video_source === "drive" && post.video_url && (
        <div className="mt-5 aspect-video">
          <iframe
            src={toDriveEmbedUrl(post.video_url)}
            className="w-full h-full rounded-xl border border-border"
            allow="autoplay"
            allowFullScreen
          />
        </div>
      )}
      {post.video_source === "upload" && post.video_url && (
        <video controls className="mt-5 w-full rounded-xl border border-border" src={post.video_url} />
      )}
      <ImageGallery
        urls={galleryUrls}
        className={galleryUrls.length === 1 ? "max-w-full rounded-lg border border-border mt-4 object-contain" : "mt-4"}
      />
      <AttachmentList attachments={attachments ?? []} />
    </div>
  );
}
