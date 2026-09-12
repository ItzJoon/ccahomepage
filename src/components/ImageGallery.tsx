"use client";

import { useEffect, useState } from "react";

/**
 * 게시글 상세 페이지에서 사진 1장은 기존 ImageLightbox와 동일한 모양으로, 여러 장은
 * 격자 썸네일로 보여주고 클릭하면 전체화면 라이트박스에서 좌우로 넘기며 볼 수 있는
 * 공용 컴포넌트. 사진이 없으면 아무것도 렌더링하지 않는다.
 */
export default function ImageGallery({ urls, className = "" }: { urls: string[]; className?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  const open = (i: number) => {
    setIndex(i);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  };
  const close = () => {
    setVisible(false);
    setTimeout(() => setIndex(null), 250);
  };
  const step = (delta: number) => {
    setIndex((i) => {
      if (i === null) return i;
      const next = i + delta;
      return next < 0 || next >= urls.length ? i : next;
    });
  };

  useEffect(() => {
    if (index === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, urls.length]);

  if (urls.length === 0) return null;

  return (
    <>
      {urls.length === 1 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urls[0]}
          alt="첨부 이미지"
          className={`cursor-zoom-in ${className}`}
          onClick={() => open(0)}
        />
      ) : (
        <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 ${className}`}>
          {urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url + i}
              src={url}
              alt={`첨부 이미지 ${i + 1}`}
              className="w-full aspect-square object-cover rounded-lg border border-border cursor-zoom-in"
              onClick={() => open(i)}
            />
          ))}
        </div>
      )}

      {index !== null && (
        <div
          className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-[250ms] ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          onClick={close}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-2xl leading-none hover:bg-white/20"
            aria-label="닫기"
          >
            ✕
          </button>
          {index > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              className="absolute left-2 sm:left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-2xl leading-none hover:bg-white/20"
              aria-label="이전 사진"
            >
              ‹
            </button>
          )}
          {index < urls.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              className="absolute right-2 sm:right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-2xl leading-none hover:bg-white/20"
              aria-label="다음 사진"
            >
              ›
            </button>
          )}
          {urls.length > 1 && (
            <div className="absolute top-4 left-4 text-white text-sm bg-white/10 rounded-full px-3 py-1">
              {index + 1} / {urls.length}
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[index]}
            alt={`첨부 이미지 ${index + 1}`}
            onClick={(e) => e.stopPropagation()}
            className={`max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl transition-transform duration-[250ms] ${
              visible ? "scale-100" : "scale-95"
            }`}
          />
        </div>
      )}
    </>
  );
}
