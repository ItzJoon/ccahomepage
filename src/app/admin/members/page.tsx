import OrgMembersManager from "@/components/admin/OrgMembersManager";

// 이 화면은 이제 "/admin/organizations"(부서 관리)의 "부서 구성원" 탭으로 통합됐다.
// 옛 URL을 즐겨찾기해둔 사람도 있을 수 있어 라우트 자체는 남겨두고 같은 컴포넌트를 띄운다.
export default function AdminMembersPage() {
  return <OrgMembersManager />;
}
