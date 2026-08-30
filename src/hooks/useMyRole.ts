"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

/**
 * "로그인한 내 프로필/역할 조회" 패턴이 관리자 화면 등 20곳 넘는 파일에 거의 똑같이
 * 반복돼 있었다(supabase.auth.getUser() -> profiles.select("role")). 공용 훅으로
 * 뺐다 — createClient()는 싱글턴이라 여러 컴포넌트가 각자 이 훅을 불러도 같은
 * 클라이언트 인스턴스를 재사용한다(추가 연결 비용 없음).
 */
export function useMyRole() {
  const [myId, setMyId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setMyId(data.user.id);
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      if (cancelled) return;
      setRole((me?.role as Role) ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    myId,
    role,
    loading,
    isAdmin: !!role && ["admin", "superadmin"].includes(role),
    isSuperadmin: role === "superadmin",
    isEditorUp: !!role && ["editor", "admin", "superadmin"].includes(role),
    isTeacher: role === "teacher",
  };
}
