import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/Badge";

const COLOR_VAR: Record<string, string> = {
  navy: "var(--navy)",
  teal: "var(--teal)",
  red: "var(--red)",
  gold: "var(--gold)",
};

export default async function OrgDetailPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: org } = await supabase.from("organizations").select("*").eq("slug", params.slug).single();
  if (!org) return <div className="text-muted text-center py-10">부서를 찾을 수 없습니다.</div>;

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("org_id", org.id)
    .order("order_index");

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <Link href="/organizations" className="text-blue font-bold text-sm mb-3.5 inline-block">
        ← 학생자치회 소개로
      </Link>
      <div className="pl-4" style={{ borderLeft: `6px solid ${COLOR_VAR[org.color] || COLOR_VAR.navy}` }}>
        <Badge color={org.color}>부서</Badge>
        <h1 className="text-2xl my-2">{org.name}</h1>
        <p className="text-muted">{org.description}</p>
      </div>
      <div className="mt-6 pt-5 border-t border-border">
        <h3>주요 역할</h3>
        <p>{org.role_description}</p>
      </div>
      <div className="mt-6 pt-5 border-t border-border">
        <h3>구성원</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {(members ?? []).map((m) => (
            <div key={m.id} className="bg-white border border-border rounded-xl p-4 text-center">
              <div
                className="w-[52px] h-[52px] rounded-full text-white flex items-center justify-center font-bold mx-auto mb-2.5"
                style={{ background: COLOR_VAR[org.color] || COLOR_VAR.navy, width: 52, height: 52 }}
              >
                {m.name[0]}
              </div>
              <div className="font-bold">{m.name}</div>
              <div className="text-blue text-sm mb-1.5">{m.position}</div>
              <div className="text-muted text-xs">{m.bio}</div>
            </div>
          ))}
          {(!members || members.length === 0) && (
            <div className="text-muted text-center py-6 text-sm col-span-4">등록된 구성원이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
