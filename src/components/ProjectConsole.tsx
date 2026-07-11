"use client";

import { useEffect, useRef, useState } from "react";
import {
  renderFrame,
  styleFromPreset,
  PRESETS,
  type Cue,
  type CaptionStyle,
} from "@/engine";
import { timeAgo, type ProjectRecord } from "@/lib/store";
import { fmtClock } from "@/lib/transcript";
import ImageTools from "./ImageTools";

// template names for the marquee (real, from the catalog) + the room tour
const MARQUEE: string[] = PRESETS.slice(0, 28).map((p) => p.label);
const ROOMS: [string, string, string][] = [
  ["01", "Ingest", "Drop a clip — nothing uploads"],
  ["02", "Script", "Whisper transcribes, you fix words"],
  ["03", "Cut", "Trim on a real timeline"],
  ["04", "Color", "Grade the picture with looks"],
  ["05", "Type", "111 templates, full control"],
  ["06", "Export", "Burn captions into an MP4"],
];

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
  const [imageTool, setImageTool] = useState(false);
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
        {/* console head: masthead + live program monitor */}
        <section className="grid items-center gap-10 py-10 md:grid-cols-[1.05fr_340px] md:py-14 lg:gap-16">
          <div className="order-2 md:order-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent">
              <SparkIcon /> 100% on-device · nothing uploads
            </span>
            <h1 className="mt-5 text-[clamp(2.5rem,5.6vw,4.6rem)] font-extrabold leading-[0.97] tracking-[-0.02em] text-ink">
              Caption anything.
              <br />
              <span className="text-accent">Zero uploads.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Whisper runs on your machine. 111 caption & title templates, a real
              editing timeline, color grading and burned-in export — all in the
              browser. No accounts, no watermark.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button className="btn btn-primary text-[15px]" onClick={pick}>
                <PlusIcon /> New from media
              </button>
              <button
                className="btn btn-ghost text-[13px]"
                onClick={() => setImageTool(true)}
              >
                <SparkIcon /> Remove image background
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-edge pt-4 font-mono text-[11px] uppercase tracking-label text-muted">
              <span>
                <b className="font-semibold text-ink">111</b> templates
              </span>
              <span className="text-edge2">·</span>
              <span>
                <b className="font-semibold text-ink">17</b> animations
              </span>
              <span className="text-edge2">·</span>
              <span>
                <b className="font-semibold text-ink">40+</b> languages
              </span>
              <span className="text-edge2">·</span>
              <span>
                <b className="font-semibold text-ink">0</b> uploads
              </span>
            </div>
          </div>

          <div className="order-1 mx-auto w-full max-w-[340px] md:order-2">
            <ProgramMonitor />
          </div>
        </section>

        {/* template marquee — motion + proof, in-voice */}
        <section className="flex items-center gap-5 overflow-hidden border-t border-edge py-3">
          <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-label text-muted sm:block">
            111 studio templates
          </span>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
            <div className="flex w-max animate-marquee gap-2.5 whitespace-nowrap">
              {[...MARQUEE, ...MARQUEE].map((n, i) => (
                <span
                  key={i}
                  className="rounded-full border border-edge bg-surface2 px-3 py-1 font-mono text-[11px] text-muted"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* bento — one project, six rooms */}
        <section className="border-t border-edge py-8">
          <span className="eyebrow">One project · six rooms</span>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {ROOMS.map(([n, t, d]) => (
              <div
                key={n}
                className="rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-edge2"
              >
                <div className="font-mono text-[11px] tabular-nums text-accent">
                  {n}
                </div>
                <div className="mt-1.5 text-[15px] font-semibold text-ink">
                  {t}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-muted">
                  {d}
                </div>
              </div>
            ))}
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
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white transition-transform group-hover:-translate-y-0.5">
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

      {imageTool && <ImageTools onClose={() => setImageTool(false)} />}
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
    <figure className="relative overflow-hidden rounded-3xl border border-edge2 bg-black shadow-[0_40px_90px_-40px_rgb(var(--shadow)/0.7)]">
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
