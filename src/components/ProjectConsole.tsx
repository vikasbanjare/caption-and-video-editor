"use client";

import { useEffect, useRef, useState } from "react";
import {
  renderFrame,
  styleFromPreset,
  type Cue,
  type CaptionStyle,
} from "@/engine";
import { timeAgo, type ProjectRecord } from "@/lib/store";
import { fmtClock } from "@/lib/transcript";

interface Props {
  projects: ProjectRecord[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: (file: File) => void;
}

/**
 * The Ingest room — a professional project console with a compact showcase that
 * demonstrates the caption engine live (the product, working), then your
 * projects. Not a marketing landing.
 */
export default function ProjectConsole({
  projects,
  currentId,
  onOpen,
  onDelete,
  onNew,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const pick = () => input.current?.click();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onNew(f);
      }}
      className={`scroll-thin h-full overflow-y-auto ${drag ? "bg-accent/[0.04]" : ""}`}
    >
      <input
        ref={input}
        type="file"
        accept="video/*,audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onNew(f);
          e.target.value = "";
        }}
      />

      <div className="mx-auto max-w-6xl px-8">
        {/* showcase */}
        <section className="grid items-center gap-8 py-10 md:grid-cols-[1.05fr_1fr] md:gap-12 md:py-14">
          <div>
            <span className="eyebrow">Caption NLE · browser-native</span>
            <h1 className="mt-3 text-[clamp(2rem,4.2vw,3.3rem)] font-semibold leading-[1.03] tracking-tight text-ink">
              Transcribe, cut, and set type —{" "}
              <span className="text-accent">without uploading a thing.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
              Whisper runs on your machine. Ninety-seven studio-grade caption
              templates, a real editing timeline, word-perfect timing — then
              export. Nothing leaves the browser.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary" onClick={pick}>
                <PlusIcon /> New from media
              </button>
              <span className="font-mono text-[11px] text-muted">
                or drop a file anywhere
              </span>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-edge pt-5">
              {[
                ["97", "templates"],
                ["17", "animations"],
                ["40+", "languages"],
                ["100%", "private"],
              ].map(([n, l]) => (
                <span key={l} className="flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold text-ink">{n}</span>
                  <span className="eyebrow">{l}</span>
                </span>
              ))}
            </div>
          </div>
          <Showcase />
        </section>

        <div className="rule" />

        {/* projects */}
        <section className="py-8">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <span className="eyebrow">Projects</span>
              <div className="mt-1 text-sm text-muted">
                {projects.length
                  ? `${projects.length} saved on this device`
                  : "Nothing yet"}
              </div>
            </div>
            <button className="btn" onClick={pick}>
              <PlusIcon /> New
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <button
              onClick={pick}
              className={`flex aspect-video flex-col items-center justify-center gap-2 rounded border border-dashed transition-colors ${
                drag ? "border-accent bg-accent/5" : "border-edge2 hover:border-accent"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent text-white">
                <UploadIcon />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-label text-muted">
                Drop media
              </span>
            </button>

            {projects.map((p) => (
              <div
                key={p.id}
                className={`group relative overflow-hidden rounded border bg-surface transition-colors ${
                  p.id === currentId ? "border-accent" : "border-edge hover:border-edge2"
                }`}
              >
                <button onClick={() => onOpen(p.id)} className="block w-full text-left">
                  <div className="flex aspect-video items-center justify-center overflow-hidden bg-black">
                    {p.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-label text-white/25">
                        no frame
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="truncate text-sm font-medium text-ink">{p.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted">
                      <span>{fmtClock(p.duration || 0)}</span>
                      <span className="text-edge2">·</span>
                      <span>{(p.cues || []).length} cues</span>
                      <span className="text-edge2">·</span>
                      <span>{timeAgo(p.updatedAt)}</span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => onDelete(p.id)}
                  title="Delete project"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-sm bg-black/60 text-white/70 opacity-0 transition-opacity hover:bg-black/80 hover:text-white group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* --- live showcase: the caption engine, cycling premium templates ---------- */
const DEMO: Cue = {
  id: "demo",
  start: 0,
  end: 2.4,
  text: "every word on cue",
  words: [
    { text: "every", start: 0.0, end: 0.55 },
    { text: "word", start: 0.55, end: 1.15, highlight: true },
    { text: "on", start: 1.15, end: 1.6 },
    { text: "cue", start: 1.6, end: 2.4 },
  ],
};
const DEMO_TEMPLATES = ["pro-spotlight", "v1-beast", "pro-neon", "cap-hype", "hormozi"];
const LOOP = 3.1;

function Showcase() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const styles: CaptionStyle[] = DEMO_TEMPLATES.map((id) => ({
      ...styleFromPreset(id),
      position: "center",
      marginV: 0,
      fontScale: 0.12,
      maxWidth: 0.86,
    }));

    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = (canvas.width = Math.round(canvas.clientWidth * dpr));
      const H = (canvas.height = Math.round(canvas.clientHeight * dpr));
      const elapsed = (performance.now() - start) / 1000;
      const idx = Math.floor(elapsed / LOOP) % styles.length;
      const t = elapsed % LOOP;

      // dark "monitor" backdrop with a faint vignette
      ctx.fillStyle = "#0c0d0f";
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.7);
      g.addColorStop(0, "rgba(255,255,255,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      renderFrame({ ctx, cue: DEMO, style: styles[idx], time: Math.min(t, DEMO.end), width: W, height: H });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-edge bg-black">
      <canvas ref={ref} className="block aspect-[16/10] w-full" />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V3M8 3 4.5 6.5M8 3l3.5 3.5M3 11.5V13a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13v-1.5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M1.5 3h9M4.5 3V1.8h3V3M2.7 3l.6 7h5.4l.6-7" />
    </svg>
  );
}
