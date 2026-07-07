"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { Cue, CaptionStyle } from "@/engine";
import { activeCueAt, renderFrame } from "@/engine";
import { fmtClock } from "@/lib/transcript";
import type { TranscribeProgress } from "@/lib/transcribe-browser";
import type { ProjectNote } from "@/lib/store";

interface Props {
  videoUrl: string;
  cues: Cue[];
  style: CaptionStyle;
  seekTo: { t: number } | null;
  progress: TranscribeProgress | null;
  onTime: (t: number) => void;
  onDuration: (d: number) => void;
  /** written every animation frame — timeline playhead reads it without re-rendering */
  timeRef?: MutableRefObject<number>;
  /** gives the parent direct access to the <video> (play/pause, keyboard) */
  onVideoEl?: (el: HTMLVideoElement | null) => void;
  onPlayingChange?: (playing: boolean) => void;
  // frame notes (ported from Daxio pins)
  notes?: ProjectNote[];
  noteMode?: boolean;
  onAddNote?: (x: number, y: number, t: number) => void;
  onSeekNote?: (t: number) => void;
  /** live style edits from direct manipulation (drag caption) */
  onStyleChange?: (patch: Partial<CaptionStyle>) => void;
  /** draw title-safe + social-UI safe-zone guides */
  safeZones?: boolean;
  /** CSS/canvas filter string for the live color grade (baked into export too) */
  videoFilter?: string;
}

/**
 * Live preview: a <canvas> overlaid on the <video>, driven by the SAME
 * render engine the export will use, synced via requestAnimationFrame.
 */
