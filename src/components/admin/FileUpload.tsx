"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AttachmentRef {
  file_url: string;
  file_name: string;
  file_path: string;
  size: number;
}

/**
 * 공지/뉴스/일정/규정 작성 폼에서 공용으로 쓰는 첨부파일 업로더.
 * Supabase Storage의 'attachments' 버킷에 업로드하고 공개 URL을 돌려줍니다.
 * 실제 DB(attachments 테이블) 저장은 호출하는 쪽에서 폼 저장 시점에 처리합니다.
 */
export default function FileUpload({
  files,
  onChange,
}: {
  files: AttachmentRef[];
  onChange: (files: AttachmentRef[]) => void;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    const path = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);
    onChange([...files, { file_url: pub.publicUrl, file_name: file.name, file_path: path, size: file.size }]);
    setUploading(false);
  };

  const remove = async (idx: number) => {
    const target = files[idx];
    await supabase.storage.from("attachments").remove([target.file_path]);
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {files.map((f, i) => (
        <span key={i} className="bg-[#F2F4F8] rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5">
          📎 {f.file_name}
          <button type="button" onClick={() => remove(i)} className="text-muted">
            ✕
          </button>
        </span>
      ))}
      <label className="text-xs font-bold border border-border rounded-lg px-3 py-1.5 cursor-pointer bg-white">
        {uploading ? "업로드 중…" : "+ 파일 추가"}
        <input
          type="file"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {error && <span className="text-red text-xs">{error}</span>}
    </div>
  );
}
