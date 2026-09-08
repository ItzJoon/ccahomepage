"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeStorageKey } from "@/lib/storageKey";

const MAX_SIZE = 5 * 1024 * 1024;

/**
 * 알림/패치노트에 첨부하는 mp3 1개를 업로드하는 공용 업로더. ImageUpload와 동일한
 * 구조(userId/value/onChange/bucket)라서 admin/notify, admin/patch-notes에서 그대로
 * 재사용한다. 기존 파일을 교체(재업로드)할 때 storage에 남은 이전 파일을 지우는 것은
 * onChange를 넘겨주는 부모(admin 화면)의 책임이다 — 이 컴포넌트는 업로드/미리듣기/제거만
 * 담당한다.
 */
export default function SoundUpload({
  userId,
  value,
  onChange,
  bucket = "attachments",
}: {
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const isMp3 = file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3");
    if (!isMp3) {
      setError("mp3 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("5MB 이하의 mp3만 첨부할 수 있습니다.");
      return;
    }
    setError(null);
    setUploading(true);
    const path = `${userId}/${safeStorageKey(file.name)}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(pub.publicUrl);
    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-center gap-2">
          <audio controls src={value} className="h-9 max-w-full" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="w-6 h-6 shrink-0 rounded-full bg-navy text-white text-xs leading-none"
            aria-label="사운드 제거"
          >
            ✕
          </button>
        </div>
      ) : (
        <label className="inline-flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-sm text-muted cursor-pointer w-fit hover:bg-bg">
          {uploading ? "업로드 중…" : "🔊 사운드 첨부 (mp3)"}
          <input
            ref={inputRef}
            type="file"
            accept="audio/mpeg,.mp3"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </label>
      )}
      {error && <p className="text-red text-xs m-0">{error}</p>}
    </div>
  );
}
