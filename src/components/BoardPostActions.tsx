"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** 게시글 작성자 본인 또는 admin 이상에게 보이는 삭제 버튼(다른 콘텐츠 타입과 동일한 기준). */
export default function BoardPostActions({
  postId,
  authorId,
  myId,
  isAdmin,
}: {
  postId: string;
  authorId: string | null;
  myId: string | null;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  if (!myId || (myId !== authorId && !isAdmin)) return null;

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
