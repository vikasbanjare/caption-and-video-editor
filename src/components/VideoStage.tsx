"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cue, CaptionStyle } from "@/engine";
import { activeCueAt, renderFrame } from "@/engine";
import { fmtClock } from "@/lib/transcript";

interface Props {
  videoUrl: string | null;
  cues: Cue[];
  style: CaptionStyle;
  /** new object => seek to .t (seconds) */
  seekTo: { t: number } | null;
  onTime: (t: number) => void;
  onDuration: (d: number) => void;
}

/**
 * The live preview (WEBSAASPLAN.md §4.1): a <canvas> overlaid on the <video>,
 * driven by the SAME render.js the export worker will use, synced to
 * currentTime via requestAnimationFrame so captions animate smoothly (the
 * coarse `timeupdate` event isn't enough for word-level sync).
 */
export default function VideoStage({
  videoUrl,
  cues,
  style,
  seekTo,
  onTime,
  onDuration,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Keep latest cues/style in refs so the rAF loop sees fresh values without
  // restarting the loop every render.
  const cuesRef = useRef(cues);
  const styleRef = useRef(style);
  cuesRef.current = cues;
  styleRef.current = style;
  const lastReported = useRef(0);

  // --- animation + render loop ----------------------------------------------
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
            // ~10 Hz is plenty for the scrubber + transcript highlight; the
            // caption canvas animates every frame independent of React state.
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

  // --- external seek requests -----------------------------------------------
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
    if (!v) return;
    v.currentTime = Number(e.target.value);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="max-h-full max-w-full"
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
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 m-auto"
              style={{ width: "100%", height: "100%" }}
            />
          </>
        ) : (
          <div className="px-6 text-center text-sm text-slate-500">
            Upload a video to start. The caption preview renders here, exactly as
            it will export.
          </div>
        )}
      </div>

      {/* transport */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!videoUrl}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-black disabled:opacity-40"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(time, duration || 0)}
          onChange={onScrub}
          disabled={!videoUrl}
          className="h-1 flex-1 cursor-pointer"
        />
        <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-400">
          {fmtClock(time)} / {fmtClock(duration)}
        </span>
      </div>
    </div>
  );
}

/** Size the overlay canvas to the displayed video, at device pixel density. */
function fitCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
  const rect = video.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  // Match canvas box to the video box (it may be letterboxed inside the stage).
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  canvas.style.left = `${video.offsetLeft}px`;
  canvas.style.top = `${video.offsetTop}px`;
  canvas.style.right = "auto";
  canvas.style.bottom = "auto";
  canvas.style.margin = "0";
}
