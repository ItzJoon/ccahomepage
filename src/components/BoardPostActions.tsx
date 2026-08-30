"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** 게시글 작성자 본인만 보이는 삭제 버튼(Q&A의 본인 질문 삭제와 동일한 패턴). */
export default function BoardPostActions({
  postId,
  authorId,
  myId,
}: {
  postId: string;
  authorId: string | null;
  myId: string | null;
}) {
  const router = useRouter();
  if (!myId || myId !== authorId) return null;

  const remove = async () => {
    if (!confirm("이 글을 삭제하시겠습니까? 댓글도 함께 삭제됩니다.")) return;
    await createClient().from("board_posts").delete().eq("id", postId);
    router.push("/board");
  };

  return (
    <button onClick={remove} className="text-red text-xs font-bold">
      삭제
    </button>
  );
}
