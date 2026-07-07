"use client";

import { useEffect, useRef, useState } from "react";
import {
  renderFrame,
  styleFromPreset,
  PRESETS,
  type Cue,
} from "@/engine";
import { timeAgo, type ProjectRecord } from "@/lib/store";

interface Props {
  onUpload: (f: File) => void;
  projects: ProjectRecord[];
  onOpen: (id: string) => void;
}

/**
 * The home page + zero state — an editorial "studio cover", deliberately not
 * the generic SaaS hero. See .claude/skills/cutpilot-design.
 */
export default function Landing({ onUpload, projects, onOpen }: Props) {
  const recents = projects.slice(0, 4);
  const marquee = PRESETS.slice(0, 22).map((p) => p.label);

  return (
    <div className="theme-paper scroll-thin min-h-0 flex-1 overflow-y-auto bg-bg text-ink">
      {/* masthead */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between border-b border-edge px-6 py-4">
        <span className="eyebrow">CutPilot — caption instrument</span>
        <span className="eyebrow hidden sm:block">Browser-native · nothing uploaded</span>
      </header>

      {/* hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 md:grid-cols-12 md:py-16">
        <div className="animate-fade-up md:col-span-7">
          <span className="eyebrow">01 — the tool</span>
          <h1 className="mt-4 font-display font-semibold leading-[0.94] tracking-tight text-[clamp(2.7rem,7.5vw,5.6rem)]">
            Set every{" "}
            <span className="italic text-accent">word</span> to the beat.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
            Transcribe a clip in the browser with Whisper, cut it on a real
            timeline, and set the captions in ninety-seven studio-grade
            templates. No account, no render queue — nothing leaves your
            machine.
          </p>

          <Dropzone onUpload={onUpload} />

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5">
            {[
              ["97", "templates"],
              ["17", "animations"],
              ["0", "servers"],
            ].map(([n, l]) => (
              <span key={l} className="flex items-baseline gap-1.5">
                <span className="font-display text-lg font-semibold">{n}</span>
                <span className="eyebrow">{l}</span>
              </span>
            ))}
          </div>
        </div>

        {/* specimen — the product dogfooding itself */}
        <div className="animate-fade-up md:col-span-5">
          <Specimen />
          <p className="mt-3 text-right font-mono text-[11px] text-muted">
            fig. 1 — a caption, set live by the same engine that exports it
          </p>
        </div>
      </section>

      {/* how it works — numbered, hairline, not cards */}
      <section className="mx-auto w-full max-w-6xl border-t border-edge px-6 py-14">
        <span className="eyebrow">02 — the process</span>
        <div className="mt-8 grid gap-y-10 md:grid-cols-3 md:gap-x-0">
          {[
            ["01", "Transcribe", "Whisper runs in a Web Worker on your device. Word-level timing, forty-plus languages, Hindi romanised to Hinglish."],
            ["02", "Cut", "A proper timeline — waveform, draggable blocks, trim, split at the playhead, undo. The kind you'd cut a real edit on."],
            ["03", "Set type", "Ninety-seven templates from the CutPilot plugin, each editable to the letter. Preview is pixel-identical to the export."],
          ].map(([n, title, body], i) => (
            <div
              key={n}
              className={`px-0 md:px-8 ${i > 0 ? "md:border-l md:border-edge" : "md:pl-0"} ${i === 0 ? "md:pl-0" : ""}`}
            >
              <div className="font-display text-4xl font-semibold text-accent">{n}</div>
              <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* template marquee */}
      <section className="overflow-hidden border-y border-edge py-4">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
          {[...marquee, ...marquee].map((name, i) => (
            <span key={i} className="flex items-center gap-8 font-display text-lg text-ink/70">
              {name}
              <span className="text-accent">◆</span>
            </span>
          ))}
        </div>
      </section>

      {/* recents */}
      {recents.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-6 py-14">
          <span className="eyebrow">03 — pick up where you left off</span>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recents.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="group overflow-hidden rounded border border-edge bg-surface text-left transition-colors hover:border-accent"
              >
                <div className="flex aspect-video items-center justify-center overflow-hidden bg-black">
                  {p.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[11px] text-white/30">no frame</span>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="font-mono text-[10px] text-muted">{timeAgo(p.updatedAt)}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* footer */}
      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between border-t border-edge px-6 py-8">
        <span className="font-display text-lg font-semibold">CutPilot</span>
        <span className="eyebrow">Made for editors · 2026</span>
      </footer>
    </div>
  );
}

function Dropzone({ onUpload }: { onUpload: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
      className={`mt-8 flex cursor-pointer items-center justify-between gap-4 rounded border px-5 py-5 transition-colors ${
        drag ? "border-accent bg-accent/5" : "border-edge bg-surface hover:border-accent"
      }`}
    >
      <div>
        <div className="font-mono text-[11px] uppercase tracking-label text-accent">
          Zero state — start here
        </div>
        <div className="mt-1.5 font-display text-xl font-semibold">
          Drop a video or audio file
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-muted">
          MP4 · MOV · WEBM · MP3 · WAV — or click to browse
        </div>
      </div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-accent text-white">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 11V3M8 3 4.5 6.5M8 3l3.5 3.5M3 11.5V13a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13v-1.5" />
        </svg>
      </span>
      <input
        ref={input}
        type="file"
        accept="video/*,audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

// Live caption specimen — the CutPilot mark colour driving a boxed template.
const SPECIMEN: Cue = {
  id: "spec",
  start: 0,
  end: 2,
  text: "on the BEAT",
  words: [
    { text: "on", start: 0, end: 0.6 },
    { text: "the", start: 0.6, end: 1.0 },
    { text: "BEAT", start: 1.0, end: 2.0, highlight: true },
  ],
};

function Specimen() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (canvas.width = Math.round(canvas.clientWidth * dpr));
    const H = (canvas.height = Math.round(canvas.clientHeight * dpr));

    const style = {
      ...styleFromPreset("hormozi"),
      position: "center" as const,
      marginV: 0,
      fontScale: 0.14,
      activeBoxColor: "#F94B1E",
      activeBoxTextColor: "#FFFFFF",
      emphasis: "keyword" as const,
      highlightMode: "box" as const,
    };
    const draw = () => {
      ctx.fillStyle = "#141210";
      ctx.fillRect(0, 0, W, H);
      renderFrame({ ctx, cue: SPECIMEN, style, time: 1.4, width: W, height: H });
    };
    draw();
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts;
    fonts?.ready.then(draw).catch(() => {});
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-edge">
      <canvas ref={ref} className="block aspect-[4/5] w-full" />
    </div>
  );
}
