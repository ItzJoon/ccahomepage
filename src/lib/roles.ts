import type { Role } from "@/lib/types";

export const ROLES: Role[] = ["student", "viewer", "teacher", "sub_editor", "editor", "admin", "superadmin", "designer"];

// developer(=superadmin)는 관리자 화면 어디서도 새로 부여할 수 없다(부여는 DB에서 직접
// 해야 함) — 회원·권한 관리/외부 계정 관리 등 role을 고르는 모든 드롭다운이 이 목록을
// 공유한다.
export const ASSIGNABLE_ROLES: Role[] = ROLES.filter((r) => r !== "superadmin");
