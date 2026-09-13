/**
 * developer 전용 "학생 화면 보기"가 실제로 세션을 전환하는 전용 미리보기 계정.
 * 진짜 신규 학생과 똑같은 상태(뱃지 없음·연속접속 0일·닉네임/소개 없음·아무 글도 안 읽음)를
 * 얻기 위해, 개발자 본인 세션을 그대로 쓰는 대신 이 계정으로 완전히 전환한다(src/lib/
 * studentPreview.ts 참고). directory_members에 member_type='other'로 등록돼 있어
 * 로그인 명단 제한은 통과하면서도 구성원 조회/랭킹/학생 수 통계 등 실제 목록에는
 * 전혀 나타나지 않는다.
 */
export const PREVIEW_STUDENT_ID = "3d817e5e-a1d1-4e96-8007-cc57170c7f94";
export const PREVIEW_STUDENT_EMAIL = "preview-student@ccahomepage.local";