export default function VideoStage({
  videoUrl,
  cues,
  style,
  seekTo,
  progress,
  onTime,
  onDuration,
  timeRef,
  onVideoEl,
  onPlayingChange,
  notes,
  noteMode,
  onAddNote,
  onSeekNote,
  onStyleChange,
  safeZones,
  videoFilter,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinLayerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  /** step one frame (~1/30s) while paused — precise caption timing */
  const frameStep = useCallback((dir: 1 | -1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, v.currentTime + dir / 30);
  }, []);

  const cycleRate = useCallback(() => {
    const rates = [0.5, 1, 1.5, 2];
    setRate((r) => {
      const next = rates[(rates.indexOf(r) + 1) % rates.length];
      if (videoRef.current) videoRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const cuesRef = useRef(cues);
  const styleRef = useRef(style);
  cuesRef.current = cues;
  styleRef.current = style;
  const lastReported = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          fitCanvas(canvas, video);
          if (pinLayerRef.current) placeOverVideo(pinLayerRef.current, video);
          if (overlayRef.current) placeOverVideo(overlayRef.current, video);
          const t = video.currentTime;
          if (timeRef) timeRef.current = t;
          renderFrame({
            ctx,
            cue: activeCueAt(cuesRef.current, t),
            style: styleRef.current,
            time: t,
            width: canvas.width,
            height: canvas.height,
          });
          if (Math.abs(t - lastReported.current) > 0.1) {
            lastReported.current = t;
            setTime(t);
            onTime(t);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onTime, timeRef]);

  useEffect(() => {
    if (!seekTo || !videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, seekTo.t);
  }, [seekTo]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (v) v.currentTime = Number(e.target.value);
  };

  // approximate on-screen box of the caption, for the drag handle
  const capBox = () => {
    const w = Math.min(0.98, style.maxWidth + 0.06);
    const h = 0.26;
    let cy =
      style.position === "top"
        ? style.marginV + 0.1
        : style.position === "center"
          ? 0.5
          : 1 - style.marginV - 0.1;
    cy += style.offsetY || 0;
    const cx = 0.5 + (style.offsetX || 0);
    return {
      left: `${(cx - w / 2) * 100}%`,
      top: `${(cy - h / 2) * 100}%`,
      width: `${w * 100}%`,
      height: `${h * 100}%`,
    };
  };
  const startCapDrag = (e: React.PointerEvent) => {
    if (noteMode || !onStyleChange) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: style.offsetX || 0,
      oy: style.offsetY || 0,
      moved: false,
    };
  };
  const moveCapDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const v = videoRef.current;
    if (!d || !v || !onStyleChange) return;
    const rect = v.getBoundingClientRect();
    if (rect.width === 0) return;
    if (Math.abs(e.clientX - d.sx) > 3 || Math.abs(e.clientY - d.sy) > 3) d.moved = true;
    onStyleChange({
      offsetX: clampOff(d.ox + (e.clientX - d.sx) / rect.width),
      offsetY: clampOff(d.oy + (e.clientY - d.sy) / rect.height),
    });
  };
  const endCapDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) togglePlay(); // a plain click still toggles playback
  };

  const pct = duration ? (Math.min(time, duration) / duration) * 100 : 0;

  return (
    <div className="flex h-full flex-col items-center">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/* phone-style frame */}
        <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[22px] border border-edge2 bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <video
            ref={(el) => {
              videoRef.current = el;
              onVideoEl?.(el);
            }}
            src={videoUrl}
            className={`block max-h-full max-w-full ${noteMode ? "cursor-crosshair" : ""}`}
            style={videoFilter ? { filter: videoFilter } : undefined}
            playsInline
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration || 0;
              setDuration(d);
              onDuration(d);
              e.currentTarget.playbackRate = rate;
            }}
            onPlay={() => {
              setPlaying(true);
              onPlayingChange?.(true);
            }}
            onPause={() => {
              setPlaying(false);
              onPlayingChange?.(false);
            }}
            onClick={(e) => {
              if (noteMode && onAddNote && videoRef.current) {
                const rect = videoRef.current.getBoundingClientRect();
                const x = clamp01((e.clientX - rect.left) / rect.width);
                const y = clamp01((e.clientY - rect.top) / rect.height);
                onAddNote(x, y, videoRef.current.currentTime);
              } else {
                togglePlay();
              }
            }}
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute" />

          {/* caption drag handle + safe-zone guides (sized to the video box) */}
          <div ref={overlayRef} className="pointer-events-none absolute">
            {safeZones && (
              <>
                {/* title-safe (10%) + action-safe (5%) */}
                <div className="absolute inset-[5%] rounded-sm border border-white/20" />
                <div className="absolute inset-[10%] border border-dashed border-white/25" />
                {/* social caption band + right-rail UI (Reels/TikTok) */}
                <div className="absolute inset-x-0 bottom-0 h-[18%] bg-white/[0.03]" />
                <div className="absolute bottom-[14%] right-[6%] top-[40%] w-[10%] rounded-md border border-dashed border-white/15" />
              </>
            )}
            {onStyleChange && cues.length > 0 && !noteMode && (
              <div
                onPointerDown={startCapDrag}
                onPointerMove={moveCapDrag}
                onPointerUp={endCapDrag}
                onPointerCancel={endCapDrag}
                title="Drag to move the caption"
                className="group pointer-events-auto absolute cursor-move rounded border border-transparent transition-colors hover:border-accent/70 hover:bg-accent/5"
                style={capBox()}
              >
                <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[9px] text-white group-hover:block">
                  drag to move
                </span>
              </div>
            )}
          </div>

          {/* frame-note pins (positioned within the video box) */}
          <div ref={pinLayerRef} className="pointer-events-none absolute">
            {(notes ?? [])
              .filter((n) => n.x !== null && n.y !== null)
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => onSeekNote?.(n.t)}
                  title={n.body || "note"}
                  aria-label={`Note at ${fmtClock(n.t)}`}
                  className={`pointer-events-auto absolute flex h-6 w-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-[50%_50%_50%_3px] text-[10px] shadow-md transition-transform hover:scale-110 ${
                    n.resolved ? "bg-good" : "bg-accent"
                  }`}
                  style={{ left: `${(n.x ?? 0) * 100}%`, top: `${(n.y ?? 0) * 100}%` }}
                >
                  📌
                </button>
              ))}
          </div>

          {progress && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
              <p className="text-sm font-medium text-white">{progress.label}</p>
              {typeof progress.percent === "number" && (
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              )}
              {progress.phase === "transcribing" && (
                <p className="text-[11px] text-white/60">
                  Running Whisper in your browser — first run downloads the model.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* transport */}
      <div className="mt-4 flex w-full max-w-xl items-center gap-2">
        <button
          onClick={() => frameStep(-1)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge bg-surface2 text-ink transition-colors hover:text-ink"
          aria-label="Previous frame"
          title="Previous frame (,)"
        >
          <StepIcon dir={-1} />
        </button>
        <button
          onClick={togglePlay}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-grad-accent text-white shadow-glow-sm transition-transform hover:scale-105 active:scale-95"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          onClick={() => frameStep(1)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge bg-surface2 text-ink transition-colors hover:text-ink"
          aria-label="Next frame"
          title="Next frame (.)"
        >
          <StepIcon dir={1} />
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(time, duration || 0)}
          onChange={onScrub}
          className="min-w-0 flex-1 cursor-pointer"
          style={{
            background: `linear-gradient(to right, #F94B1E ${pct}%, #3a352c ${pct}%)`,
          }}
          aria-label="Seek"
        />
        <span className="w-[92px] shrink-0 text-right font-mono text-xs tabular-nums text-muted">
          {fmtClock(time)} / {fmtClock(duration)}
        </span>
        <button
          onClick={cycleRate}
          className="h-7 w-11 shrink-0 rounded-md border border-edge bg-surface2 font-mono text-[11px] text-ink transition-colors hover:text-ink"
          title="Playback speed"
          aria-label={`Playback speed ${rate}x`}
        >
          {rate}×
        </button>
      </div>
    </div>
  );
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const clampOff = (n: number) => (n < -0.45 ? -0.45 : n > 0.45 ? 0.45 : n);

/** Position an absolutely-placed overlay to exactly cover the video's box. */
function placeOverVideo(el: HTMLElement, video: HTMLVideoElement) {
  const rect = video.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.left = `${video.offsetLeft}px`;
  el.style.top = `${video.offsetTop}px`;
}

function fitCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
  const rect = video.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  placeOverVideo(canvas, video);
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5v11a.5.5 0 0 0 .76.43l9-5.5a.5.5 0 0 0 0-.86l-9-5.5A.5.5 0 0 0 4 2.5Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" rx="1" />
      <rect x="9" y="2" width="4" height="12" rx="1" />
    </svg>
  );
}
function StepIcon({ dir }: { dir: 1 | -1 }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="currentColor"
      style={{ transform: dir === -1 ? "scaleX(-1)" : undefined }}
    >
      <path d="M1.5 1.8v8.4a.4.4 0 0 0 .62.33l6-4.2a.4.4 0 0 0 0-.66l-6-4.2a.4.4 0 0 0-.62.33Z" />
      <rect x="9.2" y="1.5" width="1.6" height="9" rx="0.6" />
    </svg>
  );
}
