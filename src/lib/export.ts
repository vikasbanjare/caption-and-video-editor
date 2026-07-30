import { renderFrame, activeCueAt, type Cue, type CaptionStyle } from "@/engine";
import type { Range } from "./silence";

/**
 * Burn captions into a downloadable video, entirely in the browser.
 *
 * Each frame we draw the source video, then overlay the caption canvas using
 * the *same* render engine that powers the live preview (so preview === export).
 * The composite canvas is captured with `captureStream` and recorded with
 * `MediaRecorder`; the source audio is routed through WebAudio into the same
 * stream. No server, no ffmpeg. It records in real time.
 *
 * Output is MP4 where the browser's MediaRecorder supports it (Safari), else
 * WebM (Chrome/Firefox) — both are real, shareable video files.
 */

export interface ExportOptions {
  videoUrl: string;
  cues: Cue[];
  style: CaptionStyle;
  /** total duration in seconds (used to stop; robust to webm Infinity-duration) */
  duration: number;
  /** CSS/canvas filter string for the color grade (applied to the video frame) */
  filter?: string;
  /** keep-segments (silence-cut): play only these source ranges → tightened output */
  segments?: Range[];
  /** clean up audio: rumble/hum high-pass + presence + leveling compressor */
  enhanceAudio?: boolean;
  fps?: number;
  onProgress?: (fraction: number) => void;
  /** the tab was backgrounded mid-render (frames may stall — warn the user) */
  onHidden?: () => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  ext: "mp4" | "webm";
  mime: string;
}

export function isExportSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder !==
      "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function pickMime(): string {
  const MR = window.MediaRecorder;
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (MR.isTypeSupported?.(c)) return c;
  }
  return "video/webm";
}

export async function exportBurnIn({
  videoUrl,
  cues,
  style,
  duration,
  filter,
  segments,
  enhanceAudio,
  fps = 30,
  onProgress,
  onHidden,
  signal,
}: ExportOptions): Promise<ExportResult> {
  if (!isExportSupported()) {
    throw new Error("This browser can't record video (needs MediaRecorder + canvas capture).");
  }

  // --- source video (own element so we control playback/audio) ---------------
  const video = document.createElement("video");
  video.src = videoUrl;
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = false;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Could not load the source video for export."));
  });

  const W = video.videoWidth || 1080;
  const H = video.videoHeight || 1920;

  // composite canvas (recorded) + transparent caption canvas (overlay)
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const capCanvas = document.createElement("canvas");
  capCanvas.width = W;
  capCanvas.height = H;
  const capCtx = capCanvas.getContext("2d");
  if (!ctx || !capCtx) throw new Error("Canvas 2D context unavailable.");

  // --- audio: route the source into the recorded stream ----------------------
  let audioCtx: AudioContext | null = null;
  let audioTracks: MediaStreamTrack[] = [];
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AC) {
      audioCtx = new AC();
      const srcNode = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      if (enhanceAudio) {
        // rumble/hum high-pass → presence shelf → leveling compressor
        const hp = audioCtx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 85;
        const shelf = audioCtx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.value = 6000;
        shelf.gain.value = 3;
        const comp = audioCtx.createDynamicsCompressor();
        comp.threshold.value = -26;
        comp.knee.value = 24;
        comp.ratio.value = 3;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        const makeup = audioCtx.createGain();
        makeup.gain.value = 1.4;
        srcNode.connect(hp);
        hp.connect(shelf);
        shelf.connect(comp);
        comp.connect(makeup);
        makeup.connect(dest);
      } else {
        srcNode.connect(dest); // into the file only (not to speakers)
      }
      audioTracks = dest.stream.getAudioTracks();
    }
  } catch {
    // no audio track (e.g. canvas-generated clip) — export video only
    audioTracks = [];
  }

  // Background tabs throttle requestAnimationFrame to ~0, which would stall the
  // draw loop while MediaRecorder keeps recording — the classic "export froze
  // on one frame" bug. A timer fallback keeps compositing when rAF starves, and
  // the caller is told the tab must stay visible for a clean render.
  let hidden = typeof document !== "undefined" && document.hidden;
  const onVisibility = () => {
    hidden = document.hidden;
    if (hidden) onHidden?.();
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  const canvasStream = canvas.captureStream(fps);
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks,
  ]);

  const mime = pickMime();
  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((res) => {
    rec.onstop = () => res();
  });

  // stop cleanly on demand or when we reach the end
  let rafId = 0;
  let timerId: ReturnType<typeof setTimeout> | 0 = 0;
  let finished = false;
  /** schedule the next draw: rAF when visible, timer when the tab is hidden */
  const schedule = (fn: () => void) => {
    if (hidden) timerId = setTimeout(fn, 1000 / fps);
    else rafId = requestAnimationFrame(fn);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    if (timerId) clearTimeout(timerId);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    if (rec.state !== "inactive") rec.stop();
  };

  signal?.addEventListener("abort", finish, { once: true });

  // silence-cut: play only the kept segments, in order, skipping the gaps
  const segs = segments && segments.length ? segments : null;
  const outDur = segs
    ? segs.reduce((a, s) => a + (s.end - s.start), 0)
    : duration;
  const endT = outDur > 0 && isFinite(outDur) ? outDur : Infinity;
  let segIdx = 0;
  let outBase = 0; // output time accumulated from completed segments
  let seeking = false;

  const drawFrame = (outT: number) => {
    ctx.filter = filter && filter !== "none" ? filter : "none";
    ctx.drawImage(video, 0, 0, W, H);
    ctx.filter = "none";
    const t = video.currentTime;
    const cue = activeCueAt(cues, t); // captions keyed to SOURCE time → stay synced
    renderFrame({ ctx: capCtx, cue, style, time: t, width: W, height: H });
    ctx.drawImage(capCanvas, 0, 0);
    if (onProgress && endT !== Infinity) onProgress(Math.min(1, outT / endT));
  };

  const draw = () => {
    if (finished) return;
    if (seeking) {
      schedule(draw);
      return;
    }
    if (segs) {
      const seg = segs[segIdx];
      const outT = outBase + Math.max(0, video.currentTime - seg.start);
      drawFrame(outT);
      if (video.currentTime >= seg.end - 0.02 || video.ended) {
        outBase += seg.end - seg.start;
        segIdx++;
        if (segIdx >= segs.length) {
          finish();
          return;
        }
        // jump to the next kept segment without recording the seek
        seeking = true;
        if (rec.state === "recording") rec.pause();
        video.currentTime = segs[segIdx].start;
        video.onseeked = () => {
          video.onseeked = null;
          seeking = false;
          if (!finished && rec.state === "paused") rec.resume();
        };
      }
    } else {
      drawFrame(video.currentTime);
      if (video.ended || (endT !== Infinity && video.currentTime >= endT - 0.02)) {
        finish();
        return;
      }
    }
    schedule(draw);
  };

  video.currentTime = segs ? segs[0].start : 0;
  if (segs) await new Promise<void>((res) => { video.onseeked = () => { video.onseeked = null; res(); }; });
  rec.start();
  try {
    await video.play();
    if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
  } catch (err) {
    finish();
    throw new Error("Playback was blocked — click Export again.");
  }
  if (!segs) video.onended = finish;
  schedule(draw);

  await stopped;
  if (audioCtx) await audioCtx.close().catch(() => {});

  const ext: "mp4" | "webm" = mime.includes("mp4") ? "mp4" : "webm";
  return { blob: new Blob(chunks, { type: mime }), ext, mime };
}

/** Trigger a browser download for a produced blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
