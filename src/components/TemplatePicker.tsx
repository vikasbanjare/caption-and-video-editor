"use client";

import { useEffect, useRef } from "react";
import { PRESETS, renderFrame, type Cue, type StylePreset } from "@/engine";

interface Props {
  current: string;
  onPick: (id: string) => void;
}

// A tiny sample cue used to render the thumbnails. The middle word is "current"
// at the preview time, so active-word effects (box/glow/fill) show up.
const SAMPLE: Cue = {
  id: "thumb",
  start: 0,
  end: 1.5,
  text: "make IT pop",
  words: [
    { text: "make", start: 0.0, end: 0.5 },
    { text: "IT", start: 0.5, end: 1.0, highlight: true },
    { text: "pop", start: 1.0, end: 1.5 },
  ],
};
const PREVIEW_TIME = 0.7;

/** Visual gallery of caption templates (WEBSAASPLAN.md §4.1 styling). */
export default function TemplatePicker({ current, onPick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
            current === p.id
              ? "border-accent ring-2 ring-accent/40"
              : "border-edge hover:border-edge2"
          }`}
        >
          <Thumb preset={p} />
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-xs font-semibold text-slate-100">{p.label}</span>
            <span className="text-[10px] text-muted">{p.tag}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function Thumb({ preset }: { preset: StylePreset }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (canvas.width = Math.round(150 * dpr));
    const H = (canvas.height = Math.round(96 * dpr));

    const draw = () => {
      // backdrop
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#2b2350");
      g.addColorStop(1, "#16203a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // caption — force center + larger size so it reads in the thumbnail
      renderFrame({
        ctx,
        cue: SAMPLE,
        style: {
          ...preset.style,
          position: "center",
          marginV: 0,
          fontScale: 0.2,
          maxWidth: 0.92,
        },
        time: PREVIEW_TIME,
        width: W,
        height: H,
      });
    };

    draw();
    // Display fonts may still be loading — redraw when they're ready.
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } })
      .fonts;
    fonts?.ready.then(draw).catch(() => {});
  }, [preset]);

  return (
    <canvas
      ref={ref}
      className="block h-[96px] w-full"
      style={{ imageRendering: "auto" }}
    />
  );
}
