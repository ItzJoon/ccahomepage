"use client";

import { useEffect, useRef, useState } from "react";

interface PageImage {
  dataUrl: string;
}

/**
 * PDF 첨부파일을 클릭 없이 본문에 바로 페이지별로 이어서 렌더링하는 뷰어.
 * pdfjs-dist는 브라우저 canvas/worker가 필요해서 이 파일 자체를 "use client"로 두고
 * useEffect 안에서만 동적 import한다 — 다만 이 컴포넌트는 async 서버 컴포넌트(공지/뉴스/
 * 일정 상세 페이지)에서 <PdfInlineViewer .../>로 직접 자식으로 렌더링해도 된다(기존
 * ImageLightbox와 동일한 패턴 — 서버 컴포넌트가 클라이언트 컴포넌트를 그냥 import해서
 * 쓰면 되고 next/dynamic이 필요 없다).
 *
 * 화면 표시 너비의 2배 해상도로 각 페이지를 캔버스에 렌더링해 데이터 URL로 저장해두고,
 * 그 이미지를 그대로 인라인 표시 + 라이트박스 확대에 재사용한다(라이트박스에서 다시
 * PDF를 재렌더링하지 않음 — 페이지 수가 많아도 pdf.js 작업은 한 번만 돈다).
 */
export default function PdfInlineViewer({ url, fileName }: { url: string; fileName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState<PageImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)로 워커를
        // webpack 에셋으로 번들링하면, 그 파일이 ESM(import.meta 사용)인데 Next.js가
        // Terser로 일반 스크립트처럼 minify하려다 빌드가 깨진다("import.meta cannot be
        // used outside of module code"). 그래서 번들링을 아예 거치지 않도록 워커 파일을
        // (postinstall 스크립트로) public/에 그대로 복사해두고 정적 경로로 로드한다.
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // 표시 너비의 2배 해상도로 렌더링해서 라이트박스로 확대해도 흐려 보이지 않게 한다.
        const displayWidth = containerRef.current?.clientWidth || 600;
        const renderWidth = displayWidth * 2;

        const doc = await pdfjsLib.getDocument({ url }).promise;
        const images: PageImage[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: renderWidth / baseViewport.width });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          images.push({ dataUrl: canvas.toDataURL("image/png") });
        }
        if (!cancelled) {
          setPages(images);
          setStatus("ready");
        }
      } catch (err) {
        console.error("[PdfInlineViewer] failed:", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const openLightbox = (i: number) => {
    setLightboxIndex(i);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  };
  const closeLightbox = () => {
    setVisible(false);
    setTimeout(() => setLightboxIndex(null), 250);
  };
  const step = (delta: number) => {
    setLightboxIndex((i) => {
      if (i === null) return i;
      const next = i + delta;
      return next < 0 || next >= pages.length ? i : next;
    });
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
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
  }, [lightboxIndex, pages.length]);

  if (status === "error") {
    return (
      <a href={url} className="block text-sm py-1 text-blue">
        📎 {fileName} (다운로드)
      </a>
    );
  }

  return (
    <div ref={containerRef} className="mt-3">
      <div className="text-xs font-bold text-muted mb-1.5">
        📄 {fileName}
        {status === "loading" && <span className="font-normal ml-1.5">불러오는 중…</span>}
      </div>
      {status === "loading" && <div className="w-full h-48 rounded-lg border border-border bg-bg animate-pulse" />}
      <div className="flex flex-col gap-2">
        {pages.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={p.dataUrl}
            alt={`${fileName} ${i + 1}페이지`}
            className="w-full rounded-lg border border-border cursor-zoom-in"
            onClick={() => openLightbox(i)}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          className={`fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 transition-opacity duration-[250ms] ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-2xl leading-none hover:bg-white/20"
            aria-label="닫기"
          >
            ✕
          </button>
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              className="absolute left-2 sm:left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-2xl leading-none hover:bg-white/20"
              aria-label="이전 페이지"
            >
              ‹
            </button>
          )}
          {lightboxIndex < pages.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              className="absolute right-2 sm:right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-2xl leading-none hover:bg-white/20"
              aria-label="다음 페이지"
            >
              ›
            </button>
          )}
          {pages.length > 1 && (
            <div className="absolute top-4 left-4 text-white text-sm bg-white/10 rounded-full px-3 py-1">
              {lightboxIndex + 1} / {pages.length}
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pages[lightboxIndex].dataUrl}
            alt={`${fileName} ${lightboxIndex + 1}페이지`}
            onClick={(e) => e.stopPropagation()}
            className={`max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl transition-transform duration-[250ms] ${
              visible ? "scale-100" : "scale-95"
            }`}
          />
        </div>
      )}
    </div>
  );
}
