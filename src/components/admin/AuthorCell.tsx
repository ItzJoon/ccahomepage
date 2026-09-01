/**
 * 관리자 목록 화면(게시판 관리/Q&A 관리/공지·뉴스 관리/신고 내역 등)의 "작성자" 계열
 * 컬럼에서 공통으로 쓰는 이름 표시. 닉네임이 길어서 줄이 꺾이는 대신 한 줄로 유지하고
 * 말줄임 처리한다(전체 이름은 title 툴팁으로 확인).
 */
export default function AuthorCell({ name, maxWidthClass = "max-w-[140px]" }: { name: string; maxWidthClass?: string }) {
  return (
    <span className={`inline-block truncate align-bottom ${maxWidthClass}`} title={name}>
      {name}
    </span>
  );
}
