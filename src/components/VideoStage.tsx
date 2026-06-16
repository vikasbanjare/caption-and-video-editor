"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cue, CaptionStyle } from "@/engine";
import { activeCueAt, renderFrame } from "@/engine";
import { fmtClock } from "@/lib/transcript";
import type { TranscribeProgress } from "@/lib/transcribe-browser";

interface Props {
  videoUrl: string;
  cues: Cue[];
  style: CaptionStyle;
  seekTo: { t: number } | null;
  progress: TranscribeProgress | null;
  onTime: (t: number) => void;
  onDuration: (d: number) => void;
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
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
          const t = video.currentTime;
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
  }, [onTime]);

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

  const pct = duration ? (Math.min(time, duration) / duration) * 100 : 0;

  return (
    <div className="flex h-full flex-col items-center">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/* phone-style frame */}
        <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[22px] border border-edge2 bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <video
            ref={videoRef}
            src={videoUrl}
            className="block max-h-full max-w-full"
            playsInline
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration || 0;
              setDuration(d);
              onDuration(d);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={togglePlay}
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute" />

          {progress && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
              <p className="text-sm font-medium text-white">{progress.label}</p>
              {typeof progress.percent === "number" && (
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full bg-accent-grad transition-all"
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
      <div className="mt-4 flex w-full max-w-xl items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-grad text-white shadow-glow transition-transform active:scale-95"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(time, duration || 0)}
          onChange={onScrub}
          className="flex-1 cursor-pointer"
          style={{
            background: `linear-gradient(to right, #7c5cff ${pct}%, #2a2f3c ${pct}%)`,
          }}
        />
        <span className="w-[92px] shrink-0 text-right font-mono text-xs text-muted">
          {fmtClock(time)} / {fmtClock(duration)}
        </span>
      </div>
    </div>
  );
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
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  canvas.style.left = `${video.offsetLeft}px`;
  canvas.style.top = `${video.offsetTop}px`;
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
