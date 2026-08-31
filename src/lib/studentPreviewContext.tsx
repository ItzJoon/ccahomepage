"use client";

import { createContext, useContext } from "react";

// developer(=superadmin)가 "학생 화면 보기"로 둘러보는 중인지 여부. (site)/layout.tsx가
// 서버에서 preview_as_student 쿠키를 읽어 값을 채워 넣는다. true일 때는 각 페이지가
// is_hidden/status 같은 "editor 이상에게만 보이는" 콘텐츠를 직접 걸러내야 한다 — 실제
// 세션은 여전히 superadmin이라 RLS(is_editor_or_above() 예외)가 그 콘텐츠까지 그대로
// 내려주기 때문에, 미들웨어/RLS가 아니라 화면 쪽에서 한 번 더 숨겨야 진짜 학생이 보는
// 모습과 같아진다.
const StudentPreviewContext = createContext(false);

// Context.Provider 자체를 그대로 export해서 쓰면(예: `export const X = Ctx.Provider`),
// Next.js가 "use client" 모듈의 각 export를 서버→클라이언트 경계용 참조로 감쌀 때 일반
// 함수 컴포넌트가 아닌 이 특수 객체를 제대로 못 감싸서 "Element type is invalid ...
// Lazy element type must resolve to a class or function" 런타임 에러가 난다(서버
// 컴포넌트에서 직접 <X value={...}>로 썼을 때 재현됨 — 실제로 이 버그로 프로덕션 홈페이지가
// 전부 깨졌었다). 반드시 평범한 함수 컴포넌트로 한 번 감싸서 내보내야 한다 — 이 파일의
// PrevPathProvider/DesignerModeGate와 동일한 패턴.
export function StudentPreviewProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <StudentPreviewContext.Provider value={value}>{children}</StudentPreviewContext.Provider>;
}

export function useStudentPreview() {
  return useContext(StudentPreviewContext);
}
