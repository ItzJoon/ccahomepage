"use client";

import { createContext, useContext } from "react";

// developer(=superadmin)가 "학생 화면 보기"로 둘러보는 중인지 여부. (site)/layout.tsx가
// 서버에서 preview_as_student 쿠키를 읽어 값을 채워 넣는다. true일 때는 각 페이지가
// is_hidden/status 같은 "editor 이상에게만 보이는" 콘텐츠를 직접 걸러내야 한다 — 실제
// 세션은 여전히 superadmin이라 RLS(is_editor_or_above() 예외)가 그 콘텐츠까지 그대로
// 내려주기 때문에, 미들웨어/RLS가 아니라 화면 쪽에서 한 번 더 숨겨야 진짜 학생이 보는
// 모습과 같아진다.
const StudentPreviewContext = createContext(false);

export const StudentPreviewProvider = StudentPreviewContext.Provider;

export function useStudentPreview() {
  return useContext(StudentPreviewContext);
}
