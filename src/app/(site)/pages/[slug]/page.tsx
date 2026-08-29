import { createClient } from "@/lib/supabase/server";

export default async function CustomPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!page) return <div className="text-muted text-center py-10">페이지를 찾을 수 없습니다.</div>;

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <h1 className="text-2xl mb-4">{page.title}</h1>
      <div className="leading-8 whitespace-pre-wrap text-[15px]">{page.content}</div>
    </div>
  );
}
