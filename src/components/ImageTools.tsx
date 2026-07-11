"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { removeBackgroundData } from "@/lib/bgremove";

const MAX_DIM = 1600; // cap processing resolution for speed

export default function ImageTools({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const srcRef = useRef<{ data: ImageData; w: number; h: number } | null>(null);
  const outRef = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState<string>("");
  const [tolerance, setTolerance] = useState(28);
  const [feather, setFeather] = useState(1);
  const [busy, setBusy] = useState(false);
  const [hasImage, setHasImage] = useState(false);

  const loadFile = useCallback((file: File) => {
    setName(file.name.replace(/\.[^.]+$/, ""));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      srcRef.current = { data: ctx.getImageData(0, 0, w, h), w, h };
      setHasImage(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const process = useCallback(() => {
    const src = srcRef.current;
    const canvas = outRef.current;
    if (!src || !canvas) return;
    setBusy(true);
    // let the busy state paint before the (sync) heavy pass
    requestAnimationFrame(() => {
      const out = removeBackgroundData(src.data.data, src.w, src.h, {
        tolerance,
        feather,
      });
      canvas.width = src.w;
      canvas.height = src.h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const img = ctx.createImageData(src.w, src.h);
        img.data.set(out);
        ctx.putImageData(img, 0, 0);
      }
      setBusy(false);
    });
  }, [tolerance, feather]);

  useEffect(() => {
    if (hasImage) process();
  }, [hasImage, process]);

  const download = () => {
    const canvas = outRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name || "cutout"}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, "image/png");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <div>
            <span className="text-sm font-semibold text-ink">Remove image background</span>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-label text-muted">
              offline · no upload
            </span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="scroll-thin grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[1fr_220px]">
          {/* preview on a checkerboard */}
          <div
            className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl border border-edge"
            style={{
              backgroundImage:
                "repeating-conic-gradient(#808080 0% 25%, #b0b0b0 0% 50%)",
              backgroundSize: "20px 20px",
            }}
          >
            {hasImage ? (
              <canvas ref={outRef} className="max-h-[52vh] max-w-full object-contain" />
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="btn btn-primary"
              >
                Choose an image
              </button>
            )}
          </div>

          {/* controls */}
          <div className="space-y-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="btn w-full justify-center"
            >
              {hasImage ? "Replace image" : "Choose image"}
            </button>
            <label className="block">
              <span className="mb-1.5 flex justify-between font-mono text-[10px] uppercase tracking-label text-muted">
                <span>Tolerance</span>
                <span className="tabular-nums">{tolerance}</span>
              </span>
              <input
                type="range" min={2} max={80} step={1} value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="w-full cursor-pointer" disabled={!hasImage}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex justify-between font-mono text-[10px] uppercase tracking-label text-muted">
                <span>Edge feather</span>
                <span className="tabular-nums">{feather}</span>
              </span>
              <input
                type="range" min={0} max={4} step={1} value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                className="w-full cursor-pointer" disabled={!hasImage}
              />
            </label>
            <button
              onClick={download}
              disabled={!hasImage || busy}
              className="btn btn-primary w-full justify-center"
            >
              {busy ? "Processing…" : "Download .png"}
            </button>
            <p className="font-mono text-[10px] leading-relaxed text-muted">
              Best for solid / studio / AI-generated backgrounds. Raise
              tolerance for gradients; feather softens the edge. Nothing leaves
              your device.
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
