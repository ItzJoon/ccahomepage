"use client";

import { useEffect, useState } from "react";

/**
 * 이미지를 그대로 트리거로 렌더링하고, 클릭하면 화면 전체를 덮는 어두운 오버레이 위에
 * 원본 비율을 유지한 채 확대해서 보여주는 공용 컴포넌트. 급식표뿐 아니라 첨부파일 등
 * 다른 이미지에도 <img> 대신 이 컴포넌트로 바꿔 끼우면 동일하게 동작한다.
 *
 * 열고 닫을 때 모두 페이드 + 살짝 스케일되는 트랜지션을 쓰는데, React는 마운트와 동시에
 * "열린" 스타일을 그리면 트랜지션이 걸리지 않으므로(시작 상태가 이미 도착 상태), 먼저
 * "닫힌" 스타일로 그려놓고 다음 프레임에 "열린" 스타일로 바꿔서 브라우저가 실제로
 * 트랜지션을 실행하게 한다(double requestAnimationFrame).
 */
export default function ImageLightbox({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  const show = () => {
    setOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  };

  const close = () => {
    setVisible(false);
    setTimeout(() => setOpen(false), 250);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <img src={src} alt={alt} className={`cursor-zoom-in ${className}`} onClick={show} />
      {open && (
        <div
          className={`fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 transition-opacity duration-[250ms] ${
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
          <img
            src={src}
            alt={alt}
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
