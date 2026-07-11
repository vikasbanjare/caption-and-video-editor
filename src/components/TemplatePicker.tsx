"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PRESETS,
  CATEGORIES,
  renderFrame,
  type Cue,
  type StylePreset,
} from "@/engine";

interface Props {
  current: string;
  onPick: (id: string) => void;
}

// Sample cue for thumbnails. "IT" is the keyword (emphasised by keyword
// templates) and is the spoken word at PREVIEW_TIME (emphasised by karaoke).
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
const PREVIEW_TIME = 0.72;

export default function TemplatePicker({ current, onPick }: Props) {
  const [cat, setCat] = useState<string>("All");

  const shown = useMemo(
    () =>
      [...PRESETS]
        .filter((p) => cat === "All" || p.category === cat)
        .sort((a, b) => b.popularity - a.popularity),
    [cat]
  );

  return (
    <div>
      {/* category filter */}
      <div className="scroll-thin mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={cat === "All"} onClick={() => setCat("All")}>
          All <span className="opacity-60">{PRESETS.length}</span>
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {shown.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
              current === p.id
                ? "border-accent ring-2 ring-accent/40"
                : "border-edge hover:border-edge2"
            }`}
            title={p.label}
          >
            <Thumb preset={p} />
            <div className="flex items-center justify-between px-2.5 py-1.5">
              <span className="truncate text-xs font-semibold text-ink">
                {p.label}
              </span>
              <span className="ml-1 shrink-0 text-[10px] text-muted">{p.tag}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "border-accent bg-accent/15 text-accent2"
          : "border-edge bg-surface2 text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// Tiles PLAY the real animation (Pulse tech brief §3/§6: the gallery card
// plays the same engine/frames as the editor, not a frozen thumbnail). One
// shared clock; each tile animates only while on screen.
const LOOP_SEC = 2.4; // 1.5s cue + a beat of rest before it loops

function Thumb({ preset }: { preset: StylePreset }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const W = (canvas.width = Math.round(150 * dpr));
    const H = (canvas.height = Math.round(96 * dpr));
    const style = {
      ...preset.style,
      position: "center" as const,
      marginV: 0,
      fontScale: preset.style.maxLines === 1 ? 0.16 : 0.2,
      maxWidth: 0.94,
    };

    const draw = (t: number) => {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#2b2350");
      g.addColorStop(1, "#16203a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      renderFrame({
        ctx,
        cue: SAMPLE,
        style,
        time: Math.min(t, SAMPLE.end - 0.01),
        width: W,
        height: H,
      });
    };

    let raf = 0;
    let visible = false;
    const loop = () => {
      if (!visible) return;
      draw((performance.now() / 1000) % LOOP_SEC);
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      const nowVisible = !!e?.isIntersecting;
      if (nowVisible && !visible) {
        visible = true;
        raf = requestAnimationFrame(loop);
      } else if (!nowVisible) {
        visible = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(canvas);

    draw(PREVIEW_TIME); // static first paint (also the reduced-motion fallback)
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } })
      .fonts;
    fonts?.ready.then(() => draw(PREVIEW_TIME)).catch(() => {});

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [preset]);

  return <canvas ref={ref} className="block h-[96px] w-full" />;
}
