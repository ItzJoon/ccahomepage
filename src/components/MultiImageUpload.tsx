"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeStorageKey } from "@/lib/storageKey";

const MAX_SIZE = 5 * 1024 * 1024;
const DEFAULT_MAX_COUNT = 10;

/**
 * 게시글에 사진 여러 장을 한꺼번에 첨부하는 공용 업로더(ImageUpload.tsx의 다중 버전).
 * 선택 즉시 각 파일을 Storage에 올리고 공개 URL을 부모의 문자열 배열 상태로 돌려준다
 * (post_gallery_images row로 저장하는 건 폼 제출 시점에 호출하는 쪽이 처리) — 순서
 * 변경은 네이티브 HTML5 드래그 앤 드롭으로 지원한다(별도 라이브러리 없이 배열 스왑만).
 */
export default function MultiImageUpload({
  userId,
  value,
  onChange,
  bucket = "board-images",
  max = DEFAULT_MAX_COUNT,
}: {
  userId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  bucket?: string;
  max?: number;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleFiles = async (files: FileList) => {
    setError(null);
    const list = Array.from(files);
    const remainingSlots = max - value.length;
    if (remainingSlots <= 0) {
      setError(`사진은 최대 ${max}장까지 첨부할 수 있습니다.`);
      return;
    }
    const toUpload = list.slice(0, remainingSlots);
    if (list.length > toUpload.length) {
      setError(`사진은 최대 ${max}장까지 첨부할 수 있어 나머지는 제외됐습니다.`);
    }

    setUploading(true);
    const uploaded: string[] = [];
    for (const file of toUpload) {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 첨부할 수 있습니다.");
        continue;
      }
      if (file.size > MAX_SIZE) {
        setError("5MB 이하의 이미지만 첨부할 수 있습니다.");
        continue;
      }
      const path = `${userId}/${safeStorageKey(file.name)}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      uploaded.push(pub.publicUrl);
    }
    if (uploaded.length > 0) onChange([...value, ...uploaded]);
    setUploading(false);
  };

  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const onDrop = (dropIndex: number) => {
    const from = dragIndex.current;
    setDragOverIndex(null);
    dragIndex.current = null;
    if (from === null || from === dropIndex) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <div
              key={url + i}
              draggable
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(i);
              }}
              onDragLeave={() => setDragOverIndex((v) => (v === i ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(i);
              }}
              className={`relative w-20 h-20 rounded-lg overflow-hidden border cursor-grab active:cursor-grabbing ${
                dragOverIndex === i ? "border-blue border-2" : "border-border"
              }`}
              title="드래그해서 순서 변경"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-navy text-white text-xs leading-none flex items-center justify-center"
                aria-label="사진 제거"
              >
                ✕
              </button>
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-black/60 text-white py-0.5">대표</span>
              )}
            </div>
          ))}
        </div>
      )}
      {value.length < max && (
        <label className="inline-flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-sm text-muted cursor-pointer w-fit hover:bg-bg">
          {uploading ? "업로드 중…" : `📷 사진 추가 (${value.length}/${max})`}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </label>
      )}
      {error && <p className="text-red text-xs m-0">{error}</p>}
    </div>
  );
}
