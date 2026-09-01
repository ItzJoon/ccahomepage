"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeStorageKey } from "@/lib/storageKey";
import ImageLightbox from "@/components/ImageLightbox";

const MAX_SIZE = 5 * 1024 * 1024;

/**
 * 게시판 글/Q&A 질문·답변에 사진 1장을 첨부하는 공용 업로더. Storage 버킷(기본값
 * 'board-images')에 본인 폴더(userId) 아래로 올리고(profile-photos도 동일한 접근
 * 방식이라 bucket을 지정해 프로필 사진 수정에도 그대로 재사용한다) 공개 URL을 부모의
 * image_url 상태로 돌려준다 — 실제 DB 저장은 폼 제출 시점에 호출하는 쪽이 처리한다.
 */
export default function ImageUpload({
  userId,
  value,
  onChange,
  bucket = "board-images",
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
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("5MB 이하의 이미지만 첨부할 수 있습니다.");
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
        <div className="relative w-fit">
          <ImageLightbox src={value} alt="첨부 이미지" className="max-h-48 rounded-lg border border-border object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-navy text-white text-xs leading-none"
            aria-label="사진 제거"
          >
            ✕
          </button>
        </div>
      ) : (
        <label className="inline-flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-sm text-muted cursor-pointer w-fit hover:bg-bg">
          {uploading ? "업로드 중…" : "📷 사진 첨부"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
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
