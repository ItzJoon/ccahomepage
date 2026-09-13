import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { PREVIEW_STUDENT_EMAIL } from "@/lib/previewStudent";

// developer(superadmin)만 "학생 화면 보기" 전용 계정의 매직링크를 발급받을 수 있다 —
// "학생 화면 보기" 버튼 자체가 이미 role === "superadmin" 조건으로 숨겨져 있지만, API
// 라우트는 항상 서버에서 다시 검증한다(클라이언트 숨김은 보조 수단일 뿐).
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: PREVIEW_STUDENT_EMAIL,
  });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message || "미리보기 계정 링크 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ hashedToken: data.properties.hashed_token });
}
