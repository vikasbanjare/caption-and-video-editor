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
 * The Ingest room — the front door. Not a marketing page: a program monitor
 * running the caption engine live, a tight control column, and your recent
 * projects. Reads like the cold-open of an NLE, not a website.
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
      className={`scroll-thin h-full overflow-y-auto transition-colors ${
        drag ? "bg-accent/[0.05]" : ""
      }`}
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

      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 sm:px-10">
        {/* console head: control column + live program monitor */}
        <section className="grid flex-1 items-center gap-10 py-8 md:grid-cols-[1fr_300px] md:py-10 lg:gap-16">
          <div className="order-2 md:order-1">
            <span className="chip chip-active">
              <SparkIcon /> Caption NLE · 100% on-device
            </span>
            <h1 className="mt-4 text-[clamp(1.9rem,3.4vw,2.9rem)] font-extrabold leading-[1.04] tracking-tight text-ink">
              Caption anything.{" "}
              <span className="grad-text">Nothing leaves your browser.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
              Whisper transcribes on your own machine. 97 studio caption
              templates, a real editing timeline and word-perfect timing — then
              export. No uploads, no accounts, no watermark.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary" onClick={pick}>
                <PlusIcon /> New from media
              </button>
              <span className="font-mono text-[11px] text-muted">
                or drop a file anywhere
              </span>
            </div>

            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-edge pt-5">
              {[
                ["97", "templates"],
                ["17", "animations"],
                ["40+", "languages"],
                ["∞", "private"],
              ].map(([n, l]) => (
                <div key={l} className="flex items-baseline gap-1.5">
                  <dt className="font-mono text-lg font-semibold tabular-nums text-ink">
                    {n}
                  </dt>
                  <dd className="eyebrow">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative order-1 mx-auto w-full max-w-[300px] md:order-2">
            {/* soft blue-violet aura behind the monitor */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-[40px] bg-grad-accent opacity-20 blur-3xl"
            />
            <ProgramMonitor />
          </div>
        </section>

        {/* recent projects — a dense filmstrip, anchored to the floor */}
        <section className="border-t border-edge py-6">
          <div className="mb-4 flex items-end justify-between">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow">Recent</span>
              <span className="font-mono text-[11px] text-muted">
                {projects.length
                  ? `${projects.length} on this device`
                  : "nothing saved yet"}
              </span>
            </div>
            <button className="btn btn-ghost text-xs" onClick={pick}>
              <PlusIcon /> New
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <button
              onClick={pick}
              className={`group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed transition-colors ${
                drag
                  ? "border-accent bg-accent/5"
                  : "border-edge2 hover:border-accent hover:bg-surface"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-accent text-white shadow-glow-sm transition-transform group-hover:-translate-y-0.5">
                <UploadIcon />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-label text-muted">
                Drop media
              </span>
            </button>

            {projects.map((p) => (
              <div
                key={p.id}
                className={`group relative overflow-hidden rounded-2xl border bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-soft ${
                  p.id === currentId
                    ? "border-accent"
                    : "border-edge hover:border-edge2"
                }`}
              >
                <button
                  onClick={() => onOpen(p.id)}
                  className="block w-full text-left"
                >
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-black">
                    {p.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-label text-white/25">
                        no frame
                      </span>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="truncate text-[13px] font-medium text-ink">
                      {p.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted">
                      <span className="tabular-nums">
                        {fmtClock(p.duration || 0)}
                      </span>
                      <span className="text-edge2">·</span>
                      <span className="tabular-nums">
                        {(p.cues || []).length} cues
                      </span>
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

/* --- live program monitor: the caption engine cycling premium templates ---- */
const DEMO: Cue = {
  id: "demo",
  start: 0,
  end: 2.6,
  text: "the one thing nobody tells you",
  words: [
    { text: "the", start: 0.0, end: 0.32 },
    { text: "one", start: 0.32, end: 0.66 },
    { text: "thing", start: 0.66, end: 1.05 },
    { text: "nobody", start: 1.05, end: 1.6, highlight: true },
    { text: "tells", start: 1.6, end: 2.0 },
    { text: "you", start: 2.0, end: 2.6 },
  ],
};
const DEMO_TEMPLATES: [string, string][] = [
  ["pro-spotlight", "Spotlight"],
  ["hormozi", "Hormozi"],
  ["pro-neon", "Neon"],
  ["cap-hype", "Hype"],
  ["v1-beast", "Beast"],
];
const LOOP = 3.2;

function ProgramMonitor() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState(DEMO_TEMPLATES[0][1]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const styles: CaptionStyle[] = DEMO_TEMPLATES.map(([id]) => ({
      ...styleFromPreset(id),
      position: "center",
      marginV: 0,
      fontScale: 0.066,
      maxWidth: 0.84,
    }));

    let raf = 0;
    let shown = -1;
    const start = performance.now();
    const loop = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = (canvas.width = Math.round(canvas.clientWidth * dpr));
      const H = (canvas.height = Math.round(canvas.clientHeight * dpr));
      const elapsed = (performance.now() - start) / 1000;
      const idx = Math.floor(elapsed / LOOP) % styles.length;
      const t = elapsed % LOOP;
      if (idx !== shown) {
        shown = idx;
        setLabel(DEMO_TEMPLATES[idx][1]);
      }

      // dark monitor backdrop with a faint centre vignette
      ctx.fillStyle = "#0a0b0d";
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(
        W / 2,
        H * 0.44,
        0,
        W / 2,
        H * 0.44,
        H * 0.6
      );
      g.addColorStop(0, "rgba(255,255,255,0.045)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      renderFrame({
        ctx,
        cue: DEMO,
        style: styles[idx],
        time: Math.min(t, DEMO.end),
        width: W,
        height: H,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <figure className="relative overflow-hidden rounded-3xl border border-edge2 bg-black shadow-glow-sm">
      <canvas ref={ref} className="block aspect-[9/16] w-full" />

      {/* functional chrome — reads like a program monitor, not a poster */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-label text-white/45">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Program
        </span>
        <span className="font-mono text-[9px] tabular-nums text-white/35">
          1080 × 1920
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[9px] uppercase tracking-label text-white/45">
          {label}
        </span>
        <span className="font-mono text-[9px] tabular-nums text-white/35">
          9:16 · 30
        </span>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/[0.07]" />
    </figure>
  );
}

function SparkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0.5c.3 2.7 1.3 4.8 3 6.2-1.7.6-2.7 2-3 4.3-.3-2.3-1.3-3.7-3-4.3 1.7-1.4 2.7-3.5 3-6.2ZM13.2 8.5c.16 1.5.74 2.6 1.8 3.3-1.06.35-1.64 1.1-1.8 2.4-.16-1.3-.74-2.05-1.8-2.4 1.06-.7 1.64-1.8 1.8-3.3Z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 11V3M8 3 4.5 6.5M8 3l3.5 3.5M3 11.5V13a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13v-1.5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    >
      <path d="M1.5 3h9M4.5 3V1.8h3V3M2.7 3l.6 7h5.4l.6-7" />
    </svg>
  );
}
