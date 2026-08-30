import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";

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

  const { data: attachments } = await supabase.from("attachments").select("*").eq("post_id", params.id);

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <Link href="/news" className="text-blue font-bold text-sm mb-3.5 inline-block">
        ← 뉴스로
      </Link>
      <Badge color="teal">{post.category}</Badge>
      <h1 className="text-2xl my-2">{post.title}</h1>
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
